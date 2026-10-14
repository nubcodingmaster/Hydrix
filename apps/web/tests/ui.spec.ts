import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../public/data/majalengka.json', import.meta.url), 'utf8'));

test('government: actual survey, historical rainfall, regional export', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  const first = data.plots[0];
  await page.getByRole('button', { name: `Pilih ${first.name}`, exact: true }).click();
  const popup = page.getByRole('complementary', { name: `Ringkasan ${first.name}` });
  await expect(popup).toBeVisible();
  await expect(popup.getByText('Kelembapan tanah dan NDVI belum tersedia.')).toBeVisible();
  await expect(page.locator('[data-heat-cell]')).not.toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/demo|simulasi|sintetis/i);
  const map = await page.locator('.map-canvas').boundingBox();
  expect(map!.width).toBeGreaterThan(1100);
  await page.getByRole('button', { name: 'Lihat data bulanan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proyeksi hujan 12 bulan' })).toBeVisible();
  await page.getByRole('button', {name:'Riwayat CHIRPS',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Hujan historis CHIRPS' })).toBeVisible();
  await page.getByRole('button', {name:'Peta',exact:true}).click();
  await page.getByRole('button', {name:`Pilih ${first.name}`,exact:true}).click();
  await expect(page.locator('.popover-subtitle')).toHaveText(first.district);
  await expect(page.locator('.source-reference')).toHaveCount(0);
  await expect(page.locator('.sidebar-footer')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Perencanaan wilayah',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region', {name:'Proyeksi hujan 12 bulan'})).toBeVisible();
  await page.getByRole('button', { name: 'Rencanakan semua lokasi', exact: true }).click();
  await expect(page.getByText(`Seluruh ${data.plots.length} lokasi`, { exact: false })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh seluruh data rencana' }).click();
  expect((await downloaded).suggestedFilename()).toBe('hydrix-majalengka-rencana.json');
  expect(errors).toEqual([]);
});

test('mobile farmer: GPS failure, real location selector, readable page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_success: unknown, failure: (error: { code: number }) => void) => failure({ code: 1 }) } }));
  await page.goto('/?view=petani');
  await page.getByRole('button', { name: 'Gunakan lokasi saya' }).click();
  await expect(page.getByText('Lokasi tidak tersedia atau izin ditolak. Pilih lokasi survei.')).toBeVisible();
  await page.getByRole('button', { name: 'Lihat pertimbangan' }).first().click();
  await expect(page.getByRole('button', { name: 'Mengerti', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mengerti', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('body').innerText()).not.toMatch(/demo|simulasi|sintetis/i);
});

test('missing snapshot shows a retry state instead of synthetic data', async ({ page }) => {
  await page.route('**/data/majalengka.json', route => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByText('Data sumber belum dapat dimuat. Coba lagi.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  await expect(page.locator('.map-canvas')).toHaveCount(0);
});
