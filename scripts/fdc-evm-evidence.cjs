const { submitAndRetrieveProof, toContractProof } = require("./lib/fdc.cjs");

const responseType = "tuple(bytes32 attestationType,bytes32 sourceId,uint64 votingRound,uint64 lowestUsedTimestamp,tuple(bytes32 transactionHash,uint16 requiredConfirmations,bool provideInput,bool listEvents,uint32[] logIndices) requestBody,tuple(uint64 blockNumber,uint64 timestamp,address sourceAddress,bool isDeployment,address receivingAddress,uint256 value,bytes input,uint8 status,tuple(uint32 logIndex,address emitterAddress,bytes32[] topics,bytes data,bool removed)[] events) responseBody)";

async function main() {
  const { network } = await import("hardhat");
  const connection = await network.getOrCreate();
  const hre = { ethers: connection.ethers };
  const {
    SOURCE_TX_HASH,
    SIGNAL_HARBOR_ADDRESS,
    VERIFIER_URL_TESTNET = "https://fdc-verifiers-testnet.flare.network",
    VERIFIER_API_KEY_TESTNET = "",
    COSTON2_DA_LAYER_URL = "https://ctn2-data-availability.flare.network",
    FDC_REQUEST_TX_HASH = "",
  } = process.env;
  if (!SOURCE_TX_HASH || !SIGNAL_HARBOR_ADDRESS) {
    throw new Error("Set SOURCE_TX_HASH and SIGNAL_HARBOR_ADDRESS");
  }

  const { proof, signer } = await submitAndRetrieveProof(hre, {
    preparePath: "/verifier/eth/EVMTransaction/prepareRequest",
    request: {
      attestationType: hre.ethers.encodeBytes32String("EVMTransaction"),
      sourceId: hre.ethers.encodeBytes32String("testETH"),
      requestBody: {
        transactionHash: SOURCE_TX_HASH,
        requiredConfirmations: "1",
        provideInput: true,
        listEvents: false,
        logIndices: [],
      },
    },
    apiKey: VERIFIER_API_KEY_TESTNET,
    verifierUrl: VERIFIER_URL_TESTNET,
    daLayerUrl: COSTON2_DA_LAYER_URL,
    existingRequestTxHash: FDC_REQUEST_TX_HASH,
  });
  const [decodedResponse] = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    [responseType],
    proof.response_hex,
  );
  const harbor = await hre.ethers.getContractAt("SignalHarbor", SIGNAL_HARBOR_ADDRESS, signer);
  const recordTx = await harbor.recordEvmTransactionEvidence(toContractProof(proof, decodedResponse));
  await recordTx.wait();
  console.log(`EVM evidence recorded: ${recordTx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
