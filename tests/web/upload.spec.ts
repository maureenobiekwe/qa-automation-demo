/**
 * File upload, as for a Revvex budget/actuals import or a KYC document in ZojaPay.
 * Never drive the operating system's file dialog: set the file on the input directly.
 */
import { expect, test } from '@playwright/test';
import path from 'path';

const file = (name: string) => path.join(__dirname, '..', '..', 'test-data', name);

test('upload a statement through the file input', async ({ page }) => {
  await page.goto('https://the-internet.herokuapp.com/upload');
  // The page has two file inputs (the form and a hidden drag-and-drop one), so a bare
  // input[type="file"] fails Playwright's strict mode. Target the one we mean.
  await page.locator('#file-upload').setInputFiles(file('bank-statement.pdf'));
  await page.getByRole('button', { name: 'Upload' }).click();
  // Check it really worked: the UI names the file. In a real app I'd also wait for the API
  // response (status 201 + file id) and check the record exists in the database or storage.
  await expect(page.locator('#uploaded-files')).toHaveText('bank-statement.pdf');
});

test('upload when the button opens a file chooser instead of a visible input', async ({ page }) => {
  await page.goto('https://the-internet.herokuapp.com/upload');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#drag-drop-upload').click(),
  ]);
  await chooser.setFiles(file('transactions-valid.csv'));
  await expect(page.locator('#drag-drop-upload')).toContainText('transactions-valid.csv');
});

// Negative cases I'd run against the real import (shown here as the list I'd automate):
// wrong type (.exe instead of CSV/XLSX), over the size limit, empty file (test-data/empty.csv),
// bad values (test-data/transactions-bad.csv: amount "abc"), special characters in the file name,
// and the same file uploaded twice (must not double-count Revvex actuals).
