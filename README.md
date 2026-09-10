# Ledger — Daily Savings Collection PWA

A complete daily-collection ("susu") savings system: customer accounts, field
collectors, daily deposit recording with receipts, withdrawal requests, and
an admin dashboard. Installable as a PWA, works offline for the app shell,
built as plain HTML/CSS/JS (no build step) so it deploys straight to GitHub
Pages, with Firebase as the backend (Auth + Firestore database).

## 1. Create your Firebase project (~5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Once created, click the **web icon (`</>`)** to register a web app. Copy the
   `firebaseConfig` object it gives you.
3. Paste those values into `js/firebase-config.js` in this project.
4. In the left menu → **Build → Authentication → Get started** → enable the
   **Email/Password** sign-in method.
5. In the left menu → **Build → Firestore Database → Create database** →
   start in production mode, pick a region close to your users.
6. In Firestore → **Rules** tab, paste in the contents of `firestore.rules`
   from this project and click **Publish**.

## 2. How roles work

There's no separate "sign up as admin/collector/customer" screen — roles are
assigned automatically:

- **The very first person to sign up becomes the admin.** Do this yourself
  first, before sharing the app with anyone else.
- **Collectors and customers are invited by the admin** from the Admin
  dashboard (Collectors tab / Customers tab) using their name, phone, and
  **email**. This creates a record but no login yet.
- That person then signs up on the normal login screen using **the exact
  same email** the admin used. The app automatically links their new login
  to the record the admin created, and gives them the right role.
- Anyone who signs up without being invited first becomes a self-registered
  customer with no collector assigned yet (the admin can assign one from the
  Customers tab).

## 3. Run it locally

No build tools needed. Any static file server works, e.g.:

```
npx serve .
```

Then open the printed local URL. (Opening `index.html` directly as a
`file://` URL won't work — ES modules require a real server.)

## 4. Deploy to GitHub Pages

1. Push this whole folder to a new GitHub repository.
2. In the repo, go to **Settings → Pages** → under "Build and deployment",
   set **Source** to **GitHub Actions**.
3. Push to `main` — the included workflow
   (`.github/workflows/deploy.yml`) will build and publish automatically.
   Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

## 5. What's included

| Feature | Where |
|---|---|
| Customer accounts, balances | `customers` collection |
| Collectors & their routes | `collectors` collection |
| Daily collections + auto receipt numbers | `collections` collection |
| Withdrawal requests + admin approval | `withdrawals` collection |
| Admin dashboard (stats, all tabs) | `js/app.js` → `renderAdmin()` |
| Collector dashboard (record deposits) | `js/app.js` → `renderCollector()` |
| Customer dashboard (balance, history, withdraw) | `js/app.js` → `renderCustomer()` |
| Offline app shell + installable | `manifest.json`, `service-worker.js` |
| Access control | `firestore.rules` |

## 6. Notes & next steps

- Currency is shown as **GHS** (Ghanaian cedi) — change the `money()`
  helper near the top of `js/app.js` if you need a different currency.
- Receipt numbers are generated client-side (`RCT-<timestamp>`); for
  printable/PDF receipts, add a print stylesheet or a "Print receipt" button
  that opens a formatted window.
- There's no email/SMS notification step yet (e.g. notifying a customer
  their withdrawal was approved) — that would need a small Cloud Function,
  since the free static-hosting setup can't send emails on its own.
- Icons in `/icons` are simple placeholders — swap them for your own brand
  mark (keep the 192×192 and 512×512 sizes).
