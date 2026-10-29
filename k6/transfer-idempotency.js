// k6 load + idempotency check for a transfer endpoint (illustrative: point BASE_URL at a test environment).
// Run: k6 run -e BASE_URL=https://api.test.example -e TOKEN=... k6/transfer-idempotency.js
import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: {
    // 50 users sending transfers for 2 minutes
    steady: { executor: 'constant-vus', vus: 50, duration: '2m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // under 1% errors
    http_req_duration: ['p(95)<800'], // 95% of transfers under 800 ms
  },
};

const headers = (key) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${__ENV.TOKEN}`,
  'Idempotency-Key': key,
});

export default function () {
  const key = uuidv4();
  const body = JSON.stringify({ toAccount: '0801234567', amountKobo: 10000, narration: 'k6 test' });

  // Same key sent twice: a retry after a timeout must not create a second debit.
  const first = http.post(`${__ENV.BASE_URL}/transfers`, body, { headers: headers(key) });
  const retry = http.post(`${__ENV.BASE_URL}/transfers`, body, { headers: headers(key) });

  check(first, { 'first: 201 created': (r) => r.status === 201 });
  check(retry, {
    'retry: not a second transfer (200/409)': (r) => r.status === 200 || r.status === 409,
    'retry: same reference': (r) => r.json('reference') === first.json('reference'),
  });
}
