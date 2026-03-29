import { Hono } from "hono";
import { db } from "../db";
import { accounts } from "../schema";
import { eq } from "drizzle-orm";

const accountsRoute = new Hono();

// GET /accounts — list all accounts
accountsRoute.get("/accounts", async (c) => {
  try {
    const allAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        balance: accounts.balance,
        currency: accounts.currency,
        isSystem: accounts.isSystem,
        createdAt: accounts.createdAt,
      })
      .from(accounts);

    return c.json({
      success: true,
      count: allAccounts.length,
      data: allAccounts,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Failed to fetch accounts",
      },
      500
    );
  }
});

// GET /accounts/:id — get single account
accountsRoute.get("/accounts/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));

    if (!account) {
      return c.json(
        {
          success: false,
          error: "Account not found",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: account,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Failed to fetch account",
      },
      500
    );
  }
});

export default accountsRoute;