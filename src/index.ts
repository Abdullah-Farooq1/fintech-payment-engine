import { testConnection } from "./db";

const main = async () => {
  console.log("🚀 Fintech Ledger Starting...");
  await testConnection();
  console.log("✅ Day 1 Complete — DB connection verified");
};

main();