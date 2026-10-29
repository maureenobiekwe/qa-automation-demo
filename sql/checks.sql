-- Data checks I run after a test or when investigating a failure (PostgreSQL syntax; table names illustrative).

-- 1. Did the transfer create exactly one transaction for this reference?
SELECT reference, COUNT(*) AS n
FROM transactions
WHERE reference = 'ZP-20261030-0001'
GROUP BY reference;            -- expect n = 1

-- 2. Duplicate debits: same wallet, same amount, within 60 seconds (double tap / retry bug)
SELECT a.wallet_id, a.amount_kobo, a.created_at, b.created_at
FROM transactions a
JOIN transactions b
  ON a.wallet_id = b.wallet_id
 AND a.amount_kobo = b.amount_kobo
 AND a.id < b.id
 AND b.created_at - a.created_at < INTERVAL '60 seconds'
WHERE a.type = 'DEBIT' AND b.type = 'DEBIT';

-- 3. Ledger balance: every transfer's debits equal its credits
SELECT transfer_id,
       SUM(CASE WHEN entry = 'DEBIT'  THEN amount_kobo ELSE 0 END) AS debits,
       SUM(CASE WHEN entry = 'CREDIT' THEN amount_kobo ELSE 0 END) AS credits
FROM ledger_entries
GROUP BY transfer_id
HAVING SUM(CASE WHEN entry = 'DEBIT' THEN amount_kobo ELSE 0 END)
    <> SUM(CASE WHEN entry = 'CREDIT' THEN amount_kobo ELSE 0 END);   -- expect no rows

-- 4. Wallet balance matches the sum of its transactions (reconciliation)
SELECT w.id, w.balance_kobo, COALESCE(SUM(t.signed_amount_kobo), 0) AS computed
FROM wallets w
LEFT JOIN transactions t ON t.wallet_id = w.id AND t.status = 'SUCCESS'
GROUP BY w.id, w.balance_kobo
HAVING w.balance_kobo <> COALESCE(SUM(t.signed_amount_kobo), 0);       -- expect no rows

-- 5. Transfers stuck in PENDING for more than 15 minutes (need reconciliation)
SELECT id, reference, created_at
FROM transactions
WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '15 minutes';

-- 6. Revvex: imported actuals not double-counted (same file imported twice)
SELECT budget_line_id, period, source_file_hash, COUNT(*)
FROM actuals
GROUP BY budget_line_id, period, source_file_hash
HAVING COUNT(*) > 1;

-- 7. Mance: an appraisal score is within range and every submitted appraisal has a reviewer
SELECT id FROM appraisals
WHERE status = 'SUBMITTED' AND (score NOT BETWEEN 1 AND 5 OR reviewer_id IS NULL);
