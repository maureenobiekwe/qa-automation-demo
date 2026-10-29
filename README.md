# QA automation demo (Zojatech prep)

Runnable examples against public practice sites, written as stand-ins for ZojaPay, Revvex and Mance flows.

| Folder | What | Runs? |
|---|---|---|
| `tests/web/checkout.spec.ts` | Playwright: login, pay, money maths, negative cases (saucedemo.com) | Yes |
| `tests/web/upload.spec.ts` | Playwright: file upload two ways (the-internet.herokuapp.com) | Yes |
| `tests/api/booking-api.spec.ts` | Playwright API: auth, create, read back, 403 without token, idempotency check (restful-booker) | Yes (set `BOOKER_PASS`) |
| `postman/` | The same API flow as a Postman collection (Newman in CI) | Yes |
| `mobile/zojapay-transfer.e2e.ts` | WebdriverIO + Appium transfer test (Android/iOS) | Example (needs the app) |
| `k6/transfer-idempotency.js` | Load + retry-must-not-double-debit check | Example (needs an API) |
| `sql/checks.sql` | Duplicate debits, ledger balance, reconciliation, Revvex/Mance checks | Example |
| `.github/workflows/qa.yml` | CI: PR gate, nightly regression, reports | Yes on GitHub |
| `INTERVIEW-ANSWERS.md` | Answers and snippets | — |

## Run

```powershell
npm install
npx playwright install chromium
npx playwright test tests/web        # web tests, desktop + phone sizes
$env:BOOKER_PASS="<public demo password from restful-booker.herokuapp.com/apidoc>"
npx playwright test tests/api
npx playwright show-report
```
