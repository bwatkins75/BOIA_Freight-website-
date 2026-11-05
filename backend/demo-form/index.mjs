// BOIA Freight "Request a demo" handler (Node.js 22, AWS Lambda, arm64). NOT DEPLOYED.
// Receives the boiafreight.com demo form (JSON POST), verifies the Cloudflare Turnstile token
// server-side, filters spam, rate-limits by IP, and sends one email through SES.
// The destination inbox lives only in the TO_ADDRESS env var, never in the site's HTML/JS/CSS.
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ses = new SESv2Client({});
const ddb = new DynamoDBClient({});
const ssm = new SSMClient({});

const TO = process.env.TO_ADDRESS;                       // recipient inbox (set at deploy time)
const FROM = process.env.FROM_ADDRESS;                   // no-reply sender on the SES-verified domain
const TABLE = process.env.RATE_TABLE;                    // DynamoDB, PK "k" (S), TTL attribute "exp"
const SECRET_PARAM = process.env.TURNSTILE_SECRET_PARAM; // SSM SecureString holding the Turnstile secret
const ALLOWED = (process.env.ALLOWED_ORIGINS || "https://www.boiafreight.com,https://boiafreight.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED_HOSTS = ALLOWED.map((o) => new URL(o).hostname);
const LIMIT_PER_HOUR = Number(process.env.LIMIT_PER_HOUR || 5);
const MIN_FILL_MS = 3000;
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const FLEET = ["1–2 trucks", "3–10 trucks", "11–25 trucks", "26–50 trucks", "51–100 trucks", "More than 100"];
const TIMES = ["Weekday morning (CT)", "Weekday midday (CT)", "Weekday afternoon (CT)", "Any time"];

const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) });
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/i;
const PHONE_RE = /^[0-9+().\-\s]{0,40}$/;

let secretCache;
async function turnstileSecret() {
  if (secretCache) return secretCache;
  const r = await ssm.send(new GetParameterCommand({ Name: SECRET_PARAM, WithDecryption: true }));
  const v = r.Parameter.Value;
  if (v !== "UNSET") secretCache = v; // don't cache the placeholder, so an SSM put takes effect at once
  return v;
}

export async function verifyTurnstile(token, ip, fetchImpl = fetch) {
  if (!token || token.length > 2048) return false;
  const form = new URLSearchParams({ secret: await turnstileSecret(), response: token });
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  try {
    const r = await fetchImpl(SITEVERIFY, { method: "POST", body: form, signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    return d.success === true && ALLOWED_HOSTS.includes(d.hostname);
  } catch (e) {
    console.error("turnstile verify failed", e.name);
    return false; // fail closed: no verified token, no email
  }
}

async function rateLimited(ip) {
  const hour = Math.floor(Date.now() / 3600000);
  try {
    const r = await ddb.send(new UpdateItemCommand({
      TableName: TABLE,
      Key: { k: { S: `${ip}#${hour}` } },
      UpdateExpression: "ADD c :one SET exp = :exp",
      ExpressionAttributeValues: { ":one": { N: "1" }, ":exp": { N: String((hour + 2) * 3600) } },
      ReturnValues: "UPDATED_NEW",
    }));
    return Number(r.Attributes.c.N) > LIMIT_PER_HOUR;
  } catch (e) {
    console.error("rate-limit check failed", e.name);
    return false; // fail open; Turnstile + reserved concurrency still cap abuse
  }
}

function clientIp(event) {
  const xff = event.headers?.["x-forwarded-for"] || "";
  return clean(xff.split(",")[0], 64) || event.requestContext?.http?.sourceIp || "unknown";
}

export const handler = async (event, _ctx, deps = {}) => {
  if (event.requestContext?.http?.method !== "POST") return json(405, { ok: false });
  const origin = event.headers?.origin || "";
  if (origin && !ALLOWED.includes(origin)) return json(403, { ok: false });

  let d;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString() : event.body || "";
    if (raw.length > 8000) return json(413, { ok: false });
    d = JSON.parse(raw);
  } catch { return json(400, { ok: false }); }

  // Honeypot and timing trap: pretend success so bots learn nothing.
  if (clean(d.website, 200) || !d.ts || Date.now() - Number(d.ts) < MIN_FILL_MS) return json(200, { ok: true });

  const name = clean(d.name, 120), company = clean(d.company, 160), email = clean(d.email, 200);
  const fleet = clean(d.fleet, 40), bestTime = clean(d.best_time, 40), phone = clean(d.phone, 40);
  if (!name || !company || !EMAIL_RE.test(email) || !FLEET.includes(fleet) || !TIMES.includes(bestTime) || !PHONE_RE.test(phone)) {
    return json(400, { ok: false, error: "fields" });
  }

  // Until Brian adds the Turnstile secret to SSM, the form is closed: fail closed, send nothing.
  if (!deps.verifyTurnstile && (await turnstileSecret().catch(() => "UNSET")) === "UNSET") return json(503, { ok: false, error: "not_open" });

  const ip = clientIp(event);
  const verify = deps.verifyTurnstile || verifyTurnstile;
  if (!(await verify(clean(d.token, 2048), ip))) return json(400, { ok: false, error: "captcha" });
  if (await (deps.rateLimited || rateLimited)(ip)) return json(429, { ok: false });

  const send = deps.send || ((cmd) => ses.send(cmd));
  await send(new SendEmailCommand({
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [TO] },
    ReplyToAddresses: [email],
    Content: { Simple: {
      Subject: { Data: `BOIA Freight demo request: ${name} (${company}, ${fleet})`.slice(0, 200) },
      Body: { Text: { Data:
        `New demo request from boiafreight.com\n\nName: ${name}\nCompany: ${company}\nFleet size: ${fleet}\n` +
        `Best time: ${bestTime}\nEmail: ${email}\nPhone: ${phone || "-"}\nIP: ${ip}\nReceived: ${new Date().toISOString()}\n` } },
    } },
  }));
  return json(200, { ok: true });
};
