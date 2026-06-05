import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import express from "express";

process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "root";
process.env.DB_PASSWORD ||= "rootpassword";
process.env.DB_NAME ||= "auth_app";
process.env.JWT_SECRET ||= "development_secret_with_enough_length";
process.env.NODE_ENV ||= "test";

const { createHealthRouter } = await import("../src/health.js");

const servers = [];

after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
        })
    )
  );
});

async function request(app, path) {
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

describe("health routes", () => {
  it("returns live status without touching the database", async () => {
    const app = express();
    app.use("/api/health", createHealthRouter());

    const response = await request(app, "/api/health/live");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.status, "live");
  });

  it("returns ready when the database check succeeds", async () => {
    const app = express();
    app.use(
      "/api/health",
      createHealthRouter({
        databaseCheck: async () => {},
      })
    );

    const response = await request(app, "/api/health/ready");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ready");
    assert.equal(response.body.checks.database, "ok");
  });

  it("does not expose database error details when readiness fails", async () => {
    const app = express();
    app.use(
      "/api/health",
      createHealthRouter({
        databaseCheck: async () => {
          throw new Error("password leaked in driver error");
        },
      })
    );

    const response = await request(app, "/api/health/ready");

    assert.equal(response.status, 503);
    assert.equal(response.body.status, "not_ready");
    assert.equal(response.body.checks.database, "unavailable");
    assert.equal(JSON.stringify(response.body).includes("password leaked"), false);
  });
});
