/**
 * API tests on a public practice API (restful-booker), used as a stand-in for a ZojaPay transfer API:
 * get a token, create a record, read it back, check auth on writes, and check what happens when the
 * same request is sent twice (idempotency, the most important payment check).
 * Run with BOOKER_PASS set to the public demo password from https://restful-booker.herokuapp.com/apidoc.
 */
import { expect, test } from '@playwright/test';

const API = 'https://restful-booker.herokuapp.com';
const body = {
  firstname: 'Ada',
  lastname: 'Okafor',
  totalprice: 12500,
  depositpaid: true,
  bookingdates: { checkin: '2026-11-01', checkout: '2026-11-03' },
  additionalneeds: 'None',
};

test.describe.serial('create, read, update and protect a record', () => {
  let token = '';
  let id = 0;

  test('auth: valid credentials give a token, wrong ones do not', async ({ request }) => {
    test.skip(!process.env.BOOKER_PASS, 'Set BOOKER_PASS (public demo password from the API docs)');
    const ok = await request.post(`${API}/auth`, { data: { username: 'admin', password: process.env.BOOKER_PASS } });
    expect(ok.status()).toBe(200);
    token = (await ok.json()).token;
    expect(token).toBeTruthy();

    const bad = await request.post(`${API}/auth`, { data: { username: 'admin', password: `${process.env.BOOKER_PASS}x` } });
    expect((await bad.json()).token).toBeUndefined();
  });

  test('create: 200, the response echoes what was sent, with the right types', async ({ request }) => {
    const res = await request.post(`${API}/booking`, { data: body });
    expect(res.status()).toBe(200);
    const json = await res.json();
    id = json.bookingid;
    expect(typeof id).toBe('number');
    expect(json.booking).toEqual(body); // schema + values in one check
  });

  test('read back: what was stored is what was sent (round trip)', async ({ request }) => {
    const res = await request.get(`${API}/booking/${id}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(body);
  });

  test('authorisation: changing a record without a token is refused', async ({ request }) => {
    const res = await request.put(`${API}/booking/${id}`, { data: { ...body, totalprice: 1 } });
    expect(res.status()).toBe(403);
    const after = await (await request.get(`${API}/booking/${id}`)).json();
    expect(after.totalprice).toBe(12500); // and nothing changed
  });

  test('update with a token works', async ({ request }) => {
    test.skip(!token, 'needs the token');
    const res = await request.put(`${API}/booking/${id}`, {
      headers: { Cookie: `token=${token}` },
      data: { ...body, totalprice: 15000 },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).totalprice).toBe(15000);
  });

  test('delete with a token, then it is gone', async ({ request }) => {
    test.skip(!token, 'needs the token');
    expect((await request.delete(`${API}/booking/${id}`, { headers: { Cookie: `token=${token}` } })).status()).toBe(201);
    expect((await request.get(`${API}/booking/${id}`)).status()).toBe(404);
  });
});

test('idempotency check: the same request twice', async ({ request }) => {
  // This practice API is NOT idempotent: two identical POSTs make two records. That is fine for a
  // booking demo, but for a ZojaPay transfer it would be a double debit. The real test sends the
  // same Idempotency-Key twice (also in parallel) and expects ONE transfer and the same reference.
  const [a, b] = await Promise.all([
    request.post(`${API}/booking`, { data: body }),
    request.post(`${API}/booking`, { data: body }),
  ]);
  const ids = [(await a.json()).bookingid, (await b.json()).bookingid];
  test.info().annotations.push({ type: 'finding', description: `two records created: ${ids.join(', ')}` });
  expect(ids[0]).not.toBe(ids[1]); // documents the behaviour; for payments this assertion is inverted
});

test('validation: a malformed body is refused, not a 500 in production', async ({ request }) => {
  const res = await request.post(`${API}/booking`, { data: { firstname: 'Ada' } });
  // restful-booker answers 500 here, a known weakness of the practice API: a payment API should answer 400.
  test.info().annotations.push({ type: 'finding', description: `status ${res.status()} for a missing-fields body` });
  expect([400, 500]).toContain(res.status());
});
