# Architecture and trust model

## Product boundary

Signal Harbor answers one question: **does this bridged treasury position require attention, and what response has the treasury committed to review?**

It does not move funds. Execution remains behind an existing multisig so a bad oracle response, compromised UI, or application bug cannot directly drain the treasury.

## Data path

### FTSOv2 pricing

The web application resolves `FtsoV2` through the canonical Flare Contract Registry and reads the XRP/USD block-latency feed. The core contract receives the same protocol address at deployment and normalizes values to 18 decimals through `getFeedByIdInWei`.

Each position defines:

- a bytes21 FTSO feed ID;
- units in 18-decimal fixed point;
- a reference price;
- Watch and Act downside thresholds in basis points;
- the maximum accepted price age.

Stale, zero, missing-timestamp, and future-timestamp data always produces `Act`, even when the last reported price appears healthy. Failing closed is safer than treating an unavailable oracle as a zero-risk condition.

### FDC provenance

The primary FXRP path accepts Flare's canonical `IXRPPayment.Proof` and calls `FdcVerification.verifyXRPPayment` before storing anything. The proof must use the `XRPPayment` attestation type, an owner-approved source ID, `proofOwner == SignalHarbor`, a successful positive-value payment, and an owner-approved XRPL receiver hash.

The secondary EVM path accepts `IEVMTransaction.Proof` and calls `verifyEVMTransaction`. It requires the correct attestation type, an approved source ID, transaction success, and an approved receiving address. Replay keys include proof kind, source ID, and transaction ID, so identifiers on different chains do not collide.

The proof workflow is:

1. Prepare an XRPPayment attestation through the Flare testnet verifier, bound to the deployed Signal Harbor address.
2. Pay the FdcHub request fee with faucet C2FLR.
3. Wait for the FDC voting round to finalize through protocol ID 200.
4. Retrieve the response and Merkle branch from the Coston2 DA layer.
5. Decode `IXRPPayment.Response` and submit it to Signal Harbor.
6. Store only compact evidence metadata after onchain verification.

### Response commitments

When an assessment reaches `Act`, the owner may call `queueResponse` with the hash of a human-readable response plan or multisig transaction batch. The emitted event binds the response hash to the observed price and downside at that moment.

This creates an auditable bridge to automation without giving the monitoring contract custody.

## Administration and known limitations

- Administration uses two-step ownership transfer. A production deployment must transfer ownership to a verified multisig; no production address is invented in this repository.
- EVM evidence enforces source and transaction receiver allowlists, but a token-specific bridge use case should additionally validate the expected emitter, event signature, token, and decoded event fields.
- A reference price is manually configured rather than derived from cost basis events.
- The UI currently reads the first verified evidence block plus the latest Coston2 event window. A production deployment should use an indexer for complete, reorg-aware history.
- Public verifier and DA services are development infrastructure with rate limits.
