/**
 * A purchase flow on a public demo shop (saucedemo.com), used as a stand-in for a ZojaPay payment:
 * log in, pick items, pay, and check the money is right. The money check is the point: in a
 * payment app the total shown, the total charged and the receipt must agree to the kobo.
 */
import { expect, test, type Page } from '@playwright/test';

// The demo site prints its public test login on the page; read it rather than hard-coding it.
async function login(page: Page) {
  await page.goto('https://www.saucedemo.com/');
  const users = (await page.locator('#login_credentials').innerText()).split('\n');
  const pass = (await page.locator('.login_password').innerText()).split('\n').pop()!.trim();
  await page.getByPlaceholder('Username').fill(users.find((u) => u.trim() === 'standard_user')!.trim());
  await page.getByPlaceholder('Password').fill(pass);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/inventory/);
}

const money = (s: string) => Math.round(parseFloat(s.replace(/[^0-9.]/g, '')) * 100); // to cents: no float errors

test('pay for two items: item total + tax = total', async ({ page }) => {
  await login(page);
  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
  await expect(page.locator('.shopping_cart_badge')).toHaveText('2');

  await page.locator('.shopping_cart_link').click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByPlaceholder('First Name').fill('Ada');
  await page.getByPlaceholder('Last Name').fill('Okafor');
  await page.getByPlaceholder('Zip/Postal Code').fill('100001');
  await page.getByRole('button', { name: 'Continue' }).click();

  const prices = await page.locator('.inventory_item_price').allInnerTexts();
  const itemTotal = money(await page.locator('.summary_subtotal_label').innerText());
  const tax = money(await page.locator('.summary_tax_label').innerText());
  const total = money(await page.locator('.summary_total_label').innerText());

  expect(itemTotal).toBe(prices.reduce((sum, p) => sum + money(p), 0));
  expect(total).toBe(itemTotal + tax);

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Thank you for your order!')).toBeVisible();
  // A second "Finish" must not create a second order: the button is gone (no double charge).
  await expect(page.getByRole('button', { name: 'Finish' })).toHaveCount(0);
});

test('payment is blocked when a required field is missing', async ({ page }) => {
  await login(page);
  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  await page.locator('.shopping_cart_link').click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByPlaceholder('First Name').fill('Ada');
  await page.getByPlaceholder('Last Name').fill('Okafor');
  await page.getByRole('button', { name: 'Continue' }).click(); // no postal code
  await expect(page.locator('[data-test="error"]')).toContainText('Postal Code is required');
  await expect(page).toHaveURL(/checkout-step-one/); // did not move on to payment
});

test('a locked account cannot log in and gets a clear message', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  const pass = (await page.locator('.login_password').innerText()).split('\n').pop()!.trim();
  await page.getByPlaceholder('Username').fill('locked_out_user');
  await page.getByPlaceholder('Password').fill(pass);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('[data-test="error"]')).toContainText('locked out');
});
