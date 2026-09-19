# Smart Money Tinder — Build Spec for Codex

## Overview

Build a **mobile-only web app** using React that lets users browse smart money wallets on Robinhood chain (via Nansen API) in a Tinder-style swipe interface. Users scout wallet "dating profiles," swipe right to add wallets to their curated **roster** (up to 10), and then monitor their roster's trades via a signals feed.

The app is fun, silly, and dating-app-themed. The language throughout is dating metaphors — swiping on suitors, building a roster of suitors, breaking up with underperformers, etc.

---

## Mobile-Only Layout

The app must render at **mobile phone dimensions at all times**, even on desktop/laptop screens.

- **Frame width: 390px** (iPhone 15 standard)
- **Frame height: 100vh** within the 390px container
- On viewports wider than 390px, center the app frame horizontally with a dark/black background filling the rest of the viewport
- All UI is designed for touch: large tap targets, swipe gestures, no hover-dependent interactions
- No responsive breakpoints — the app is always 390px wide

```css
/* Root layout concept */
body {
  background: #0a0a0a;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
}

.app-frame {
  width: 390px;
  max-width: 390px;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  position: relative;
}
```

---

## Three Screens

The app has three screens accessible via a bottom tab bar:

### Tab Bar
- **Scout** (left) — the swipe deck
- **Roster** (center) — your curated wallets
- **Signals** (right) — trade activity from your roster

Use dating-app-appropriate icons (e.g., cards/heart for Scout, people/group for Roster, lightning/bell for Signals).

---

## Screen 1: Scout (The Deck)

### Core Mechanic
A Tinder-style card stack. One wallet profile card visible at a time, with the next card peeking behind it. The user swipes left to **pass** or right to **add to roster**.

### Card Content — "The Dating Profile"
Each card displays a wallet's profile in a fun, dating-profile-inspired layout:

**Header:**
- Wallet address (truncated: `0x1a2b...9f3d`) — styled like a username
- Nansen label if available (e.g., "Smart Trader", "Fund") — styled like a dating profile tagline

**Headline Stats** (prominent, top of card):
- **Win Rate**: e.g., "73% Win Rate" — large, bold
- **Total Realized PnL**: e.g., "+$847,291" — with green/red color coding
- **Tokens Traded**: e.g., "142 tokens"

**Trophy Case** — "Greatest Hits" section:
- Show the top 3-5 biggest winning trades by ROI multiple
- Format: token symbol + ROI, e.g., "CASHCAT — 142x 🏆", "PONS — 89x", "PIPEDOG — 34x"
- These come from the `top5_tokens` field in the PnL summary, cross-referenced with PnL detail for the ROI

**"Currently Into..."** section:
- What they're holding right now (from Holdings endpoint)
- Show top 3-5 tokens by USD value with token symbols

**Card Visual Style:**
- Rounded corners, card shadow, white/dark card on a themed background
- Should feel like a real dating app profile card
- Subtle gradient or accent color at the top of the card

### Swipe Interaction
- **Swipe left**: card animates off-screen left, "PASS" stamp appears briefly, next card slides in
- **Swipe right**: card animates off-screen right, "MATCH 💕" stamp appears briefly
  - If roster has room (< 10): wallet is added to roster, next card slides in
  - If roster is full (10): show a modal/overlay: *"Your roster is full! Go to your Roster and break up with someone first."* with a button linking to the Roster tab. **Hold the deck position** — when the user returns from Roster after freeing a slot, they resume on the same card they were trying to add.
- Also support tap buttons below the card: ❌ (pass) and 💚 (add) for users who prefer tapping

### Session Mechanics
- **20 cards per session**
- Sessions refresh every **4 hours**
- Show a progress indicator: "Card 7 of 20"
- When all 20 are swiped, show an empty state: *"No more prospects right now. Check back in [countdown timer]."* with a flirty/playful tone
- Track which wallets have been shown to the user across sessions — don't repeat a wallet until the pool has been cycled through, or at minimum not within the same day

