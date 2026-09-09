# Deploying

Frontend on **Vercel** (static Angular), API on **Render** (long-running Node).

They are two separate deployments — Angular compiles to static files, NestJS is a
server. Deploy the API first, because the frontend needs its URL at build time.

---

## 1. Push to GitHub

Both apps live in one repo. `.env` is gitignored; confirm before pushing:

```bash
git init && git add -A && git status   # check no .env is listed
git commit -m "Expense tracker"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

---

## 2. API on Render

**New → Web Service → connect the repo.** Render reads `api/render.yaml`, or set it
manually:

| Setting | Value |
|---|---|
| Root Directory | `api` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/api/health` |

Environment variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas connection string |
| `GEMINI_API_KEY` | your Google AI Studio key |
| `JWT_SECRET` | **a new random 32+ char secret** — see below |
| `CORS_ORIGINS` | your Vercel URL (fill in after step 3) |
| `MAX_UPLOAD_SIZE_MB` | `10` |

Generate the JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> Do not reuse your local secret, and never commit it. Anyone holding it can mint a
> token for any user. Changing it later signs everyone out, which is the correct
> emergency response if it leaks.

**Atlas Network Access:** Render's outbound IPs are dynamic on the free plan, so add
`0.0.0.0/0`. Your database is still protected by its username and password. If that
bothers you, Render's paid plans offer static outbound IPs you can allowlist instead.

Confirm it booted: `https://<your-api>.onrender.com/api/health` should return
`{"status":"ok","database":"connected"}`.

---

## 3. Frontend on Vercel

Set the API URL **before** deploying — it is compiled into the bundle:

```ts
// web/src/environments/environment.production.ts
apiBaseUrl: 'https://<your-api>.onrender.com',   // no trailing slash, no /api
```

Commit that, then in Vercel: **New Project → import the repo.**

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework Preset | Other |
| Build Command | `npm run build` |
| Output Directory | `dist/web/browser` |

`web/vercel.json` already handles the SPA rewrite (so `/ledger` does not 404 on
refresh), security headers, and long-lived caching for hashed assets.

---

## 4. Close the loop

Set `CORS_ORIGINS` on Render to your Vercel URL and let it redeploy:

```
CORS_ORIGINS=https://your-app.vercel.app
```

Multiple origins are comma-separated. Include a custom domain here too if you add one.

---

## 5. Verify

1. Open the Vercel URL → you should land on the sign-in screen
2. Create an account → you land on the dashboard
3. Add a spend → it appears in the ledger
4. Scan a receipt → the form fills in
5. Open in a private window → you must be signed out

---

## If receipt scanning fails

`GET /api/receipts/health` (needs a bearer token) makes a tiny Gemini call and reports
in plain English whether the credentials work:

```bash
TOKEN=$(curl -s -X POST https://<your-api>.onrender.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s https://<your-api>.onrender.com/api/receipts/health -H "authorization: Bearer $TOKEN"
```

`{"ok":true,...}` means Gemini is reachable and the key is good — any scan failure after
that is about the photo, not the setup.

When it fails, the response quotes Google verbatim and **probes other models** to find
ones that actually respond:

```json
{
  "ok": false,
  "model": "gemini-2.5-flash",
  "googleSaid": "models/gemini-2.5-flash is not found for API version v1beta",
  "workingModels": ["gemini-flash-latest", "gemini-3.5-flash"],
  "suggestion": "Set GEMINI_MODEL=gemini-flash-latest on your host and redeploy."
}
```

Test any candidate without redeploying by passing it directly:

```bash
curl -s "https://<your-api>.onrender.com/api/receipts/health?model=gemini-flash-latest" \
  -H "authorization: Bearer $TOKEN"
```

If `workingModels` is empty, no model responded — that points at the API key, not the
model name. Other causes it names:

| Message says | Fix |
|---|---|
| GEMINI_API_KEY is not valid | Re-copy the key; check for a trailing space |
| Generative Language API is turned off | Enable it in the key's Google Cloud project, or make a fresh key at aistudio.google.com/apikey |
| quota is used up | Free-tier limit hit; wait, or use another key |
| model … is not available to this API key | Set `GEMINI_MODEL` to one your key can use |
| restricted … referrers or IP addresses | The key has restrictions that block a server call |
| region | Google does not serve Gemini where the API is hosted |

The API key is redacted from every log line and every response.

---

## Things to know

**Render free tier sleeps** after ~15 minutes idle. The next request takes 30–60s to
wake it, so the first load after a quiet spell feels broken. Fixes: upgrade to the paid
instance, or ping `/api/health` on a schedule.

**Atlas free tier (M0)** is fine for personal use, but has no automated backups. If
this data matters, take an occasional `mongodump`.

**Rotating the Gemini key** is a dashboard change plus a redeploy — no code touches it.

**Tokens last 30 days** (`JWT_EXPIRES_IN`) and are stored in `localStorage`. There is no
server-side revocation: signing out clears the device, but an already-issued token stays
valid until it expires. For a personal app that is a reasonable trade; if you need real
revocation, that means refresh tokens and a session store.

**Why not the API on Vercel?** Serverless functions cap request bodies at ~4.5 MB, and
phone photos are routinely larger, so receipt scanning would fail on real bills. Cold
starts, a 10–60s function timeout against a 2–8s Gemini call, and per-instance Mongo
connection pools all point the same way. A long-running process avoids all four.
