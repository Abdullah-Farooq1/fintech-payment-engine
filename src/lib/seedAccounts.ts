import { db } from "../db";
import { accounts } from "../schema";
import * as dotenv from "dotenv";

dotenv.config();

const seed = async () => {
  console.log("🌱 Seeding accounts...");

  // System Cash Account (Asset)
  const cashAccount = await db
    .insert(accounts)
    .values({
      name: "System Cash Account",
      type: "asset",
      currency: "USD",
      balance: "100000.0000",
      isSystem: "true",
    })
    .returning();

  console.log("✅ Cash Account created:", cashAccount[0].id);

  // Revenue Account
  const revenueAccount = await db
    .insert(accounts)
    .values({
      name: "Revenue Account",
      type: "revenue",
      currency: "USD",
      balance: "0.0000",
      isSystem: "true",
    })
    .returning();

  console.log("✅ Revenue Account created:", revenueAccount[0].id);

  // Customer Account
  const customerAccount = await db
    .insert(accounts)
    .values({
      name: "Customer A Wallet",
      type: "asset",
      currency: "USD",
      balance: "5000.0000",
      isSystem: "false",
    })
    .returning();

  console.log("✅ Customer Account created:", customerAccount[0].id);

  console.log("🎉 Seeding complete");
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});