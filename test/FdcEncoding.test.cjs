let expect;
let ethers;

const { toContractProof } = require("../scripts/lib/fdc.cjs");

describe("FDC proof encoding", function () {
  before(async function () {
    ({ expect } = await import("chai"));
    const { network } = await import("hardhat");
    ({ ethers } = await network.getOrCreate());
  });

  it("deeply converts ethers Result values before contract submission", function () {
    const responseType = "tuple(bytes32 attestationType,bytes32 sourceId,uint64 votingRound,uint64 lowestUsedTimestamp,tuple(bytes32 transactionId,address proofOwner) requestBody,tuple(uint64 blockNumber,uint64 blockTimestamp,string sourceAddress,bytes32 sourceAddressHash,bytes32 receivingAddressHash,bytes32 intendedReceivingAddressHash,int256 spentAmount,int256 intendedSpentAmount,int256 receivedAmount,int256 intendedReceivedAmount,bool hasMemoData,bytes firstMemoData,bool hasDestinationTag,uint256 destinationTag,uint8 status) responseBody)";
    const original = {
      attestationType: ethers.encodeBytes32String("XRPPayment"),
      sourceId: ethers.encodeBytes32String("testXRP"),
      votingRound: 1,
      lowestUsedTimestamp: 1,
      requestBody: { transactionId: ethers.id("tx"), proofOwner: ethers.ZeroAddress },
      responseBody: {
        blockNumber: 1,
        blockTimestamp: 1,
        sourceAddress: "rSource",
        sourceAddressHash: ethers.id("source"),
        receivingAddressHash: ethers.id("receiver"),
        intendedReceivingAddressHash: ethers.id("receiver"),
        spentAmount: 1,
        intendedSpentAmount: 1,
        receivedAmount: 1,
        intendedReceivedAmount: 1,
        hasMemoData: false,
        firstMemoData: "0x",
        hasDestinationTag: false,
        destinationTag: 0,
        status: 0,
      },
    };
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode([responseType], [original]);
    const [decoded] = ethers.AbiCoder.defaultAbiCoder().decode([responseType], encoded);
    expect(Object.isFrozen(decoded)).to.equal(true);
    expect(Object.isFrozen(decoded.requestBody)).to.equal(true);

    const proof = toContractProof({ proof: Object.freeze([ethers.ZeroHash]) }, decoded);
    expect(Array.isArray(proof.data)).to.equal(false);
    expect(Array.isArray(proof.data.requestBody)).to.equal(false);
    expect(Object.isFrozen(proof.merkleProof)).to.equal(false);
    expect(proof.data.requestBody.transactionId).to.equal(original.requestBody.transactionId);
  });
});