### Data Flow
1. On session start (or every 4 hours), call Nansen Smart Money DEX Trades for `chains: ["robinhood"]` to discover active smart wallet addresses
2. Deduplicate wallet addresses from the trades
3. For each unique wallet (up to 20), call the PnL Summary endpoint to hydrate the card's headline stats and trophy case
4. Optionally call Holdings filtered by wallet address for the "Currently Into" section
5. Cache the 20 hydrated profiles for the session duration

---

## Screen 2: Roster

### Layout
A list/grid of the user's curated wallets (up to 10 slots). Shows all roster members with summary info and a way to manage them.

### Each Roster Entry Shows:
- Wallet address (truncated) + Nansen label
- Win rate and total PnL (from when they were scouted)
- **Performance since added**: track their realized PnL from the date the user added them to roster vs. now. Label this "Since you matched: +$12,400" or similar dating language
- A mini "greatest hits" — their top 1-2 multiples
- **"Break Up" button** — removes the wallet from the roster, freeing a slot

### Break Up Flow
- Tap "Break Up 💔" on a roster entry
- Confirm modal: *"Are you sure you want to break up with 0x1a2b...9f3d? You might not see them again."*
- On confirm: wallet is removed from roster, slot opens up
- If the user came here from a full-roster prompt on the Scout screen, after breaking up show a subtle toast: *"You're single again. Go back to scouting!"* — they can tap back to the Scout tab and resume their deck exactly where they left off

### Empty State
When the roster is empty: *"Your roster is empty. Head to Scout to find your first match!"*

