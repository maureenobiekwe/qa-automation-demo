/**
 * Illustrative WebdriverIO + Appium test for a ZojaPay transfer on Android (UiAutomator2).
 * Not runnable here (needs the app build and an emulator); it shows the structure I would use.
 * Selectors use accessibility ids (`~id`) so the same test works on Android and iOS.
 *
 * wdio.conf capabilities (Android):
 *   platformName: 'Android', 'appium:automationName': 'UiAutomator2',
 *   'appium:deviceName': 'Pixel_7_API_34', 'appium:app': './apps/zojapay-qa.apk',
 *   'appium:autoGrantPermissions': false   // so permission prompts are tested, not skipped
 * iOS: platformName 'iOS', automationName 'XCUITest', app './apps/ZojaPay.app'.
 */
import { $, browser, driver, expect } from '@wdio/globals';

const TestUser = { phone: process.env.ZP_PHONE!, pin: process.env.ZP_PIN! }; // from CI secrets, never hard-coded

async function login() {
  await $('~phone-input').setValue(TestUser.phone);
  await $('~continue-button').click();
  for (const digit of TestUser.pin) await $(`~pin-key-${digit}`).click();
  await expect($('~home-balance')).toBeDisplayed();
}

async function balance(): Promise<number> {
  const text = await $('~home-balance').getText(); // e.g. "₦50,000.00"
  return Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 100); // kobo, no float errors
}

describe('ZojaPay: transfer to another ZojaPay account', () => {
  beforeEach(async () => {
    await driver.activateApp('com.zojatech.zojapay');
    await login();
  });

  it('debits the exact amount once and shows a receipt', async () => {
    const before = await balance();
    await $('~transfer-button').click();
    await $('~recipient-input').setValue('0801 234 5678');
    await expect($('~recipient-name')).toHaveText(expect.stringContaining('Ada')); // name check before paying
    await $('~amount-input').setValue('1500');
    await $('~send-button').click();
    await $('~send-button').click(); // double tap must not send twice
    for (const digit of TestUser.pin) await $(`~pin-key-${digit}`).click();

    await expect($('~receipt-status')).toHaveText('Successful');
    const reference = await $('~receipt-reference').getText();
    await $('~done-button').click();
    expect(await balance()).toBe(before - 150000);
    // Then via API/DB: exactly one transaction with this reference, ledger debit = credit.
    expect(reference).toMatch(/^[A-Z0-9-]{8,}$/);
  });

  it('refuses an amount above the balance with a clear message', async () => {
    await $('~transfer-button').click();
    await $('~recipient-input').setValue('0801 234 5678');
    await $('~amount-input').setValue('99999999');
    await $('~send-button').click();
    await expect($('~error-message')).toHaveText(expect.stringContaining('Insufficient'));
  });

  it('survives going to the background in the middle of a transfer', async () => {
    await $('~transfer-button').click();
    await $('~amount-input').setValue('1000');
    await driver.background(5); // app in background 5 s (phone call, switching apps)
    await expect($('~amount-input')).toHaveText('1000'); // state kept, or a clear re-auth, never a silent half-transfer
  });

  it('shows a clear state when the network drops after Send', async () => {
    await $('~transfer-button').click();
    await $('~recipient-input').setValue('0801 234 5678');
    await $('~amount-input').setValue('500');
    await driver.setNetworkConnection(0); // airplane mode (Android emulator)
    await $('~send-button').click();
    await expect($('~error-message')).toHaveText(expect.stringContaining('connection'));
    await driver.setNetworkConnection(6); // wifi + data back
    // Then: the transaction is either clearly failed (no debit) or pending and reconciled, never debited without a receipt.
  });

  afterEach(async () => {
    await driver.terminateApp('com.zojatech.zojapay');
    await browser.saveScreenshot(`./reports/${Date.now()}.png`);
  });
});
