const REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const registryAbi = ["function getContractAddressByName(string) view returns (address)"];

async function main() {
  const { network } = await import("hardhat");
  const { ethers } = await network.getOrCreate();
  const { EVM_EVIDENCE_RECIPIENT, XRP_EVIDENCE_RECIPIENT_HASH } = process.env;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Set DEPLOYER_PRIVATE_KEY before deploying");
  const registry = new ethers.Contract(REGISTRY, registryAbi, deployer);
  const [ftso, fdcVerification] = await Promise.all([
    registry.getContractAddressByName("FtsoV2"),
    registry.getContractAddressByName("FdcVerification"),
  ]);
  const factory = await ethers.getContractFactory("SignalHarbor");
  const harbor = await factory.deploy(ftso, fdcVerification);
  await harbor.waitForDeployment();
  await (await harbor.setAllowedSource(ethers.encodeBytes32String("testETH"), true)).wait();
  await (await harbor.setAllowedSource(ethers.encodeBytes32String("testXRP"), true)).wait();
  if (EVM_EVIDENCE_RECIPIENT) {
    if (!ethers.isAddress(EVM_EVIDENCE_RECIPIENT)) throw new Error("EVM_EVIDENCE_RECIPIENT is invalid");
    await (await harbor.setAllowedEvmRecipient(EVM_EVIDENCE_RECIPIENT, true)).wait();
  }
  if (XRP_EVIDENCE_RECIPIENT_HASH) {
    if (!ethers.isHexString(XRP_EVIDENCE_RECIPIENT_HASH, 32)) {
      throw new Error("XRP_EVIDENCE_RECIPIENT_HASH must be bytes32");
    }
    await (await harbor.setAllowedXrpRecipientHash(XRP_EVIDENCE_RECIPIENT_HASH, true)).wait();
  }
  console.log(JSON.stringify({
    network: "coston2",
    deployer: deployer.address,
    address: await harbor.getAddress(),
    ftso,
    fdcVerification,
    evmEvidenceRecipient: EVM_EVIDENCE_RECIPIENT || "not configured",
    xrpEvidenceRecipientHash: XRP_EVIDENCE_RECIPIENT_HASH || "not configured",
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