### Aggregate Stats (Top of Page)
- **Roster size**: "7 / 10 slots filled"
- **Combined roster win rate** (average of all roster wallets' win rates)
- **Total roster PnL since inception** (sum of all wallets' PnL since each was added)

---

## Screen 3: Signals Feed

### Layout
A reverse-chronological feed of trades made by wallets on the user's roster. This is the actionable output of the curation process.

### Each Signal Card Shows:
- **Which roster wallet** made the trade (address + label)
- **Action**: "Bought" or "Sold"
- **Token**: symbol + token address
- **Size**: amount in USD and token quantity
- **When**: relative timestamp ("2h ago", "45m ago")
- **Context badge**: "New Position 🆕" (first time buying this token), "Adding More ➕" (already held, buying more), "Taking Profit 📤" (selling partial), "Full Exit 🚪" (selling entire position)

### Signal Card Actions
- **"Copy This Trade"** button: opens a deep link to a DEX on Robinhood chain (e.g., Uniswap on Arbitrum / whatever the primary DEX on Robinhood chain is) pre-populated with the token address if possible, or at minimum navigates to the DEX with the token
- **"Auto-Copy" toggle**: grayed out / coming soon badge for v1. Placeholder for future auto-execution feature

### Polling
- **Free tier**: poll roster wallets' trades every **60 minutes**
- **Premium placeholder**: badge/label showing "Upgrade to 15-min signals" (non-functional in v1, just the UI treatment)
- Show "Last updated: X minutes ago" at the top of the feed
- Show a manual "Refresh" pull-to-refresh or button

### Empty State
- If roster is empty: *"Add wallets to your roster first to see what they're up to."*
- If roster has wallets but no recent trades: *"Your roster has been quiet. No new moves detected."*

### Data Flow
1. On each poll interval, for each wallet in roster: call Smart Money DEX Trades filtered by `trader_address` for that wallet on Robinhood chain
2. Compare with previously seen trades (by transaction_hash) to identify new ones
3. Display new trades as signal cards
4. To determine context badges (new position vs. adding vs. exit), cross-reference with the wallet's Holdings

---

## Nansen API Integration

### Base URL
```
https://api.nansen.ai
```

### Authentication
All requests include the header:
```
apikey: <NANSEN_API_KEY>
```

The API key is stored in a `.env` file:
```
NANSEN_API_KEY=your_key_here
```

### Rate Limits
- Free plan: 15 req/s, 300 req/min
- Paid plan: 75 req/s, 1500 req/min
- Handle 429 responses by respecting the `Retry-After` header

### Endpoints Used

#### 1. Smart Money DEX Trades (Discovery + Signal Monitoring)
```
POST /api/v1/smart-money/dex-trades
```

**For discovery (building the 20-card deck):**
```json
{
  "chains": ["robinhood"],
  "filters": {
    "include_smart_money_labels": ["Smart Trader", "30D Smart Trader", "90D Smart Trader", "180D Smart Trader"]
  },
  "pagination": { "page": 1, "per_page": 1000 },
  "order_by": [{ "field": "trade_value_usd", "direction": "DESC" }]
}
```

**For signal monitoring (polling roster wallets):**
```json
{
  "chains": ["robinhood"],
  "filters": {
    "trader_address": ["0xWalletAddress1", "0xWalletAddress2"]
  },
  "pagination": { "page": 1, "per_page": 100 },
  "order_by": [{ "field": "block_timestamp", "direction": "DESC" }]
}
```

**Response fields used:**
- `trader_address`, `trader_address_label` — wallet identity
- `token_bought_symbol`, `token_sold_symbol` — what they traded
- `token_bought_address`, `token_sold_address` — token contract
- `trade_value_usd` — trade size
- `block_timestamp` — when
- `transaction_hash` — dedup key

**Important limitation:** This endpoint only returns the trailing 24 hours of trades. Plan the deck refresh and signal polling accordingly.

#### 2. Profiler PnL Summary (Card Headline Stats)
```
POST /api/v1/profiler/address/pnl-summary
```

**Request:**
```json
{
  "address": "0xWalletAddress",
  "chain": "robinhood"
}
```

**Response fields used:**
- `win_rate` — headline win rate percentage
- `realized_pnl_usd` — total realized profit/loss
- `realized_pnl_percent` — PnL as percentage
- `traded_token_count` — number of distinct tokens traded
- `traded_times` — total number of trades
- `top5_tokens` — array of best trades:
  - `token_symbol`, `token_address`, `realized_pnl`, `realized_roi`

#### 3. Profiler PnL Detail (Trophy Case Deep Dive)
```
POST /api/v1/profiler/address/pnl
```

**Request:**
```json
{
  "address": "0xWalletAddress",
  "chain": "robinhood",
  "filters": { "show_realized": true },
  "pagination": { "page": 1, "per_page": 10 },
  "order_by": [{ "field": "roi_percent_realised", "direction": "DESC" }]
}
```

**Response fields used:**
- `token_symbol`, `token_address` — which token
- `roi_percent_realised` — the X multiple (divide by 100 and add 1 to get "Nx")
- `pnl_usd_realised` — dollar profit on this token
- `bought_usd`, `sold_usd` — total capital in/out
- `holding_amount`, `holding_usd` — still holding?
- `nof_buys`, `nof_sells` — trade count

#### 4. Smart Money Holdings (Current Bags)
```
POST /api/v1/smart-money/holdings
```

This endpoint returns aggregate holdings across all smart money, not per-wallet. For per-wallet current holdings, use the PnL Detail endpoint filtered to show unrealized positions:

```json
{
  "address": "0xWalletAddress",
  "chain": "robinhood",
  "filters": { "show_realized": false },
  "pagination": { "page": 1, "per_page": 10 },
  "order_by": [{ "field": "holding_usd", "direction": "DESC" }]
}
```

This gives current token positions with `holding_amount`, `holding_usd`, and unrealized PnL.

---

## Data Model (Client-Side State)

Use React state management (Context + useReducer, or Zustand — keep it simple). Persist to localStorage so state survives page refreshes.

```typescript
interface AppState {
  // Deck / Scouting
  deck: WalletProfile[];          // current 20 cards
  deckPosition: number;           // index of current card (0-19)
  deckRefreshAt: number;          // timestamp when next 20 cards are available
  seenWallets: Set<string>;       // wallet addresses already shown (across sessions)

  // Roster
  roster: RosterEntry[];          // up to 10 curated wallets

  // Signals
  signals: Signal[];              // trade signals from roster wallets
  seenTxHashes: Set<string>;      // dedup for signals
  lastPolledAt: number;           // last poll timestamp
  pollInterval: number;           // 3600000 (60min) or 900000 (15min premium)
}

interface WalletProfile {
  address: string;
  label: string | null;           // Nansen smart money label
  winRate: number;                // 0-1
  realizedPnlUsd: number;
  realizedPnlPercent: number;
  tradedTokenCount: number;
  tradedTimes: number;
  topTokens: TopToken[];          // best trades by ROI
  currentHoldings: Holding[];     // what they hold now
}

interface TopToken {
  symbol: string;
  address: string;
  realizedRoi: number;            // as multiple (e.g., 142 = 142x)
  realizedPnl: number;            // USD profit
}

interface Holding {
  symbol: string;
  address: string;
  holdingUsd: number;
  holdingAmount: number;
  unrealizedRoi: number | null;
}

interface RosterEntry {
  wallet: WalletProfile;
  addedAt: number;                // timestamp when user swiped right
  pnlSinceAdded: number | null;  // tracked over time
}

interface Signal {
  walletAddress: string;
  walletLabel: string | null;
  action: 'buy' | 'sell';
  tokenSymbol: string;
  tokenAddress: string;
  amountUsd: number;
  timestamp: string;              // block_timestamp
  txHash: string;
  contextBadge: 'new_position' | 'adding' | 'taking_profit' | 'full_exit';
}
```

---

## API Layer Architecture

Create a service module (`src/services/nansen.ts`) that wraps all Nansen API calls:

```typescript
// All calls go through this base fetcher
async function nansenPost<T>(endpoint: string, body: object): Promise<T> {
  const res = await fetch(`https://api.nansen.ai${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_NANSEN_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    // implement retry logic
  }

  if (!res.ok) throw new Error(`Nansen API ${res.status}`);
  return res.json();
}

