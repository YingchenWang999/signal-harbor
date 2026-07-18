import { positions } from "../data/demo";

export type RiskStatus = "safe" | "watch" | "act";

export interface ValuedPosition {
  symbol: string;
  name: string;
  units: number;
  value: number;
  allocation: number;
  downsideBps: number;
  thresholdUsed: number;
  status: RiskStatus;
}

function unitPrice(symbol: string, xrpPrice: number) {
  if (symbol === "FXRP") return xrpPrice;
  if (symbol === "USDT0") return 1;
  return 0.0182;
}

export function assessPrice(price: number, referencePrice: number, watchBps: number, actBps: number) {
  const downsideBps = price < referencePrice
    ? ((referencePrice - price) / referencePrice) * 10_000
    : 0;
  const status: RiskStatus = downsideBps >= actBps
    ? "act"
    : downsideBps >= watchBps
      ? "watch"
      : "safe";
  return {
    downsideBps,
    status,
    thresholdUsed: Math.min(100, (downsideBps / actBps) * 100),
  };
}

export function calculatePortfolio(xrpPrice: number) {
  const raw = positions.map((position) => {
    const price = unitPrice(position.symbol, xrpPrice);
    return {
      ...position,
      value: position.units * price,
      ...assessPrice(price, position.referencePrice, position.watchBps, position.actBps),
    };
  });
  const totalValue = raw.reduce((sum, position) => sum + position.value, 0);
  const valued: ValuedPosition[] = raw.map((position) => ({
    ...position,
    allocation: totalValue > 0 ? (position.value / totalValue) * 100 : 0,
  }));
  const riskOrder: Record<RiskStatus, number> = { safe: 0, watch: 1, act: 2 };
  const highestRisk = valued.reduce(
    (highest, position) => riskOrder[position.status] > riskOrder[highest.status] ? position : highest,
    valued[0],
  );
  return { positions: valued, totalValue, highestRisk };
}
