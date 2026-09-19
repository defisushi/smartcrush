# Smartcrush handoff — accepted Swipe page and next-session context

Prepared on **18 September 2026 (Asia/Singapore)** for a fresh implementation session.

**Workspace:** `/Users/lfgcap/Desktop/Nansen Smart Money`

**Live local preview:** `http://127.0.0.1:5173/`

## Start here

The root-level React/Vite application is the current product. Continue from the files in `src/`, `package.json`, `vite.config.ts`, and `index.html`.

The user is now **happy with the Swipe page** after an extended copy and visual-polish pass. Preserve that page unless the user requests another specific change. The likely next area of work is polishing the **Roster** and **Signals** pages to the same standard.

Do not restart from `CODEX_BUILD_PROMPT.md` or rebuild the earlier applications. That prompt remains useful background, but the current code and this handoff reflect many deliberate product decisions made afterward.

Legacy directories still exist:

- `backend/` is an older application. The current root app only reads `NANSEN_API_KEY` from `backend/.env` through the local Vite proxy.
- `frontend/` is an older nested Git repository and is not the current interface.
- Root-level `dist/` is the current production build output.
- The workspace root is not currently a Git repository; do not treat `frontend/.git` as version control for the root app.

Never print, copy, or commit the Nansen API key.

## Current browser state

At handoff time, the in-app browser is open at `http://127.0.0.1:5173/` in **demo mode**.

The demo state is stored in browser localStorage under `smart-crush-v1`. The user’s current demo roster contains **10 of 10 wallets**. A fresh 20-wallet demo stack was loaded using the **Reset demo** control, and the user continued reviewing from the first card. Because the roster is full, a right swipe will show the full-roster modal until at least one wallet is removed.

The demo banner includes a reusable **Reset demo** button. It:

- clears the current demo deck, position, refresh deadline, held candidate, and seen-wallet history;
- immediately loads 20 fresh fictional wallets;
- preserves the existing demo roster and signals;
- returns the user to the Swipe tab;
- shows a confirmation toast.

This control exists specifically to make repeated UI review easier.

## Run and verify

From the workspace root:

```sh
cd '/Users/lfgcap/Desktop/Nansen Smart Money'
npm install
npm run dev
```

The server uses strict port `5173`. It was already running when this handoff was written.

Routine verification:

```sh
npm test
npm run build
```

The latest recorded unit suite contains **11 tests**. A full browser regression suite exists but has not been rerun after the entire cosmetic-polish sequence:

```sh
# Terminal 1
npm run dev:test

# Terminal 2
npm run test:browser
```

The isolated browser suite uses port `5174` and does not consume Nansen credits.

## Product language rules

The approved product name is:

- Singular: **Smartcrush**
- Plural: **Smartcrushes**

Do not reintroduce `Smart Crush`, `SmartCrush`, `smart crush`, or lowercase `smartcrush` in user-facing copy. Internal identifiers such as the package name `smart-crush`, localStorage key, and CSS classes do not need renaming.

The bottom tabs are exactly:

- **Swipe**
- **Roster**
- **Signals**

The Swipe page should stay concise. The user repeatedly removed flavor text because it made the experience harder to understand.

## Accepted Swipe page

### Header and session progress

Current heading and supporting copy:

> Find My Smartcrush

> Swipe on 20 eligible smart wallets, and curate your own ultimate Smartcrush roster. Swipe again every 4 hours!

The deck header reads:

- **This Session’s Smartcrushes**
- **1 of 20** style progress

Both parts were enlarged for readability. There is no redundant `NO. 01` label on the card.

The bottom-menu Swipe heart is outline-only, matching the selected Roster and Signals icon style. The large right-swipe action remains a filled coral button with a filled cream heart.

### Wallet card

The wallet card currently shows:

1. Decorative profile cover with the label **ACTIVE IN THE LAST 24H**.
2. Truncated wallet address.
3. A **Copy** button that copies the full address and shows `Wallet address copied.` The button stops pointer propagation so it does not start a card drag.
4. Nansen wallet label, such as `30D Smart Trader` or `Fund`.
5. A two-column headline-stat row:
   - label above value: **WIN RATE**;
   - label above value: **REALIZED PNL**;
   - both columns centered;
   - vertical divider between columns;
   - horizontal divider above and below the row.
6. **Greatest Hits** with up to three token/ROI cards.
7. **Currently Into** with up to four token-name chips.