// Exported functions:
// discoverSmartWallets() — calls dex-trades for robinhood chain, returns unique wallet addresses
// getWalletPnlSummary(address) — calls pnl-summary
// getWalletPnlDetail(address) — calls pnl for top realized trades
// getWalletHoldings(address) — calls pnl for unrealized positions
// getWalletRecentTrades(addresses[]) — calls dex-trades filtered by addresses for signal monitoring
```

---

## Key UX Details

### Swipe Animation
Use a swipe gesture library (react-tinder-card, @use-gesture/react + react-spring, or framer-motion). The card should:
- Follow the user's finger/cursor during drag
- Rotate slightly in the direction of the swipe
- Show a "PASS" or "MATCH 💕" stamp that fades in as the card moves past a threshold
- Snap back if released before the threshold
- Animate off-screen if released past the threshold

### Color Palette / Theme
Dating-app-inspired. Think warm, inviting, slightly playful:
- Background: dark (#0f0f0f or deep purple/navy)
- Cards: white or very light (#fafafa) in light, dark (#1a1a1a) in dark mode
- Accent: a warm pink/coral (#FF6B6B) for the "match" action and highlights
- Pass: a muted gray
- Green for profit, red for loss (standard financial colors)
- Use one Google Font for personality (e.g., Plus Jakarta Sans or similar)

### Empty States & Microcopy
Every empty state should have dating-themed copy:
- Empty deck: "No more prospects right now. Check back in 3h 42m ⏰"
- Empty roster: "Still single? Head to Scout and find your first match! 💘"
- Empty signals: "Your roster's been quiet. Maybe they're playing hard to get. 🤷"
- Full roster rejection: "Your roster is full! Break up with someone to make room for this one. 💔"

### Loading States
- Card loading: show a skeleton card with pulsing placeholders
- Signals loading: skeleton list items
- Roster loading: skeleton entries

---

## Edge Cases to Handle

1. **Fewer than 20 smart wallets active on Robinhood chain**: Show however many are available. If zero, show: "No smart money spotted on Robinhood chain right now. Try again later."

2. **PnL Summary returns empty for a wallet**: Skip this wallet in the deck, pull the next one. Don't show cards with no data.

3. **Wallet goes inactive after being added to roster**: Keep them on roster, but their signals section will just be quiet. Let the user decide to break up.

4. **DEX Trades only has 24h window**: This means the deck discovery will only find wallets active in the last 24 hours. This is fine — it means the deck naturally refreshes with current actors. For signals, it means we can only catch trades within that 24h window per poll.

5. **User clears localStorage**: Roster and deck state are lost. Show the onboarding/empty state. This is acceptable for v1 — no backend persistence.

6. **API key not set**: Show a setup screen prompting the user to add their Nansen API key. Store it in the app's local state (or env).

---

## File Structure

```
src/
├── App.tsx                    # Main app with tab navigation
├── main.tsx                   # Entry point
├── index.css                  # Global styles + mobile frame
├── components/
│   ├── AppFrame.tsx           # The 390px mobile container
│   ├── TabBar.tsx             # Bottom navigation
│   ├── SwipeCard.tsx          # Individual wallet profile card
│   ├── SwipeDeck.tsx          # Card stack + swipe mechanics
│   ├── RosterList.tsx         # Roster entries list
│   ├── RosterEntry.tsx        # Individual roster wallet card
│   ├── SignalsFeed.tsx        # Signals feed list
│   ├── SignalCard.tsx         # Individual signal entry
│   ├── BreakUpModal.tsx       # Confirm break up dialog
│   ├── RosterFullModal.tsx    # "Roster is full" prompt
│   ├── CountdownTimer.tsx     # Deck refresh countdown
│   ├── EmptyState.tsx         # Reusable empty state component
│   └── SkeletonCard.tsx       # Loading skeleton
├── services/
│   └── nansen.ts              # All Nansen API calls
├── store/
│   └── useAppStore.ts         # State management (Zustand or Context)
├── types/
│   └── index.ts               # TypeScript interfaces
├── utils/
│   ├── formatters.ts          # Address truncation, PnL formatting, etc.
│   └── constants.ts           # Magic numbers, timing constants
├── .env                       # VITE_NANSEN_API_KEY=xxx
└── vite.config.ts
```

---

## Tech Stack

- **React 18+** with TypeScript
- **Vite** for build tooling
- **Framer Motion** or **react-spring + @use-gesture/react** for swipe animations
- **Zustand** for state management (lightweight, simple API)
- **date-fns** or similar for relative timestamps
- No backend — client-side only, API calls directly to Nansen from the browser
- localStorage for persistence

---

## What NOT to Build in v1

- No authentication / user accounts
- No backend server
- No auto-copy execution (just the "Coming Soon" placeholder)
- No premium tier logic (just the UI badge for 15m polling)
- No wallet connection (Web3 wallet integration)
- No push notifications
- No historical performance tracking beyond what Nansen provides
- No social features (sharing roster, leaderboards, etc.)

These are all v2+ features. v1 is the fun, functional swipe-and-monitor loop.

---

## Summary of API Call Flow

### On App Load
1. Check if deck needs refresh (4h expired or no deck)
2. If yes: `discoverSmartWallets()` → get unique addresses → `getWalletPnlSummary()` for each (up to 20) → `getWalletPnlDetail()` for trophy case → `getWalletHoldings()` for current bags → build deck
3. Load roster from localStorage
4. If roster has wallets: `getWalletRecentTrades(rosterAddresses)` → build initial signals feed

### On Swipe Right (Add to Roster)
1. Add wallet to roster in state + localStorage
2. Immediately include this wallet in next signal poll

### On Break Up
1. Remove wallet from roster in state + localStorage
2. Remove their signals from the feed

### On Poll Interval (every 60min)
1. `getWalletRecentTrades(rosterAddresses)` → compare with `seenTxHashes` → add new signals to feed
