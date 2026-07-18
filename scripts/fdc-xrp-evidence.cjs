const { submitAndRetrieveProof, toContractProof } = require("./lib/fdc.cjs");

const responseType = "tuple(bytes32 attestationType,bytes32 sourceId,uint64 votingRound,uint64 lowestUsedTimestamp,tuple(bytes32 transactionId,address proofOwner) requestBody,tuple(uint64 blockNumber,uint64 blockTimestamp,string sourceAddress,bytes32 sourceAddressHash,bytes32 receivingAddressHash,bytes32 intendedReceivingAddressHash,int256 spentAmount,int256 intendedSpentAmount,int256 receivedAmount,int256 intendedReceivedAmount,bool hasMemoData,bytes firstMemoData,bool hasDestinationTag,uint256 destinationTag,uint8 status) responseBody)";

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
    preparePath: "/verifier/xrp/XRPPayment/prepareRequest",
    request: {
      attestationType: hre.ethers.encodeBytes32String("XRPPayment"),
      sourceId: hre.ethers.encodeBytes32String("testXRP"),
      requestBody: {
        transactionId: SOURCE_TX_HASH,
        proofOwner: SIGNAL_HARBOR_ADDRESS.toLowerCase(),
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
  const recordTx = await harbor.recordXrpPaymentEvidence(toContractProof(proof, decodedResponse));
  await recordTx.wait();
  console.log(`XRPL payment evidence recorded: ${recordTx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
