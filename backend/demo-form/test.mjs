// Offline tests: no AWS calls (SES, DynamoDB and Turnstile are stubbed).
import test from "node:test";
import assert from "node:assert/strict";
process.env.TO_ADDRESS = "inbox@example.test"; process.env.FROM_ADDRESS = "no-reply@example.test";
const { handler } = await import("./index.mjs");
const ok = { name: "Pat Driver", company: "Test Haulers", fleet: "3–10 trucks", best_time: "Any time", email: "pat@example.test", phone: "", website: "", ts: String(Date.now() - 10000), token: "tok" };
const ev = (body, origin = "https://www.boiafreight.com") => ({ requestContext: { http: { method: "POST", sourceIp: "1.2.3.4" } }, headers: { origin }, body: JSON.stringify(body) });
const deps = (sent, captcha = true) => ({ verifyTurnstile: async () => captcha, rateLimited: async () => false, send: async (c) => sent.push(c.input) });

test("valid request sends one email to the env recipient", async () => {
  const sent = []; const r = await handler(ev(ok), {}, deps(sent));
  assert.equal(r.statusCode, 200); assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].Destination.ToAddresses, ["inbox@example.test"]);
  assert.deepEqual(sent[0].ReplyToAddresses, ["pat@example.test"]);
});
test("failed captcha sends nothing", async () => { const s = []; const r = await handler(ev(ok), {}, deps(s, false)); assert.equal(r.statusCode, 400); assert.equal(s.length, 0); });
test("honeypot pretends success, sends nothing", async () => { const s = []; const r = await handler(ev({ ...ok, website: "x" }), {}, deps(s)); assert.equal(r.statusCode, 200); assert.equal(s.length, 0); });
test("too-fast submit sends nothing", async () => { const s = []; await handler(ev({ ...ok, ts: String(Date.now()) }), {}, deps(s)); assert.equal(s.length, 0); });
test("foreign origin rejected", async () => { const s = []; const r = await handler(ev(ok, "https://evil.test"), {}, deps(s)); assert.equal(r.statusCode, 403); });
test("bad fleet value rejected", async () => { const s = []; const r = await handler(ev({ ...ok, fleet: "9000" }), {}, deps(s)); assert.equal(r.statusCode, 400); });
test("header injection stripped from subject", async () => { const s = []; await handler(ev({ ...ok, name: "A\r\nBcc: x@y.z" }), {}, deps(s)); assert.ok(!/[\r\n]/.test(s[0].Content.Simple.Subject.Data)); });
