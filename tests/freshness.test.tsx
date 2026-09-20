import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptySession, useAppStore } from "../src/store/useAppStore";
import { demoDeck, demoRosterUpdates } from "../src/services/demo";
import { freshnessLabel, rosterFreshness } from "../src/utils/freshness";
import { SignalsFeed } from "../src/components/SignalsFeed";
import { RosterEntry } from "../src/components/RosterEntry";
import type { SessionData } from "../src/types";

const start = Date.parse("2026-09-21T00:00:00Z");
const saved = new Map<string, string>();
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(start);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => saved.set(k, v),
    removeItem: (k: string) => saved.delete(k),
  });
  vi.stubGlobal("window", new EventTarget());
  saved.clear();
  useAppStore.setState({
    mode: "demo",
    demo: emptySession(),
    live: emptySession(),
  });
  useAppStore.getState().setDeck("demo", demoDeck());
  useAppStore.getState().swipe("right");
  useAppStore.getState().swipe("right");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const session = () => useAppStore.getState().demo;
const refresh = () =>
  useAppStore
    .getState()
    .applyPoll("demo", [], demoRosterUpdates(session().roster), true);
const feed = (data: SessionData) =>
  renderToStaticMarkup(
    <SignalsFeed
      data={data}
      loading={false}
      demo
      onRefresh={() => {}}
      onScout={() => {}}
      onCopy={() => {}}
    />,
  );

describe("refresh truthfulness", () => {
  it("retains successful times and persists a total failure across reload", async () => {
    refresh();
    vi.mocked(Date.now).mockReturnValue(start + 3600000);
    useAppStore
      .getState()
      .applyPoll(
        "demo",
        [],
        Object.fromEntries(
          session().roster.map((r) => [
            r.wallet.address,
            { addedAt: r.addedAt, holdings: null },
          ]),
        ),
        false,
      );
    expect(session().lastPolledAt).toBe(start + 3600000);
    expect(session().signalsUpdatedAt).toBe(start);
    expect(session().signalsRefreshStatus).toBe("failed");
    expect(rosterFreshness(session().roster)).toEqual({
      status: "failed",
      checkedAt: start,
    });
    await useAppStore.persist.rehydrate();
    expect(session().signalsRefreshStatus).toBe("failed");
    expect(feed(session())).toContain("Refresh failed · Last checked 1h ago");
    expect(feed(session())).toContain("Recent activity is unavailable");
    expect(feed(session())).not.toContain("Your roster’s been quiet");
  });
  it("does not let a newly refreshed wallet mask older failed performance", () => {
    refresh();
    vi.mocked(Date.now).mockReturnValue(start + 3600000);
    const updates = demoRosterUpdates(session().roster);
    delete updates[session().roster[1].wallet.address].performance;
    useAppStore.getState().applyPoll("demo", [], updates, true);
    const freshness = rosterFreshness(session().roster);
    expect(freshness).toEqual({ status: "partial", checkedAt: start });
    expect(freshnessLabel(freshness.status, freshness.checkedAt)).toBe(
      "Partially refreshed · Oldest check 1h ago",
    );
    expect(session().signalsRefreshStatus).toBe("complete");
    expect(session().signalsUpdatedAt).toBe(start + 3600000);
  });
  it("reports successful trades separately from failed holdings context and recovers", () => {
    refresh();
    vi.mocked(Date.now).mockReturnValue(start + 3600000);
    const updates = demoRosterUpdates(session().roster);
    updates[session().roster[0].wallet.address].holdings = null;
    useAppStore.getState().applyPoll("demo", [], updates, true);
    expect(session().signalsRefreshStatus).toBe("partial");
    expect(feed(session())).toContain(
      "Trades checked just now · Context incomplete",
    );
    expect(rosterFreshness(session().roster)).toEqual({
      status: "partial",
      checkedAt: start,
    });
    refresh();
    expect(session().signalsRefreshStatus).toBe("complete");
    expect(rosterFreshness(session().roster)).toEqual({
      status: "complete",
      checkedAt: start + 3600000,
    });
  });
  it("counts a successful empty trade response as a check and keeps roster success independent of trade failure", () => {
    refresh();
    expect(session().signalsUpdatedAt).toBe(start);
    expect(feed(session())).toContain("No new moves detected");
    vi.mocked(Date.now).mockReturnValue(start + 3600000);
    useAppStore
      .getState()
      .applyPoll("demo", [], demoRosterUpdates(session().roster), false);
    expect(session().signalsUpdatedAt).toBe(start);
    expect(rosterFreshness(session().roster)).toEqual({
      status: "complete",
      checkedAt: start + 3600000,
    });
  });
  it("does not invent a successful check for older persisted signal caches", async () => {
    const prior = {
      ...useAppStore.getState(),
      demo: {
        ...session(),
        lastPolledAt: start,
        signalsUpdatedAt: undefined,
        signalsRefreshStatus: undefined,
      },
    };
    const migrated = (await useAppStore.persist.getOptions().migrate!(
      prior,
      5,
    )) as ReturnType<typeof useAppStore.getState>;
    expect(migrated.demo.signalsUpdatedAt).toBe(0);
    expect(migrated.demo.signalsRefreshStatus).toBe("idle");
    expect(migrated.demo.lastPolledAt).toBe(0);
    expect(migrated.demo.roster).toEqual(prior.demo.roster);
  });
  it("labels the fixed baseline as discovery while keeping since-match performance", () => {
    const html = renderToStaticMarkup(
      <RosterEntry
        entry={session().roster[0]}
        expanded
        loading={false}
        onToggle={() => {}}
        onNickname={() => {}}
        onCopy={() => {}}
        onBreakUp={() => {}}
      />,
    );
    expect(html).toContain("Stats At Discovery");
    expect(html).toContain("added to your swipe deck");
    expect(html).toContain("since matching");
    expect(html).not.toContain("at matching");
    expect(html).not.toContain("first swiped");
  });
});
