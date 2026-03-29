import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as schema from "../schema";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully");
    client.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};