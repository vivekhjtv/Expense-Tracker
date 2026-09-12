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

`web/vercel.json` already handles the SPA rewrite (so `/transactions` does not 404 on
refresh), security headers, and long-lived caching for hashed assets.

---

## 4. Close the loop

Set `CORS_ORIGINS` on Render to your Vercel URL and let it redeploy:

```
CORS_ORIGINS=https://your-app.vercel.app
```

Multiple origins are comma-separated. Include a custom domain here too if you add one.

---

## 5. Keep the API awake

**Do this, or the app takes 30–60s to load.** Render's free tier suspends a web
service after 15 minutes with no traffic. The next request has to start the
container, boot Nest, connect to Atlas and build indexes before it can answer —
so opening the app after a quiet spell looks broken, and *saving* a spend is just
as slow.

The fix is to knock on the door before you arrive: an external scheduler calls
`/api/health` often enough that the service never goes to sleep. That endpoint is
`@Public` (no token) and reads only the connection state (no database round
trip), so the ping costs nothing.

**[cron-job.org](https://cron-job.org)** — free, no credit card:

| Field | Value |
|---|---|
| URL | `https://<your-api>.onrender.com/api/health` |
| Timezone | `Asia/Kolkata` |
| Schedule | minutes `0,10,20,30,40,50`, hours `6-23` |

Then **Test run** — expect `200` with `{"status":"ok","database":"connected"}`.

**Every 10 minutes**, because spin-down is at 15 — that leaves room for one
missed ping.

**Hours 6–23, not round the clock.** Render grants **750 instance-hours per
workspace per month**, and a suspended service consumes none. Pinging 6am–midnight
keeps it awake ~555 hours a month, comfortably inside the grant. Pinging 24/7
costs ~730 of 750: it fits, but with no margin, and a second free web service in
the same workspace would push the workspace over and suspend everything until the
next month. The frontend is on Vercel and Render static sites don't consume
instance hours, so this one API is the only thing spending them.

The trade-off is honest: open the app at 3am and you wait the full cold start,
because nothing pinged it. Widen the hours if that happens often.

**Confirming it works:** Render's **Events** tab should stop showing
"Service suspended" / "Service resumed" during the pinged hours. That is the
direct proof, not a guess.

If cron-job.org ever changes, any uptime monitor does the same job — UptimeRobot's
free plan checks every 5 minutes, which is also inside the 15-minute window.
Nothing in this repo depends on which one you use.

---

## 6. Verify

1. Open the Vercel URL → you should land on the sign-in screen
2. Create an account → you land on the dashboard
3. Add a spend → it appears in the transactions list
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
| busy right now | Google is shedding load. The server already retries 3 times with backoff; if it still fails the spike is sustained — try again shortly, or switch `GEMINI_MODEL` to a less busy model |

The API key is redacted from every log line and every response.

---

## Things to know

**Render free tier sleeps** after ~15 minutes idle, and the next request pays 30–60s to
wake it — for reads *and* writes. Section 5 sets up the free ping that prevents it. The
alternative is a paid instance, which simply never sleeps.

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
