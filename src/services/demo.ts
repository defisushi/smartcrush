import type {
  WalletProfile,
  RosterEntry,
  RosterUpdate,
  Signal,
} from "../types";
const symbols = [
  "CASHCAT",
  "PONS",
  "PIPEDOG",
  "HOOD",
  "MOON",
  "CHERRY",
  "PEPE",
  "AURA",
];
export const demoAddress = (i: number) =>
  `0x${(i * 731 + 6738).toString(16).slice(-4).padStart(4, "0")}${"0".repeat(32)}${(i * 311 + 40765).toString(16).slice(-4).padStart(4, "0")}`;
export function demoDeck(): WalletProfile[] {
  return Array.from({ length: 60 }, (_, i) => ({
    address: demoAddress(i),
    label: ["Smart Trader", "90D Smart Trader", "Fund", "30D Smart Trader"][
      i % 4
    ],
    winRate: [0.73, 0.81, 0.68, 0.92, 0.64][i % 5],
    realizedPnlUsd: i === 4 ? -18420 : 847291 - i * 32417,
    realizedPnlPercent: 420 - i * 11,
    tradedTokenCount: 142 + i * 7,
    tradedTimes: 329 + i * 23,
    topTokens: [142, 89, 34].map((roi, j) => ({
      symbol: symbols[(i + j) % symbols.length],
      address: demoAddress(100 + ((i + j) % 8)),
      realizedRoi: Math.max(1.2, roi - i * 1.3),
      realizedPnl: 124000 / (j + 1),
    })),
    currentHoldings: [0, 1, 2].map((j) => ({
      symbol: symbols[(i + j + 3) % symbols.length],
      address: demoAddress(100 + ((i + j + 3) % 8)),
      holdingUsd: 36000 / (j + 1),
      holdingAmount: 120000 / (j + 1),
      unrealizedRoi: 23,
    })),
    holdingsAvailable: true,
  }));
}
export function demoSignals(roster: RosterEntry[]): Signal[] {
  return roster
    .flatMap(({ wallet, addedAt }, i) =>
      [0, 1].map((j) => ({
        id: `demo-${wallet.address}-${j}`,
        walletAddress: wallet.address,
        walletLabel: wallet.label,
        action: j === 0 ? ("buy" as const) : ("sell" as const),
        tokenSymbol: symbols[(i + j + 3) % symbols.length],
        tokenAddress: demoAddress(100 + ((i + j + 3) % 8)),
        amountUsd: 12400 - i * 420 + j * 5600,
        quantity: 48000 + i * 1200,
        timestamp: new Date(
          addedAt - (i * 7 + j * 43 + 3) * 60000,
        ).toISOString(),
        txHash: `0x${(i + j + 1).toString(16).padStart(64, "0")}`,
        contextBadge:
          j === 0 ? ("new_position" as const) : ("taking_profit" as const),
      })),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Fictional period performance, stable per address so sorting never changes the data.
export function demoRosterUpdates(
  roster: RosterEntry[],
): Record<string, RosterUpdate> {
  return Object.fromEntries(
    roster.map((entry) => {
      const seed = parseInt(entry.wallet.address.slice(2, 6), 16) % 6;
      const sales = [12, 8, 5, 15, 9, 0][seed];
      return [
        entry.wallet.address,
        {
          addedAt: entry.addedAt,
          performance: {
            pnl: [2450, -830, 125, 6720, -1940, 0][seed],
            winRate: sales ? [0.75, 0.375, 0.6, 0.8, 2 / 9, 0][seed] : null,
            sales,
          },
          holdings: entry.wallet.currentHoldings,
        },
      ];
    }),
  );
}
