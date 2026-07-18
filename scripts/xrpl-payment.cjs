const fs = require("node:fs");
const dotenv = require("dotenv");
const xrpl = require("xrpl");

dotenv.config({ quiet: true });

function updateEnv(name, value) {
  const path = ".env";
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  const prefix = `${name}=`;
  const index = lines.findIndex((line) => line.startsWith(prefix));
  if (index >= 0) lines[index] = `${prefix}${value}`;
  else lines.push(`${prefix}${value}`);
  fs.writeFileSync(path, lines.filter(Boolean).join("\n") + "\n", { mode: 0o600 });
}

async function main() {
  const { XRPL_SENDER_SEED, XRPL_RECEIVER_ADDRESS } = process.env;
  if (!XRPL_SENDER_SEED || !XRPL_RECEIVER_ADDRESS) {
    throw new Error("Run pnpm setup:testnet first");
  }
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  try {
    const wallet = xrpl.Wallet.fromSeed(XRPL_SENDER_SEED);
    const prepared = await client.autofill({
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: XRPL_RECEIVER_ADDRESS,
      Amount: xrpl.xrpToDrops("1"),
      DestinationTag: 20260718,
    });
    const signed = wallet.sign(prepared);
    const submitted = await client.submitAndWait(signed.tx_blob);
    const result = submitted.result.meta?.TransactionResult;
    if (result !== "tesSUCCESS") throw new Error(`XRPL payment failed: ${result ?? "unknown"}`);
    const hash = submitted.result.hash;
    updateEnv("SOURCE_TX_HASH", hash);
    console.log(`XRPL payment validated: ${hash}`);
    console.log(`Explorer: https://testnet.xrpl.org/transactions/${hash}`);
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
