let expect;
let ethers;

describe("SignalHarbor", function () {
  let POSITION_ID;
  const FEED_ID = "0x015852502f55534400000000000000000000000000";
  let TEST_ETH;
  let TEST_XRP;
  let XRP_RECIPIENT_HASH;

  before(async function () {
    ({ expect } = await import("chai"));
    const { network } = await import("hardhat");
    ({ ethers } = await network.getOrCreate());
    POSITION_ID = ethers.id("FXRP_TREASURY");
    TEST_ETH = ethers.encodeBytes32String("testETH");
    TEST_XRP = ethers.encodeBytes32String("testXRP");
    XRP_RECIPIENT_HASH = ethers.id("rSignalHarborReceiver");
  });

  async function deployFixture() {
    const [owner, nextOwner, evmRecipient, outsider] = await ethers.getSigners();
    const ftso = await (await ethers.getContractFactory("MockFtsoReader")).deploy();
    const fdc = await (await ethers.getContractFactory("MockFdcVerification")).deploy();
    const harbor = await (await ethers.getContractFactory("SignalHarbor")).deploy(
      await ftso.getAddress(),
      await fdc.getAddress(),
    );
    const block = await ethers.provider.getBlock("latest");
    await ftso.setFeed(2_000n * 10n ** 18n, block.timestamp);
    await harbor.configurePosition(POSITION_ID, {
      feedId: FEED_ID,
      symbol: ethers.encodeBytes32String("FXRP").slice(0, 18),
      unitsWei: 12n * 10n ** 18n,
      referencePriceWei: 2_000n * 10n ** 18n,
      watchDeviationBps: 500,
      actDeviationBps: 1_500,
      maxPriceAge: 300,
      enabled: true,
    });
    return { owner, nextOwner, evmRecipient, outsider, ftso, fdc, harbor, block };
  }

  function evmProof({ block, recipient, transactionHash = ethers.id("source-transaction") }) {
    return {
      merkleProof: [],
      data: {
        attestationType: ethers.encodeBytes32String("EVMTransaction"),
        sourceId: TEST_ETH,
        votingRound: 42,
        lowestUsedTimestamp: block.timestamp,
        requestBody: {
          transactionHash,
          requiredConfirmations: 1,
          provideInput: true,
          listEvents: false,
          logIndices: [],
        },
        responseBody: {
          blockNumber: block.number,
          timestamp: block.timestamp,
          sourceAddress: recipient,
          isDeployment: false,
          receivingAddress: recipient,
          value: 25n,
          input: "0x",
          status: 1,
          events: [],
        },
      },
    };
  }

  async function xrpProof({ harbor, block, transactionId = ethers.id("xrp-payment") }) {
    return {
      merkleProof: [],
      data: {
        attestationType: ethers.encodeBytes32String("XRPPayment"),
        sourceId: TEST_XRP,
        votingRound: 84,
        lowestUsedTimestamp: block.timestamp,
        requestBody: { transactionId, proofOwner: await harbor.getAddress() },
        responseBody: {
          blockNumber: block.number,
          blockTimestamp: block.timestamp,
          sourceAddress: "rSource",
          sourceAddressHash: ethers.id("rSource"),
          receivingAddressHash: XRP_RECIPIENT_HASH,
          intendedReceivingAddressHash: XRP_RECIPIENT_HASH,
          spentAmount: 1_000_000n,
          intendedSpentAmount: 1_000_000n,
          receivedAmount: 1_000_000n,
          intendedReceivedAmount: 1_000_000n,
          hasMemoData: false,
          firstMemoData: "0x",
          hasDestinationTag: true,
          destinationTag: 123,
          status: 0,
        },
      },
    };
  }

  it("values a position with FTSOv2 data", async function () {
    const { harbor } = await deployFixture();
    const result = await harbor.assess(POSITION_ID);
    expect(result.valueWei).to.equal(24_000n * 10n ** 18n);
    expect(result.level).to.equal(0);
  });

  it("moves from watch to act as downside grows", async function () {
    const { ftso, harbor, block } = await deployFixture();
    await ftso.setFeed(1_850n * 10n ** 18n, block.timestamp);
    expect((await harbor.assess(POSITION_ID)).level).to.equal(1);
    await ftso.setFeed(1_650n * 10n ** 18n, block.timestamp);
    expect((await harbor.assess(POSITION_ID)).level).to.equal(2);
  });

  it("fails closed for stale, future, and zero price data", async function () {
    const { ftso, harbor, block } = await deployFixture();
    await ftso.setFeed(2_000n * 10n ** 18n, 1);
    expect((await harbor.assess(POSITION_ID)).level).to.equal(2);
    await ftso.setFeed(2_000n * 10n ** 18n, block.timestamp + 1_000);
    expect((await harbor.assess(POSITION_ID)).level).to.equal(2);
    await ftso.setFeed(0, block.timestamp);
    expect((await harbor.assess(POSITION_ID)).level).to.equal(2);
  });

  it("queues each response commitment only once at action risk", async function () {
    const { ftso, harbor, block } = await deployFixture();
    const responseHash = ethers.id("rebalance");
    await expect(harbor.queueResponse(POSITION_ID, responseHash)).to.be.revertedWithCustomError(
      harbor,
      "InvalidConfiguration",
    );
    await ftso.setFeed(1_650n * 10n ** 18n, block.timestamp);
    await expect(harbor.queueResponse(POSITION_ID, responseHash)).to.emit(harbor, "ResponseQueued");
    await expect(harbor.queueResponse(POSITION_ID, responseHash)).to.be.revertedWithCustomError(
      harbor,
      "ResponseAlreadyQueued",
    );
  });

  it("records only allowlisted FDC-verified EVM evidence and rejects replay", async function () {
    const { evmRecipient, outsider, fdc, harbor, block } = await deployFixture();
    const proof = evmProof({ block, recipient: evmRecipient.address });

    await expect(harbor.recordEvmTransactionEvidence(proof)).to.be.revertedWithCustomError(
      harbor,
      "SourceNotAllowed",
    );
    await harbor.setAllowedSource(TEST_ETH, true);
    await expect(harbor.recordEvmTransactionEvidence(proof)).to.be.revertedWithCustomError(
      harbor,
      "RecipientNotAllowed",
    );
    await harbor.setAllowedEvmRecipient(evmRecipient.address, true);
    await expect(harbor.recordEvmTransactionEvidence(proof)).to.emit(
      harbor,
      "CrossChainEvidenceRecorded",
    );
    await expect(harbor.recordEvmTransactionEvidence(proof)).to.be.revertedWithCustomError(
      harbor,
      "EvidenceAlreadyRecorded",
    );

    await fdc.setEvmValid(false);
    const nextProof = evmProof({
      block,
      recipient: evmRecipient.address,
      transactionHash: ethers.id("another-transaction"),
    });
    await expect(harbor.recordEvmTransactionEvidence(nextProof)).to.be.revertedWithCustomError(
      harbor,
      "InvalidProof",
    );
    await expect(
      harbor.connect(outsider).setAllowedSource(TEST_ETH, false),
    ).to.be.revertedWithCustomError(harbor, "Unauthorized");
  });

  it("records contract-bound XRPL payment evidence and rejects invalid payments", async function () {
    const { outsider, fdc, harbor, block } = await deployFixture();
    const proof = await xrpProof({ harbor, block });
    await harbor.setAllowedSource(TEST_XRP, true);
    await harbor.setAllowedXrpRecipientHash(XRP_RECIPIENT_HASH, true);

    await expect(harbor.recordXrpPaymentEvidence(proof)).to.emit(
      harbor,
      "CrossChainEvidenceRecorded",
    );
    await expect(harbor.recordXrpPaymentEvidence(proof)).to.be.revertedWithCustomError(
      harbor,
      "EvidenceAlreadyRecorded",
    );

    const wrongOwnerProof = await xrpProof({
      harbor,
      block,
      transactionId: ethers.id("wrong-proof-owner"),
    });
    wrongOwnerProof.data.requestBody.proofOwner = outsider.address;
    await expect(harbor.recordXrpPaymentEvidence(wrongOwnerProof)).to.be.revertedWithCustomError(
      harbor,
      "InvalidProof",
    );

    const futureProof = await xrpProof({
      harbor,
      block,
      transactionId: ethers.id("future-xrp-proof"),
    });
    futureProof.data.responseBody.blockTimestamp = block.timestamp + 1_000;
    await expect(harbor.recordXrpPaymentEvidence(futureProof)).to.be.revertedWithCustomError(
      harbor,
      "InvalidProof",
    );

    await fdc.setXrpValid(false);
    const invalidProof = await xrpProof({
      harbor,
      block,
      transactionId: ethers.id("invalid-xrp-proof"),
    });
    await expect(harbor.recordXrpPaymentEvidence(invalidProof)).to.be.revertedWithCustomError(
      harbor,
      "InvalidProof",
    );
  });

  it("uses two-step ownership transfer", async function () {
    const { owner, nextOwner, outsider, harbor } = await deployFixture();
    await expect(harbor.transferOwnership(nextOwner.address))
      .to.emit(harbor, "OwnershipTransferStarted")
      .withArgs(owner.address, nextOwner.address);
    await expect(harbor.connect(outsider).acceptOwnership()).to.be.revertedWithCustomError(
      harbor,
      "Unauthorized",
    );
    await expect(harbor.connect(nextOwner).acceptOwnership())
      .to.emit(harbor, "OwnershipTransferred")
      .withArgs(owner.address, nextOwner.address);
    expect(await harbor.owner()).to.equal(nextOwner.address);
  });
});
