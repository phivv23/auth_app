import { Router } from "express";

import { query } from "./db/pool.js";

export async function checkDatabaseReady() {
  await query("SELECT 1 AS ok");
}

export function createHealthRouter({
  databaseCheck = checkDatabaseReady,
} = {}) {
  const router = Router();

  router.get(["/", "/live"], (req, res) => {
    res.json({
      ok: true,
      status: "live",
      requestId: res.locals.requestId,
    });
  });

  router.get("/ready", async (req, res) => {
    try {
      await databaseCheck();

      return res.json({
        ok: true,
        status: "ready",
        checks: {
          database: "ok",
        },
        requestId: res.locals.requestId,
      });
    } catch {
      return res.status(503).json({
        ok: false,
        status: "not_ready",
        checks: {
          database: "unavailable",
        },
        requestId: res.locals.requestId,
      });
    }
  });

  return router;
}
