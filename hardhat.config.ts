import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

const coston2RpcUrl = process.env.COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";

export default defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
  solidity: {
    profiles: {
      default: {
        version: "0.8.25",
        settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 500 } },
      },
      production: {
        version: "0.8.25",
        settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 500 } },
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: { mocha: "./test" },
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    coston2: {
      type: "http",
      chainType: "generic",
      url: coston2RpcUrl,
      chainId: 114,
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
});
