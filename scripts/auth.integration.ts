// Local database only. Exercises stored OTPs and the QR API lifecycle without sending email.
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const database = new URL(process.env.DATABASE_URL || "");
assert.ok(["127.0.0.1", "localhost"].includes(database.hostname));
assert.equal(database.pathname, "/tp_team_backend_local");
const base = new URL(process.env.LOCAL_TEST_BASE_URL || "http://127.0.0.1:3000");
assert.equal(base.hostname, "127.0.0.1");
const db = new PrismaClient(), tokens: string[] = [], codes: string[] = [];
let scanToken: string | undefined;
async function call(path: string, body = {}, token?: string, expected = 200) {
  const response = await fetch(new URL(path, base), {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, expected, path);
  return response.json();
}
async function run() {
  try {
    const email = "local-test@example.com";
    await db.user.findUniqueOrThrow({ where: { email } });
    for (const path of ["/api/auth/verify-code", "/api/user/login/vericode"]) {
      const code = String(randomInt(100000, 800000));
      const record = await db.verificationCode.create({ data: { email, code, expiresAt: new Date(Date.now() + 300000) } });
      codes.push(record.id);
      const login = await call(path, { email, code, veriCode: code });
      assert.ok(login.token); tokens.push(login.token);
      assert.equal((await db.verificationCode.findUniqueOrThrow({ where: { id: record.id } })).consumed, true);
      console.log(`${path}: stored verification code consumed, login passed`);
    }
    const qr = await call("/api/auth/qr-login/create");
    scanToken = qr.scanToken;
    assert.ok(scanToken && qr.browserSecret);
    const input = { scanToken, browserSecret: qr.browserSecret };
    assert.equal((await call("/api/auth/qr-login/status", input)).status, "pending");
    await call("/api/auth/qr-login/status", { ...input, browserSecret: "invalid-secret" }, undefined, 404);
    await call("/api/user/web-login/qr/confirm", { scanToken }, undefined, 401);
    assert.equal((await call("/api/user/web-login/qr/confirm", { scanToken }, tokens[0])).confirmed, true);
    const done = await call("/api/auth/qr-login/status", input);
    assert.equal(done.status, "authenticated"); assert.ok(done.token); tokens.push(done.token);
    assert.equal((await call("/api/auth/qr-login/status", input)).token, done.token);
    assert.equal((await call("/api/photo/list/v1", { groupID: "local-workspace-demo" }, done.token)).totalCount, 67);
    console.log("QR creation, pending, confirmation, session exchange, repeat polling and existing App photo API passed");
    await call("/api/auth/logout", {}, done.token);
    await call("/api/photo/list/v1", { groupID: "local-workspace-demo" }, done.token, 401);
    console.log("Invalid QR secret, unauthenticated confirmation and revoked session rejected");
  } finally {
    if (scanToken) await db.webQrLoginSession.deleteMany({ where: { scanToken } });
    if (tokens.length) await db.session.deleteMany({ where: { token: { in: tokens } } });
    if (codes.length) await db.verificationCode.deleteMany({ where: { id: { in: codes } } });
    await db.$disconnect();
  }
}
void run();
