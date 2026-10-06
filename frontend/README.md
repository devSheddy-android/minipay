# MiniPay React frontend

A complete local demo UI for the existing MiniPay Spring Boot API: create profiles, open wallets, add simulated KES funds, send transfers, and view history and receipts.

## Start on Windows

Extract the ZIP into your MiniPay project root, the folder containing `pom.xml`. The result should be `minipay\frontend\package.json`, alongside the backend's `src` folder. This frontend does not replace the backend Java files.

You need Node.js 22.12 or newer, plus npm. Check:

```powershell
node -v
npm -v
```

If needed, install a current Node.js LTS release from https://nodejs.org and reopen VS Code.

In terminal 1, from the backend root:

```powershell
.\mvnw.cmd spring-boot:run
```

Leave MySQL and Spring Boot running with the working `db-local.properties` configuration. Wait for `Started MinipayApplication`.

In terminal 2, also starting at the backend root:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The UI loads actual users from your database. An empty database shows the create-profile screen.

If PowerShell blocks `npm.ps1`, use `npm.cmd install` and `npm.cmd run dev` instead. If port 5173 is already occupied, stop the older frontend process and rerun the command.

## How React connects to Spring Boot

`src/lib/api.js` calls relative URLs such as `fetch('/api/users')`. The Vite server forwards `/api` requests to `http://localhost:8080`, keeping the path unchanged. Spring Boot handles the request through its existing controller, service, and repository, then returns JSON to React.

The browser talks to the React server on port 5173. With this setup, a Spring CORS configuration or `@CrossOrigin` annotation is not needed. Do not change the fetch URLs to port 8080 while relying on this proxy.

If your backend uses another address, copy `.env.example` to `.env.local`, edit `MINIPAY_BACKEND_URL`, and restart Vite. This value configures the local server. Database passwords belong only in the backend configuration; never add them to frontend files.

## Try the full flow

1. Create a profile and click **Create wallet**.
2. Click **Add demo funds**, enter `1000.00`, and submit once.
3. Create a second profile and its wallet. Leave its balance at zero.
4. Use **Demo profile** to select the first profile again.
5. Under **Send money**, select the second profile and enter `250.00`.
6. Click **Review transfer**, check the recipient, then **Confirm transfer**.
7. Expect a receipt, a sender balance of KES 750.00, and a receiver balance of KES 250.00. Switch profiles to check both.
8. Open **Activity** to filter sent/received transfers and open a receipt. Refresh the browser to check that database data remains available.

## Files to learn first

| File | Purpose |
| --- | --- |
| `vite.config.js` | Forwards API requests to Spring Boot |
| `src/lib/api.js` | Fetch requests, response parsing, and API errors |
| `src/App.jsx` | Loads profiles, wallet balances, and history |
| `src/components/Forms.jsx` | Profile, top-up, and transfer forms |
| `src/components/History.jsx` | Transfer history and receipt links |
| `src/styles.css` | Desktop and mobile layout |

## API contract

| Action | Method and path | JSON body |
| --- | --- | --- |
| List profiles | `GET /api/users` | None |
| Create profile | `POST /api/users` | `fullName`, `email` |
| Find a profile's wallet | `GET /api/wallets/user/{userId}` | None |
| Create wallet | `POST /api/wallets` | `userId` |
| Add demo funds | `POST /api/wallets/{walletId}/topups` | `amount` |
| Send transfer | `POST /api/transfers` | `senderWalletId`, `receiverWalletId`, `amount` |
| List wallet transfers | `GET /api/transfers/wallet/{walletId}` | None |
| Read receipt | `GET /api/transfers/{transferId}` | None |

Expected responses: users have `id`, `fullName`, and `email`; wallets have `id`, `balance`, and `currency`; transfers have `id`, `reference`, `senderWalletId`, `receiverWalletId`, `amount`, `currency`, and `createdAt`. Lists are JSON arrays. Errors may include `message`.

Money stays as decimal text and integer cents in React. `lossless-json` preserves full decimal values and Java Long IDs in responses. Validated numeric JSON is sent to Spring's `BigDecimal` fields without converting money through JavaScript floating-point arithmetic.

The frontend validates amount syntax and reviews the recipient. The existing backend remains responsible for sufficient funds, currency matching, concurrency, and database transactions. Requests are disabled while a submission is pending. Writes are never retried automatically; if the connection fails after submission, refresh balances and history before submitting again.

## Build and checks

```powershell
npm test
npm run build
npm run preview
```

Preview opens on http://localhost:4173 and also proxies to the running backend. The package includes focused tests for decimal precision, invalid inputs, exact request bodies, and API failures.

This frontend was checked against the provided MiniPay controller contracts. Its production build and all 10 focused tests passed. DOM interaction checks also exercised the profile, wallet, funding, transfer, receipt, and error flows through the Vite proxy using a temporary API fixture. Your actual Windows Spring Boot/MySQL application still needs the manual flow above.

## Optional: serve the frontend from Spring Boot

For a single local server, build the frontend and place the **contents** of `frontend/dist` in the backend's `src/main/resources/static` folder, then restart Spring Boot. Use that folder for the MiniPay UI; preserve any unrelated files before copying over it. Open http://localhost:8080.

The built UI calls same-origin `/api` URLs, so it works when served by Spring Boot. Navigation uses React state, so no SPA route fallback is required. The Vite proxy itself is only for local development and preview; it is not part of a production static build.

## Current scope

MiniPay is a portfolio demo with simulated funds. Profile switching is a demo feature, not login or wallet ownership enforcement. Authentication and request idempotency remain backend follow-up work. Transfer history contains wallet-to-wallet transfers, not demo top-ups.
