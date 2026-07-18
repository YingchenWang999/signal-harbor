const REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const registryAbi = ["function getContractAddressByName(string) view returns (address)"];
const fdcHubAbi = ["function requestAttestation(bytes) payable"];
const feeAbi = ["function getRequestFee(bytes) view returns (uint256)"];
const managerAbi = [
  "function firstVotingRoundStartTs() view returns (uint64)",
  "function votingEpochDurationSeconds() view returns (uint64)",
];
const relayAbi = ["function isFinalized(uint256,uint256) view returns (bool)"];
const verifierAbi = ["function fdcProtocolId() view returns (uint8)"];

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function postJson(url, body, apiKey) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-KEY": apiKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url} returned invalid JSON`);
  }
}

async function waitUntil(label, action, { attempts, delayMs }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await action();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await delay(delayMs);
  }
  const suffix = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`${label} timed out after ${attempts} attempts${suffix}`);
}

async function submitAndRetrieveProof(hre, {
  preparePath,
  request,
  apiKey,
  verifierUrl,
  daLayerUrl,
  existingRequestTxHash,
}) {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("Set DEPLOYER_PRIVATE_KEY");

  const registry = new hre.ethers.Contract(REGISTRY, registryAbi, signer);
  const names = ["FdcHub", "FdcRequestFeeConfigurations", "FlareSystemsManager", "Relay", "FdcVerification"];
  const [hubAddress, feeAddress, managerAddress, relayAddress, verifierAddress] = await Promise.all(
    names.map((name) => registry.getContractAddressByName(name)),
  );
  if ([hubAddress, feeAddress, managerAddress, relayAddress, verifierAddress].some(
    (address) => address === hre.ethers.ZeroAddress,
  )) {
    throw new Error("Coston2 registry returned a zero protocol address");
  }

  let requestBytes;
  let requestTxHash;
  let receipt;
  if (existingRequestTxHash) {
    const existingTx = await hre.ethers.provider.getTransaction(existingRequestTxHash);
    receipt = await hre.ethers.provider.getTransactionReceipt(existingRequestTxHash);
    if (!existingTx || !receipt) throw new Error("Existing FDC request transaction was not found");
    const hubInterface = new hre.ethers.Interface(fdcHubAbi);
    [requestBytes] = hubInterface.decodeFunctionData("requestAttestation", existingTx.data);
    requestTxHash = existingRequestTxHash;
  } else {
    const prepared = await postJson(`${verifierUrl}${preparePath}`, request, apiKey);
    requestBytes = prepared?.abiEncodedRequest;
    if (typeof requestBytes !== "string" || !requestBytes.startsWith("0x")) {
      throw new Error("Verifier response did not include abiEncodedRequest");
    }
    const feeConfig = new hre.ethers.Contract(feeAddress, feeAbi, signer);
    const hub = new hre.ethers.Contract(hubAddress, fdcHubAbi, signer);
    const requestFee = await feeConfig.getRequestFee(requestBytes);
    const requestTx = await hub.requestAttestation(requestBytes, { value: requestFee });
    receipt = await requestTx.wait();
    if (!receipt) throw new Error("FDC attestation transaction was not mined");
    requestTxHash = requestTx.hash;
  }
  const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
  if (!block) throw new Error("Could not read the FDC request block");

  const manager = new hre.ethers.Contract(managerAddress, managerAbi, signer);
  const [firstRound, duration] = await Promise.all([
    manager.firstVotingRoundStartTs(),
    manager.votingEpochDurationSeconds(),
  ]);
  if (duration === 0n || BigInt(block.timestamp) < firstRound) {
    throw new Error("Invalid FDC voting-round configuration");
  }
  const roundId = Number((BigInt(block.timestamp) - firstRound) / duration);
  console.log(`FDC request: ${requestTxHash}${existingRequestTxHash ? " (resumed)" : ""}`);
  console.log(`Round: https://coston2-systems-explorer.flare.rocks/voting-round/${roundId}?tab=fdc`);

  const relay = new hre.ethers.Contract(relayAddress, relayAbi, signer);
  const verifier = new hre.ethers.Contract(verifierAddress, verifierAbi, signer);
  const protocolId = await verifier.fdcProtocolId();
  await waitUntil(
    "FDC round finalization",
    () => relay.isFinalized(protocolId, roundId),
    { attempts: 60, delayMs: 10_000 },
  );

  const proof = await waitUntil(
    "FDC proof retrieval",
    async () => {
      const next = await postJson(
        `${daLayerUrl}/api/v1/fdc/proof-by-request-round-raw`,
        { votingRoundId: roundId, requestBytes },
      );
      return next?.response_hex && Array.isArray(next?.proof) ? next : undefined;
    },
    { attempts: 60, delayMs: 5_000 },
  );
  return { proof, signer };
}

function toContractProof(proof, decodedResponse) {
  return {
    merkleProof: [...proof.proof],
    data: typeof decodedResponse?.toObject === "function"
      ? decodedResponse.toObject(true)
      : decodedResponse,
  };
}

module.exports = { submitAndRetrieveProof, toContractProof };
