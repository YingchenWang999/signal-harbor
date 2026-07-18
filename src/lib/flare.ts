import type { Address, Chain } from "viem";
import { signalHarborDeployment } from "../data/deployment";

export const coston2 = {
  id: 114,
  name: "Flare Testnet Coston2",
  nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc"] },
  },
  blockExplorers: {
    default: { name: "Coston2 Explorer", url: "https://coston2-explorer.flare.network" },
  },
  testnet: true,
} as const satisfies Chain;
const registry = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019" as Address;
const xrpUsdFeed = "0x015852502f55534400000000000000000000000000" as const;

const registryAbi = [{
  type: "function",
  name: "getContractAddressByName",
  stateMutability: "view",
  inputs: [{ name: "_name", type: "string" }],
  outputs: [{ name: "", type: "address" }],
}] as const;

const ftsoAbi = [{
  type: "function",
  name: "getFeedByIdInWei",
  stateMutability: "view",
  inputs: [{ name: "_feedId", type: "bytes21" }],
  outputs: [{ name: "_value", type: "uint256" }, { name: "_timestamp", type: "uint64" }],
}] as const;

export interface FlareSnapshot {
  price: number;
  timestamp: number;
  blockNumber: bigint;
  ftsoAddress: Address;
}

export interface EvidenceSnapshot {
  amountXrp: number;
  evidenceId: `0x${string}`;
  recordedTransaction: `0x${string}`;
  sourceId: string;
  sourceTimestamp: number;
  transactionId: `0x${string}`;
  votingRound: number;
}

const evidenceAbi = [{
  type: "event",
  name: "CrossChainEvidenceRecorded",
  inputs: [
    { indexed: true, name: "evidenceId", type: "bytes32" },
    { indexed: true, name: "kind", type: "uint8" },
    { indexed: true, name: "transactionId", type: "bytes32" },
    { indexed: false, name: "sourceId", type: "bytes32" },
    { indexed: false, name: "sourceTimestamp", type: "uint64" },
    { indexed: false, name: "votingRound", type: "uint64" },
    { indexed: false, name: "amount", type: "uint256" },
  ],
}] as const;

export async function getFlareSnapshot(): Promise<FlareSnapshot> {
  const { createPublicClient, formatUnits, http } = await import("viem");
  const client = createPublicClient({ chain: coston2, transport: http() });
  const ftsoAddress = await client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: "getContractAddressByName",
    args: ["FtsoV2"],
  });
  const [[value, timestamp], blockNumber] = await Promise.all([
    client.readContract({ address: ftsoAddress, abi: ftsoAbi, functionName: "getFeedByIdInWei", args: [xrpUsdFeed] }),
    client.getBlockNumber(),
  ]);
  return { price: Number(formatUnits(value, 18)), timestamp: Number(timestamp), blockNumber, ftsoAddress };
}

export async function getEvidenceSnapshots(): Promise<EvidenceSnapshot[]> {
  const { createPublicClient, hexToString, http } = await import("viem");
  const client = createPublicClient({ chain: coston2, transport: http() });
  const latestBlock = await client.getBlockNumber();
  const recentFromBlock = latestBlock > 29n ? latestBlock - 29n : 0n;
  const ranges = recentFromBlock <= signalHarborDeployment.firstEvidenceBlock
    ? [{ fromBlock: signalHarborDeployment.firstEvidenceBlock, toBlock: latestBlock }]
    : [
        { fromBlock: signalHarborDeployment.firstEvidenceBlock, toBlock: signalHarborDeployment.firstEvidenceBlock },
        { fromBlock: recentFromBlock, toBlock: latestBlock },
      ];
  const batches = await Promise.all(ranges.map((range) => client.getContractEvents({
    address: signalHarborDeployment.address,
    abi: evidenceAbi,
    eventName: "CrossChainEvidenceRecorded",
    ...range,
  })));
  const logs = [...new Map(batches.flat().map((log) => [
    `${log.transactionHash}:${log.logIndex}`,
    log,
  ])).values()];
  return logs.map((log) => ({
    amountXrp: Number(log.args.amount ?? 0n) / 1_000_000,
    evidenceId: log.args.evidenceId ?? "0x",
    recordedTransaction: log.transactionHash,
    sourceId: hexToString(log.args.sourceId ?? "0x", { size: 32 }).replace(/\0+$/, ""),
    sourceTimestamp: Number(log.args.sourceTimestamp ?? 0n),
    transactionId: log.args.transactionId ?? "0x",
    votingRound: Number(log.args.votingRound ?? 0n),
  })).reverse();
}

export function shortHex(value: string, start = 6, end = 4) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}
