import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Heart,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { useAppStore } from "./store/useAppStore";
import type { Holding, Mode, RosterUpdate, Tab, WalletProfile } from "./types";
import { DAY_MS, DECK_SIZE, POLL_MS } from "./utils/constants";
import {
  buildDeck,
  getWalletHoldings,
  getWalletPnlSummary,
  getWalletRecentTrades,
  hasApiKey,
  configuredApiKey,
  projectConnectionAvailable,
  useProjectKey,
  setApiKey,
} from "./services/nansen";
import { demoDeck, demoSignals, demoRosterUpdates } from "./services/demo";
import { sinceMatchPerformance } from "./utils/roster";
import { buildSignals } from "./services/signals";
import { AppFrame } from "./components/AppFrame";
import { TabBar } from "./components/TabBar";
import { SwipeDeck } from "./components/SwipeDeck";
import { RosterList } from "./components/RosterList";
import { SignalsFeed } from "./components/SignalsFeed";
import { BreakUpModal } from "./components/BreakUpModal";
import { RosterFullModal } from "./components/RosterFullModal";
import { Modal } from "./components/Modal";
import { Connection } from "./components/Connection";
import { SettingsMenu } from "./components/SettingsMenu";
import { MatchModal } from "./components/MatchModal";
import { RosterCapacity } from "./components/RosterCapacity";
export default function App() {
  const store = useAppStore(),
    { mode, theme } = store;
  const [tab, setTab] = useState<Tab>("scout"),
    [keyReady, setKeyReady] = useState(hasApiKey());
  const [settings, setSettings] = useState(false),
    [full, setFull] = useState(false),
    [breaking, setBreaking] = useState<string | null>(null),
    [match, setMatch] = useState<WalletProfile | null>(null);
  const [fromFull, setFromFull] = useState(false),
    [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false),
    [polling, setPolling] = useState(false),
    [progress, setProgress] = useState(0);
  const [deckError, setDeckError] = useState(""),
    [pollError, setPollError] = useState("");
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0),
    deckBusy = useRef(false),
    pollBusy = useRef(false);
  const deckRetryAt = useRef(0),
    pollRetryAt = useRef(0),
    lastRoster = useRef("");
  const main = useRef<HTMLElement>(null);
  const data = mode ? store[mode] : null;
  const rosterSignature =
    data?.roster.map((r) => `${r.wallet.address}:${r.addedAt}`).join(",") || "";
  const ready = mode === "demo" || (mode === "live" && keyReady);
  const currentWallet = data?.deck[data.deckPosition];
  const holdingsAttempt = useRef("");
  useEffect(() => {
    if (
      mode !== "live" ||
      !ready ||
      !currentWallet ||
      currentWallet.holdingsAvailable
    )
      return;
    const version = generation.current;
    const attempt = `${version}:${currentWallet.address}`;
    if (holdingsAttempt.current === attempt) return;
    holdingsAttempt.current = attempt;
    // Repair a previously unavailable profile without replacing its deck position.
    void getWalletHoldings(currentWallet.address)
      .then((holdings) => {
        if (generation.current !== version) return;
        const update = (wallet: typeof currentWallet) =>
          wallet.address === currentWallet.address
            ? {
                ...wallet,
                currentHoldings: holdings.slice(0, 5),
                holdingsAvailable: true,
              }
            : wallet;
        useAppStore.setState((state) => ({
          live: {
            ...state.live,
            deck: state.live.deck.map(update),
            roster: state.live.roster.map((entry) => ({
              ...entry,
              wallet: update(entry.wallet),
            })),
          },
        }));
      })
      .catch(() => {
        /* Keep the explicit unavailable state until the next visit. */
      });
  }, [mode, ready, currentWallet]);
  useEffect(() => {
    if (!mode && hasApiKey()) store.setMode("live");
  }, [mode, store.setMode]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    const visible = () => {
      if (!document.hidden) setNow(Date.now());
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [tab, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const fn = () =>
      setToast(
        "Browser storage is full or unavailable. Changes will only last this visit.",
      );
    window.addEventListener("storage-unavailable", fn);
    return () => window.removeEventListener("storage-unavailable", fn);
  }, []);
  const loadDeck = useCallback(
    async (force = false) => {
      if (
        !mode ||
        !ready ||
        deckBusy.current ||
        (!force && Date.now() < deckRetryAt.current)
      )
        return;
      const current = useAppStore.getState()[mode];
      if (
        current.heldWalletAddress ||
        (!force && current.deckRefreshAt > Date.now())
      )
        return;
      const version = generation.current;
      deckBusy.current = true;
      setLoading(true);
      setDeckError("");
      setProgress(0);
      try {
        const wallets =
          mode === "demo"
            ? demoDeck()
                .filter(
                  (w) =>
                    !current.roster.some(
                      (r) => r.wallet.address === w.address,
                    ) &&
                    (!current.seenWallets[w.address.toLowerCase()] ||
                      current.seenWallets[w.address.toLowerCase()] <
                        Date.now() - DAY_MS),
                )
                .slice(0, DECK_SIZE)
            : await buildDeck(
                current.seenWallets,
                current.roster.map((r) => r.wallet.address),
                (n) => {
                  if (generation.current === version) setProgress(n);
                },
              );
        if (generation.current === version)
          useAppStore.getState().setDeck(mode, wallets);
      } catch (e) {
        if (generation.current === version) {
          setDeckError(
            e instanceof Error
              ? e.message
              : "Couldn’t load your prospects. Please retry.",
          );
          deckRetryAt.current = Date.now() + 60000;
        }
      } finally {
        if (generation.current === version) {
          deckBusy.current = false;
          setLoading(false);
        }
      }
    },
    [mode, ready],
  );
  const poll = useCallback(
    async (force = false) => {
      if (
        !mode ||
        !ready ||
        pollBusy.current ||
        (!force && Date.now() < pollRetryAt.current)
      )
        return;
      const current = useAppStore.getState()[mode];
      if (!current.roster.length) return;
      const signature = current.roster
        .map((r) => `${r.wallet.address}:${r.addedAt}`)
        .join(",");
      if (
        !force &&
        lastRoster.current === signature &&
        Date.now() - current.lastPolledAt < POLL_MS
      )
        return;
      const version = generation.current;
      pollBusy.current = true;
      setPolling(true);
      setPollError("");
      try {
        if (mode === "demo") {
          useAppStore
            .getState()
            .applyPoll(
              mode,
              demoSignals(current.roster),
              demoRosterUpdates(current.roster),
            );
        } else {
          const addresses = current.roster.map((r) => r.wallet.address);
          const [trades] = await Promise.allSettled([
            getWalletRecentTrades(addresses),
          ]);
          const holdings: Record<string, Holding[] | null> = {},
            updates: Record<string, RosterUpdate> = {};
          let incomplete = trades.status === "rejected";
          for (const entry of current.roster) {
            if (generation.current !== version) return;
            const [bags, summary] = await Promise.allSettled([
              getWalletHoldings(entry.wallet.address),
              getWalletPnlSummary(entry.wallet.address, entry.addedAt),
            ]);
            holdings[entry.wallet.address.toLowerCase()] =
              bags.status === "fulfilled" ? bags.value : null;
            updates[entry.wallet.address] = {
              addedAt: entry.addedAt,
              holdings: bags.status === "fulfilled" ? bags.value : null,
            };
            if (summary.status === "fulfilled" && summary.value)
              updates[entry.wallet.address].performance = sinceMatchPerformance(
                summary.value,
              );
            else incomplete = true;
            if (bags.status === "rejected") incomplete = true;
          }
          if (generation.current === version) {
            useAppStore
              .getState()
              .applyPoll(
                mode,
                trades.status === "fulfilled"
                  ? buildSignals(trades.value, holdings, addresses)
                  : [],
                updates,
              );
            if (incomplete)
              setPollError(
                "Some trades, holdings or performance figures couldn’t be refreshed. Last checked results are still shown.",
              );
          }
        }
        if (generation.current === version) lastRoster.current = signature;
      } catch (e) {
        if (generation.current === version) {
          setPollError(
            e instanceof Error
              ? e.message
              : "Couldn’t check your roster. Please retry.",
          );
          pollRetryAt.current = Date.now() + 60000;
        }
      } finally {
        if (generation.current === version) {
          pollBusy.current = false;
          setPolling(false);
        }
      }
    },
    [mode, ready],
  );
  useEffect(() => {
    if (!document.hidden) {
      void loadDeck();
      void poll();
    }
  }, [loadDeck, poll, now, rosterSignature]);
  const switchMode = (next: Mode, key = "") => {
    generation.current++;
    setApiKey(next === "live" ? key : "");
    if (next === "live" && !key && projectConnectionAvailable) useProjectKey();
    setKeyReady(next === "live" && hasApiKey());
    deckBusy.current = false;
    pollBusy.current = false;
    deckRetryAt.current = 0;
    pollRetryAt.current = 0;
    lastRoster.current = "";
    setLoading(false);
    setPolling(false);
    setDeckError("");
    setPollError("");
    setProgress(0);
    store.setMode(next);
    setSettings(false);
    setTab("scout");
    setNow(Date.now());
  };
  const copy = async (text: string, success = "Token address copied.") => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(success);
    } catch {
      setToast("Clipboard is unavailable in this browser.");
    }
  };
  const resetDemoSession = async () => {
    if (mode !== "demo") return;
    generation.current++;
    deckBusy.current = false;
    deckRetryAt.current = 0;
    setDeckError("");
    store.resetDemoSession();
    setTab("scout");
    setNow(Date.now());
    await loadDeck(true);
    setToast("Fresh demo stack ready. Your roster was preserved.");
  };
  const closeSettings = useCallback(() => setSettings(false), []),
    closeFull = useCallback(() => setFull(false), []),
    closeBreakup = useCallback(() => setBreaking(null), []);
  return (
    <AppFrame theme={theme}>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("scout");
          }}
          aria-label="Smartcrush home"
        >
          <span className="brand-mark">
            <Heart size={19} fill="currentColor" strokeWidth={0} />
          </span>
          <span className="brand-lockup">
            <span className="brand-wordmark">
              Smart<span>crush</span>
              <i>™</i>
            </span>
          </span>
        </a>
        <div className="header-right">
          <span className="chain-pill">
            <span /> ROBINHOOD
          </span>
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
      {ready && (
        <div className={`mode-banner ${mode === "demo" ? "demo" : ""}`}>
          <span>
            {mode === "demo"
              ? "DEMO MODE · FICTIONAL WALLETS"
              : "ROBINHOOD CHAIN SMART MONEY · POWERED BY NANSEN"}
          </span>
          {mode === "demo" && (
            <div className="mode-banner-actions">
              <button
                title="Load 20 fresh demo wallets and keep your roster"
                onClick={() => void resetDemoSession()}
              >
                Reset demo <RotateCcw size={11} />
              </button>
              <button onClick={() => setSettings(true)}>
                Go live <ArrowUpRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
      <main className="main-content" ref={main} id="main-content">
        {!ready ? (
          <Connection
            onConnect={(key) => switchMode("live", key)}
            onConfiguredConnect={
              configuredApiKey || projectConnectionAvailable
                ? () => switchMode("live", configuredApiKey)
                : undefined
            }
            onDemo={() => switchMode("demo")}
          />
        ) : (
          data && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    {tab === "scout" ? (
                      <>
                        Find My <em>Smartcrush</em>
                      </>
                    ) : tab === "roster" ? (
                      <>
                        My <em>Roster</em>
                      </>
                    ) : (
                      <>
                        Smartcrush <em>Signals</em>
                      </>
                    )}
                  </h1>
                  <p>
                    {tab === "scout"
                      ? "Swipe on 20 eligible smart wallets, and curate your own ultimate Smartcrush roster. Swipe again every 4 hours!"
                      : tab === "roster"
                        ? "Up to 10 Smartcrushes you're giving your attention to."
                        : "Hopefully not mixed. Keep up with the ones you fell for."}
                  </p>
                </div>
              </div>
              {((tab === "scout" && deckError) ||
                (tab !== "scout" && pollError)) && (
                <div className="error-banner" role="alert">
                  <AlertCircle size={18} />
                  <div>
                    <p>{tab === "scout" ? deckError : pollError}</p>
                    <button
                      onClick={() =>
                        tab === "scout" ? void loadDeck(true) : void poll(true)
                      }
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
              {tab === "scout" && (
                <>
                  {(!deckError || data.deck.length > 0 || loading) && (
                    <SwipeDeck
                      data={data}
                      loading={loading}
                      progress={progress}
                      onFull={() => {
                        store.swipe(
                          "right",
                          data.deck[data.deckPosition]?.address,
                        );
                        setFull(true);
                      }}
                      onSwipe={(direction) => {
                        const wallet = data.deck[data.deckPosition];
                        const result = store.swipe(direction, wallet?.address);
                        if (result === "full") setFull(true);
                        if (result === "matched" && wallet) setMatch(wallet);
                      }}
                      onCopy={(address) =>
                        void copy(address, "Wallet address copied.")
                      }
                    />
                  )}
                  <div className="scout-bottom">
                    <RosterCapacity count={data.roster.length} />
                  </div>
                </>
              )}
              {tab === "roster" && (
                <RosterList
                  key={mode}
                  roster={data.roster}
                  nicknames={data.nicknames}
                  loading={polling}
                  onRefresh={() => void poll(true)}
                  onNickname={(address, nickname) =>
                    mode && store.setNickname(mode, address, nickname)
                  }
                  onCopy={(address) =>
                    void copy(address, "Wallet address copied.")
                  }
                  onScout={() => setTab("scout")}
                  onBreakUp={setBreaking}
                />
              )}
              {tab === "signals" && (
                <SignalsFeed
                  data={data}
                  loading={polling}
                  demo={mode === "demo"}
                  onRefresh={() => void poll(true)}
                  onScout={() => setTab("scout")}
                  onCopy={(text) => void copy(text)}
                />
              )}
            </>
          )
        )}
      </main>
      {ready && data && (
        <TabBar tab={tab} onChange={setTab} count={data.roster.length} />
      )}
      {toast && (
        <div className="toast" role="status">
          <Heart size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {settings && mode && (
        <Modal title="Settings" onClose={closeSettings}>
          <SettingsMenu
            mode={mode}
            theme={theme}
            onModeChange={(next) => {
              if (next === mode) return;
              if (next === "live") switchMode("live", configuredApiKey);
              else switchMode("demo");
            }}
            onThemeChange={store.setTheme}
          />
        </Modal>
      )}
      {full && (
        <RosterFullModal
          onClose={closeFull}
          onRoster={() => {
            setFull(false);
            setFromFull(true);
            setTab("roster");
          }}
        />
      )}
      {match && <MatchModal wallet={match} onClose={() => setMatch(null)} />}
      {breaking && (
        <BreakUpModal
          address={breaking}
          nickname={data?.nicknames[breaking.toLowerCase()]}
          onClose={closeBreakup}
          onConfirm={() => {
            store.breakUp(breaking);
            setBreaking(null);
            setToast(
              fromFull
                ? "You’re single again. Go back to scouting!"
                : "A clean break. There are more wallets in the sea.",
            );
            setFromFull(false);
          }}
        />
      )}
    </AppFrame>
  );
}
