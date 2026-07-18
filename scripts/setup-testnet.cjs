const fs = require("node:fs");
const { Wallet: EvmWallet, id } = require("ethers");
const xrpl = require("xrpl");

const ENV_PATH = ".env";
const XRPL_URL = "wss://s.altnet.rippletest.net:51233";

function readEnv() {
  const values = {};
  if (!fs.existsSync(ENV_PATH)) return values;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0 && !line.trimStart().startsWith("#")) {
      values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  }
  return values;
}

function writeEnv(values) {
  const order = [
    "VITE_COSTON2_RPC_URL",
    "COSTON2_RPC_URL",
    "DEPLOYER_PRIVATE_KEY",
    "EVM_DEPLOYER_ADDRESS",
    "SIGNAL_HARBOR_ADDRESS",
    "SOURCE_TX_HASH",
    "FDC_REQUEST_TX_HASH",
    "EVM_EVIDENCE_RECIPIENT",
    "XRP_EVIDENCE_RECIPIENT_HASH",
    "XRPL_SENDER_ADDRESS",
    "XRPL_SENDER_SEED",
    "XRPL_RECEIVER_ADDRESS",
    "XRPL_RECEIVER_SEED",
    "VERIFIER_URL_TESTNET",
    "VERIFIER_API_KEY_TESTNET",
    "COSTON2_DA_LAYER_URL",
  ];
  const body = order.map((key) => `${key}=${values[key] ?? ""}`).join("\n") + "\n";
  fs.writeFileSync(ENV_PATH, body, { mode: 0o600 });
  fs.chmodSync(ENV_PATH, 0o600);
}

async function fundedWallet(client, existingSeed) {
  if (existingSeed) {
    const wallet = xrpl.Wallet.fromSeed(existingSeed);
    try {
      return { wallet, balance: await client.getXrpBalance(wallet.address) };
    } catch {
      return client.fundWallet(wallet, { usageContext: "Signal Harbor hackathon test" });
    }
  }
  return client.fundWallet(null, { usageContext: "Signal Harbor hackathon test" });
}

async function main() {
  const values = readEnv();
  const evmWallet = values.DEPLOYER_PRIVATE_KEY
    ? new EvmWallet(values.DEPLOYER_PRIVATE_KEY)
    : EvmWallet.createRandom();

  const client = new xrpl.Client(XRPL_URL);
  await client.connect();
  try {
    const sender = await fundedWallet(client, values.XRPL_SENDER_SEED);
    const receiver = await fundedWallet(client, values.XRPL_RECEIVER_SEED);
    Object.assign(values, {
      VITE_COSTON2_RPC_URL: values.VITE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
      COSTON2_RPC_URL: values.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
      DEPLOYER_PRIVATE_KEY: evmWallet.privateKey,
      EVM_DEPLOYER_ADDRESS: evmWallet.address,
      EVM_EVIDENCE_RECIPIENT: evmWallet.address,
      XRP_EVIDENCE_RECIPIENT_HASH: id(receiver.wallet.address),
      XRPL_SENDER_ADDRESS: sender.wallet.address,
      XRPL_SENDER_SEED: sender.wallet.seed,
      XRPL_RECEIVER_ADDRESS: receiver.wallet.address,
      XRPL_RECEIVER_SEED: receiver.wallet.seed,
      VERIFIER_URL_TESTNET: values.VERIFIER_URL_TESTNET || "https://fdc-verifiers-testnet.flare.network",
      VERIFIER_API_KEY_TESTNET: values.VERIFIER_API_KEY_TESTNET || "00000000-0000-0000-0000-000000000000",
      COSTON2_DA_LAYER_URL: values.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network",
    });
    writeEnv(values);
    console.log(`EVM test wallet: ${evmWallet.address}`);
    console.log(`XRPL sender: ${sender.wallet.address} (${sender.balance} XRP)`);
    console.log(`XRPL receiver: ${receiver.wallet.address} (${receiver.balance} XRP)`);
    console.log("Secrets saved locally to .env with owner-only permissions.");
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
