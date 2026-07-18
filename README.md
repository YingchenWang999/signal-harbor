# Signal Harbor

Signal Harbor is a non-custodial treasury risk console for bridged assets on Flare. It combines live FTSOv2 prices with FDC-verified source-chain evidence, then turns explicit risk thresholds into an auditable multisig response commitment.

Built for **Flare Summer Signal 2026 · Interoperable Asset Products**.

**[Live app](https://signal-harbor-flare.vercel.app)** · **[Demo video](https://github.com/YingchenWang999/signal-harbor/releases/download/v0.1.0/signal-harbor-demo.mp4)** · **[DoraHacks BUIDL](https://dorahacks.io/buidl/47150)** · **[Coston2 contract](https://coston2-explorer.flare.network/address/0xE656720A6f2B5F6887a81830190090d9d8A3D0ab)**

## Why it exists

Cross-chain treasuries usually monitor price, mint provenance, bridge activity, and response procedures in separate tools. Signal Harbor joins those signals without becoming another custodian:

- **FTSOv2** supplies a live XRP/USD valuation for FXRP exposure.
- **FDC XRPPayment and EVMTransaction proofs** anchor source-chain payment provenance only after Merkle-proof verification against Flare's onchain root.
- **SignalHarbor.sol** applies transparent `Safe → Watch → Act` rules and emits a deterministic response commitment.
- **The treasury multisig remains in control.** Signal Harbor never receives approval to transfer treasury assets.

## What is working

- Live Coston2 FTSOv2 price and block data in the web console.
- Responsive, accessible monitoring UI with an interactive risk sweep.
- Configurable onchain positions, price-age protection, downside thresholds, and valuation.
- Native XRPL payment and EVM transaction proof verification, proof-owner binding, source/recipient allowlists, and replay protection.
- Action-level response commitments suitable for a downstream Safe/multisig proposal service.
- Automated Solidity tests covering valuation, threshold transitions, bad oracle data, ownership, response gating, both FDC proof types, allowlists, and replay prevention.
- End-to-end XRPPayment and EVMTransaction request/proof/record scripts for Coston2.
- A live Coston2 deployment with a real XRPL Testnet payment verified by FDC and recorded onchain.

## Live proof

- **SignalHarbor:** [`0xE656…D0ab`](https://coston2-explorer.flare.network/address/0xE656720A6f2B5F6887a81830190090d9d8A3D0ab)
- **Verified evidence transaction:** [`0x2012…985`](https://coston2-explorer.flare.network/tx/0x2012dfc5d63600e28f9db305e256ce80731807026c18bf14c7deaf6752e8b985)
- **XRPL Testnet payment:** [`052A…B50`](https://testnet.xrpl.org/transactions/052ACFB5DCB4D3C098B5D7D14863C1D89A713E1BDEFC759CBD55951F23EFAB50)
- **FDC voting round:** `1399509`

The dashboard reads the `CrossChainEvidenceRecorded` event directly from Coston2. It does not present sample hashes as live attestations.

## Architecture

```text
XRPL payment / external EVM transaction
        │
        ▼
Flare verifier ──► FdcHub consensus ──► DA Layer proof
                                           │
                                           ▼
                                 SignalHarbor.sol
                                 verifies Merkle proof
                                           │
FTSOv2 XRP/USD ────────────────────────────┤
                                           ▼
                              Safe / Watch / Act
                                           │
                                           ▼
                           Multisig response commitment
                           (no asset custody or approval)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the trust model and data flow.

## Run locally

Requirements: Node.js 22+ and pnpm 11+.

```bash
pnpm install
pnpm dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Without environment configuration the app still queries the canonical public Coston2 RPC.

## Verify everything

```bash
pnpm check
```

This runs ESLint, the Hardhat 3 contract tests, TypeScript, the production Vite build, and a high-severity dependency audit.

## Deploy to Coston2

Copy `.env.example` to `.env` and add a dedicated testnet key funded only with faucet C2FLR. Never use a mainnet key.

```bash
pnpm deploy:coston2
```

The deployment script resolves `FtsoV2` and `FdcVerification` through Flare's canonical registry instead of hardcoding mutable protocol addresses. Set `EVM_EVIDENCE_RECIPIENT` and/or `XRP_EVIDENCE_RECIPIENT_HASH` to configure the intended receivers during deployment; leaving them empty safely disables recording for that proof type until the owner adds an allowlist entry. Put the resulting contract address in `SIGNAL_HARBOR_ADDRESS`.

## Record real FDC evidence

For the primary FXRP flow, choose a successful XRPL Testnet payment to the configured receiver and set `SOURCE_TX_HASH`. The request binds `proofOwner` to Signal Harbor, submits the `XRPPayment` attestation to FdcHub, waits for finalization, retrieves the DA-layer Merkle proof, decodes it, and records it onchain.

```bash
pnpm fdc:xrp
```

An allowlisted Sepolia EVM transfer can be recorded with `pnpm fdc:evm`.

FDC testnet fees are paid in faucet C2FLR; no real tokens are required. The default verifier and DA endpoints are rate-limited public development services, so production deployments should run dedicated infrastructure.

## Project map

```text
contracts/SignalHarbor.sol       Core risk and FDC evidence contract
contracts/mocks/                 Deterministic test adapters
scripts/deploy.cjs               Registry-aware Coston2 deployment
scripts/fdc-xrp-evidence.cjs     Native XRPL payment attestation workflow
scripts/fdc-evm-evidence.cjs     EVM transaction attestation workflow
scripts/lib/fdc.cjs              Shared bounded FDC request/finalization client
src/lib/flare.ts                 Live FTSOv2 browser adapter
src/data/deployment.ts           Coston2 deployment and proof references
src/components/                  Monitoring console
test/SignalHarbor.test.cjs       Contract behavior and security tests
docs/SUBMISSION.md               Hackathon pitch and demo script
```

## Security posture

This is hackathon software and has not been independently audited. The contract intentionally avoids token custody, token approvals, arbitrary external calls, and automated swaps. It uses two-step ownership, source/recipient allowlists, proof-owner binding, fail-closed oracle checks, and replay protection. Before production use, transfer ownership to a verified multisig, add role separation and a timelock, define token/event-level policies where EVM evidence is used, add circuit breakers, and commission an independent audit.

## License

MIT
