const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { test } = require("node:test")
const vm = require("node:vm")
const ts = require("typescript")

// Execute the real auth implementation with an in-memory Session delegate.
// No database connection or application credentials are needed.
function setup() {
  const sessions = new Map()
  let writes = 0
  const user = { id: "user-1", deletedAt: null }
  const prisma = { session: {
    async create({ data }) {
      const session = { id: data.token, ...data, user }
      sessions.set(data.token, session)
      return session
    },
    async findUnique({ where }) { return sessions.get(where.token) ?? null },
    async deleteMany({ where }) {
      return { count: sessions.delete(where.token) ? 1 : 0 }
    },
    async updateMany({ where, data }) {
      writes++
      const session = [...sessions.values()].find((row) => row.id === where.id)
      if (!session) return { count: 0 }
      Object.assign(session, data)
      return { count: 1 }
    },
  } }
  const source = readFileSync(require.resolve("../lib/auth.ts"), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, Date,
    require: (name) => name === "@/lib/prisma" ? { prisma } : require(name),
  })
  return { auth: exports, sessions, user, prisma, writes: () => writes }
}

test("new sessions are persistent and retain their device identity", async () => {
  const { auth, sessions } = setup()
  const session = await auth.createSession("user-1", "device-1")
  assert.match(session.token, /^[a-f0-9]{64}$/)
  assert.equal(session.expiresAt.toISOString(), "9999-12-31T23:59:59.999Z")
  assert.equal(sessions.get(session.token).appInstanceID, "device-1")
})

// Exercise the real refresh/logout routes and auth code, stubbing only transport
// helpers, unrelated user metadata, and database access.
function loadSessionRoute(name, state) {
  const source = readFileSync(require.resolve(`../app/api/user/${name}/route.ts`), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const dependencies = {
    "next/server": { NextResponse: Response },
    "@/lib/auth": state.auth,
    "@/lib/prisma": { prisma: state.prisma },
    "@/app/api/_utils/api": {
      ok: (body = {}) => Response.json(body),
      bad: (error, status) => Response.json({ error }, { status }),
      readBody: (req) => req.json(),
      requireUser: async (req) => (await state.auth.authenticate(req))?.user ?? null,
    },
    "@/lib/user-registration-metadata": {
      fillMissingUserRegistrationMetadata: async (user) => user,
    },
  }
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, console,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected route dependency: ${name}`)
      return dependencies[name]
    },
  })
  return exports.POST
}

function sessionRequest(token) {
  return new Request("https://example.test/api/user/token/refresh", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ appInstanceID: "device-1" }),
  })
}

test("repeated and concurrent refreshes preserve the original session and credential", async () => {
  const state = setup()
  const { token } = await state.auth.createSession(state.user.id, "device-1")
  const originalSession = state.sessions.get(token)
  const refresh = loadSessionRoute("token/refresh", state)
  // Discard the first response, as if it were lost before the client saved it.
  assert.equal((await refresh(sessionRequest(token))).status, 200)
  const responses = await Promise.all(Array.from({ length: 8 }, () => refresh(sessionRequest(token))))
  for (const response of responses) {
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { token })
  }
  assert.equal(state.sessions.size, 1)
  assert.equal(state.sessions.get(token), originalSession)
  assert.equal((await state.auth.authenticate(sessionRequest(token))).user, state.user)
})

test("refresh rejects missing, unknown, logged-out and deleted-account credentials", async () => {
  const state = setup()
  const refresh = loadSessionRoute("token/refresh", state)
  for (const token of [null, "unknown"]) {
    assert.equal((await refresh(sessionRequest(token))).status, 401)
  }
  const { token } = await state.auth.createSession(state.user.id)
  const logout = loadSessionRoute("logout", state)
  assert.equal((await logout(sessionRequest(token))).status, 200)
  assert.equal((await refresh(sessionRequest(token))).status, 401)
  assert.equal(state.sessions.size, 0)
  const second = await state.auth.createSession(state.user.id)
  state.user.deletedAt = new Date()
  assert.equal((await refresh(sessionRequest(second.token))).status, 401)
  assert.equal(state.sessions.size, 1)
})

for (const expiry of ["2020-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z"]) {
  test(`existing session dated ${expiry} remains usable and upgrades once`, async () => {
    const { auth, sessions, user, writes } = setup()
    sessions.set("old-token", { id: "old", expiresAt: new Date(expiry), user })
    const result = await auth.verifyAndRefreshToken("old-token")
    assert.equal(result.user, user)
    assert.equal(result.expiresAt.toISOString(), auth.SESSION_EXPIRES_AT)
    await auth.verifyAndRefreshToken("old-token")
    assert.equal(writes(), 1)
  })
}

test("missing, revoked, and deleted-account credentials are rejected", async () => {
  const { auth, sessions, user } = setup()
  assert.equal(await auth.verifyAndRefreshToken("unknown"), null)
  const { token } = await auth.createSession(user.id)
  sessions.delete(token)
  assert.equal(await auth.verifyAndRefreshToken(token), null)
  const second = await auth.createSession(user.id)
  user.deletedAt = new Date()
  assert.equal(await auth.verifyAndRefreshToken(second.token), null)
  assert.equal(await auth.authenticate(new Request("https://example.test")), null)
})

test("revocation during legacy upgrade does not recreate the session", async () => {
  const { auth, sessions, user, prisma } = setup()
  sessions.set("old-token", { id: "old", expiresAt: new Date(0), user })
  prisma.session.updateMany = async () => {
    sessions.clear()
    return { count: 0 }
  }
  assert.equal(await auth.verifyAndRefreshToken("old-token"), null)
  assert.equal(sessions.size, 0)
})
