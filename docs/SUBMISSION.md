# Flare Summer Signal submission draft

## Project name

Signal Harbor

## One-line description

A non-custodial control room that combines Flare-native prices and cross-chain proofs into auditable treasury response signals.

## Track

Interoperable Asset Products — FAssets, FTSO, and FDC.

## Problem

Teams holding bridged assets cannot evaluate treasury risk from price alone. They also need to know where a position came from, whether its source transaction was verified, whether the data is fresh, and what action the multisig should consider. Today these signals live in separate explorers, spreadsheets, and runbooks.

## Solution

Signal Harbor gives the treasury one response-ready view:

1. Resolve live XRP/USD pricing from FTSOv2 and value FXRP exposure.
2. Verify native XRPL payments with FDC XRPPayment proofs bound to the monitoring contract, with EVMTransaction available for secondary provenance.
3. Apply transparent Safe, Watch, and Act rules onchain.
4. Commit the proposed response as an event for multisig review without custodying assets.

## Flare-native integrations

- **FTSOv2:** live XRP/USD feed and timestamp, resolved through the Flare Contract Registry.
- **FDC:** full XRPPayment/EVMTransaction verifier → FdcHub → DA layer → Merkle proof → onchain verification workflow.
- **FAssets use case:** FXRP treasury monitoring and provenance awareness.
- **Coston2:** public RPC, registry, faucet-funded FDC requests, and deployment target.

## Why this is different

Most risk dashboards stop at charts. Signal Harbor makes the response itself verifiable while deliberately keeping execution behind the treasury multisig. It is useful now as monitoring infrastructure and has a clear route to guarded automation later.

## Two-minute demo

1. Open the dashboard and point out the green Coston2 connection indicator.
2. Show the live FTSOv2 XRP/USD price and current Coston2 block.
3. Click **Run risk sweep** to refresh the feed and return the current assessment.
4. Explain the FXRP position, price-age guard, and 5%/15% thresholds.
5. Show a real FDC attestation round and the corresponding recorded evidence event.
6. Change the mock/reference scenario to cross 15% and show `ResponseQueued`.
7. End on the key safety property: no treasury assets or token approvals enter Signal Harbor.

## Suggested demo video shots

- 0:00–0:15 — problem and one-line pitch.
- 0:15–0:45 — live FTSO radar and risk sweep.
- 0:45–1:15 — FDC source transaction, voting round, Merkle-proof verification.
- 1:15–1:45 — threshold transition and response commitment.
- 1:45–2:00 — architecture and non-custodial safety boundary.

## Verified deployment

- Live app: `https://signal-harbor-flare.vercel.app`
- Repository: `https://github.com/YingchenWang999/signal-harbor`
- Demo video: `https://github.com/YingchenWang999/signal-harbor/releases/download/v0.1.0/signal-harbor-demo.mp4`
- DoraHacks BUIDL: `https://dorahacks.io/buidl/47150` (submitted, under review)
- SignalHarbor: `0xE656720A6f2B5F6887a81830190090d9d8A3D0ab`
- XRPL Testnet transaction: `052ACFB5DCB4D3C098B5D7D14863C1D89A713E1BDEFC759CBD55951F23EFAB50`
- FDC request transaction: `0xc960ad3769a2bb64644d90075b73ffe876f49c4ff93f21280bee96af14b38842`
- FDC voting round: `1399509`
- Evidence record transaction: `0x2012dfc5d63600e28f9db305e256ce80731807026c18bf14c7deaf6752e8b985`
- Evidence ID: `0x442d89f3a9bfe0e73c0a6c7ca0cc636f2e5662c36f64c81b450a889f83d79e7d`
- Recorded value: `1 XRP` (`1,000,000` drops)

## Submission checklist

- [x] Deploy contracts to Coston2 from a dedicated faucet-funded wallet.
- [x] Record a real XRPL Testnet XRPPayment proof to an allowlisted receiver.
- [x] Connect the deployed evidence event to the UI.
- [x] Publish the frontend and repository.
- [x] Record and publish the demo video.
- [x] Submit deployment, explorer, repository, demo, and live-app URLs to the DoraHacks BUIDL.