There is extra spacing below the wallet label before the headline-stat divider.

The three section dividers are intentional:

- above the Win Rate / Realized PNL row;
- below that row, which visually begins Greatest Hits;
- above Currently Into.

The following elements were deliberately removed and should stay removed unless the user asks otherwise:

- decorative verification check beside the wallet address;
- `Robinhood Chain` beside the wallet label because the chain is already shown in the app header;
- traded-token count;
- green trend arrow beside win rate;
- token-initial circles in Currently Into;
- per-card `NO. 01` numbering;
- `A little chemistry. A lot of alpha.` pill;
- `The exes that paid off` and `It’s complicated` section flavor labels;
- special first-place trophy beside the top ROI and its gold card treatment;
- hero sparkle decoration;
- extra hero/footer flavor copy removed during the cleanup.

The small trophy icon in the **Greatest Hits section heading** still exists as a section icon. The removed trophy was the ranking badge next to the first ROI multiple.

### Swipe controls

The visible action labels are **NOT MY TYPE** and **MY TYPE** at 9px, enlarged from the original tiny text.

- Reject button: light background with coral `X`.
- Match button: coral background with filled cream heart.
- Drag threshold: 85px.
- Swipe animation: 280ms unless reduced motion is enabled.
- Dragged cards rotate and show PASS/MATCH stamps.

### Roster-capacity preview beneath the card

The active Swipe page ends with a centered capacity display:

- `Roster: N/10`
- ten `UserRound` person icons;
- empty positions use a gray outline;
- occupied positions turn coral and use coral fill;
- `You may have a roster of up to 10 Smartcrushes.`

There is 40px of top padding before this block so it reads separately from the swipe buttons. The former green dot and the `Fresh faces in …` footer countdown were removed.

### End-of-session state

After all cards have been reviewed, the deck shows:

- an hourglass icon instead of the default heart-and-sparkles empty-state artwork;
- title: **You’ve met everyone. For now.**
- two adjacent lines with no paragraph gap:

  > That’s your 20 Smartcrushes this session.  
  > Come back later to meet fresh faces!

- a live countdown including seconds, such as `1h 33m 42s`.

The previous `Until your next date with the deck.` line was removed.

## Match and capacity modals

All dialogs use the shared `Modal` component, which traps focus, closes on Escape/backdrop click, and restores previous focus.

### Successful match modal

Every successful right swipe opens a proper centered modal instead of the former match toast.

Title:

> It’s a Match!

Copy:

> Smartcrush 0x1234…abcd is now on your roster.

It shows:

- Win Rate and Realized PNL in centered equal-width columns;
- labels above values;
- Currently Into token chips;
- a **Keep swiping** button.

On entry, the modal:

- pops and jiggles for 460ms;
- emits a one-time 20-piece confetti burst;
- disables both animations under `prefers-reduced-motion: reduce`.

The matched wallet is captured before the deck advances so the modal always displays the correct profile.

### Full-roster modal

This modal is centered to match the successful-match modal.

Title:

> Your roster is full!

Body:

> So many crushes, so little room.

> Break up with at least 1 Smartcrush to make room for this newer, hotter one. We’ll keep this prospect right here for you.

Actions:

- **Make room in my roster**
- **Keep swiping**

When a full roster rejects a right swipe, the candidate is held in `heldWalletAddress`; it is not silently lost while the user makes room.

### Breakup modal

This modal is also centered.

Title:

> It’s not you. It’s me.

Body:

> Break up with 0x1234…abcd? You sure?  
> You might not see them again. :(

The second sentence is intentionally on its own line. The broken-heart icon sits between title and copy.

## Data meaning on the Swipe card

### Discovery and activity label

Live candidates come from Nansen Smart Money DEX trades on `robinhood`. Discovery uses the trailing 24-hour API window. The `ACTIVE IN THE LAST 24H` tag communicates why the candidate entered the deck; it is not an identity-verification badge.

### Win Rate and Realized PNL

Both values come from the Nansen address PnL summary. Headline requests currently use an epoch-to-now date range to include all available Robinhood-chain history. Nansen’s actual indexed coverage controls the real scope.

### Greatest Hits

`top5_tokens` winners and detailed realized ROI are normalized, sorted by ROI multiple, and retained up to five. The card displays the top three. All three now use equal visual treatment; there is no first-place threshold or special prize.

### Currently Into

Live holdings come from the Nansen address PnL endpoint with `show_realized: false`.

Rules:

- `holding_amount > 0`;
- ordered by `holding_usd` descending;
- up to five retained per wallet;
- up to four displayed on the card;
- no minimum USD value, ROI threshold, age filter, or token-quality filter.

If holdings fail to load, the profile remains usable and the UI says current bags are unavailable. Demo wallets have three deterministic fictional holdings.

### Address “verification”

The removed check mark never represented verification. A live address comes from Nansen discovery, but the app does not verify identity, ownership, reputation, or a special Nansen status. Demo addresses are fictional.

## Session and persistence rules

Core constants in `src/utils/constants.ts`:

| Rule | Value |
| --- | ---: |
| Deck size | 20 |
| Roster capacity | 10 |
| Session duration | 4 hours |
| Signal poll interval | 1 hour |
| Seen-wallet exclusion | 24 hours |
| Storage key | `smart-crush-v1` |

Demo and live state are stored separately. Persisted state includes deck, position, refresh deadline, seen-wallet timestamps, roster, signals, held candidate, and last poll time.

The **Reset demo** action intentionally clears the demo seen-wallet history to support design review. Normal session refreshes preserve rolling seen-wallet exclusion.

## Live Nansen integration

The root Vite app reads `NANSEN_API_KEY` from `backend/.env` only while serving locally. The browser receives a proxy-availability boolean, not the key. Requests go through `/api/nansen` and the proxy injects the credential.

Allowed live endpoints:

- `POST /api/v1/smart-money/dex-trades`
- `POST /api/v1/profiler/address/pnl-summary`
- `POST /api/v1/profiler/address/pnl`

Requests are serialized and rate-limited in `src/services/nansen.ts`. HTTP 429 and server errors retry with backoff. Live profile hydration uses discovery, summary, realized-PnL detail, and holdings.

Production builds expect the serverless proxy under `api/nansen`; a purely static host cannot safely supply the project key. Do not claim the static bundle alone provides secure live data.

## Current file map

| File | Current role |
| --- | --- |
| `src/App.tsx` | Mode switching, deck loading, polling, tab content, reset-demo action, roster-capacity display, toasts, and modal state. |
| `src/components/SwipeDeck.tsx` | Loading/empty/end states, session progress, drag gestures, pass/match buttons. |
| `src/components/SwipeCard.tsx` | Accepted card design and wallet copy action. |
| `src/components/MatchModal.tsx` | Successful-match content, jiggle, and confetti. |
| `src/components/RosterFullModal.tsx` | Full-capacity dialog and held-candidate flow. |
| `src/components/BreakUpModal.tsx` | Centered breakup confirmation. |
| `src/components/RosterList.tsx` / `RosterEntry.tsx` | Roster screen; likely next visual-polish target. |
| `src/components/SignalsFeed.tsx` / `SignalCard.tsx` | Signals screen; likely next visual-polish target. |
| `src/store/useAppStore.ts` | Persisted sessions, swipe transitions, roster limit, reset-demo action, breakups, signal merging. |
| `src/services/nansen.ts` | Nansen client, pagination, hydration, normalization, and retry behavior. |
| `src/services/demo.ts` | Sixty fictional profiles and deterministic demo signals. |
| `src/index.css` | Fixed-width mobile interface and all accepted visual styling. |

## Known follow-up areas

1. **Roster and Signals visual polish:** These screens still contain more small labels and older copy than the accepted Swipe page. Review them with the same simplification and readability standard, but do not change financial meaning without checking the underlying data.
2. **README drift:** `README.md` still mentions the removed traded-token count and says the prior `backend/` directory is unused without immediately clarifying the `backend/.env` exception. Update it when documentation is next in scope.
3. **Browser regression:** Run `npm run test:browser` after the next functional change. The recent work has been validated repeatedly with TypeScript/Vite builds, unit tests at major checkpoints, and live visual inspection, but the complete browser suite predates the final cosmetic pass.
4. **Production proxy:** Confirm the serverless deployment path and secret handling before public deployment.
5. **Roster-full review:** The current demo browser roster is 10/10. To see the match modal again, remove a wallet first or use an isolated test context.

## Recommended next-session opening

1. Read this file.
2. Confirm the preview is still available at `http://127.0.0.1:5173/`.
3. Run `npm test` and `npm run build` if code changed after this handoff.
4. Preserve the Swipe page’s accepted design.
5. Ask the user which screen to polish next only if they have not already specified it; otherwise begin with their requested Roster or Signals change.

