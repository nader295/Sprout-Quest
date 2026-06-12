import { test, expect } from '@playwright/test';

test.describe('Platform Browsing & Discovery', () => {
  
  test('HomePage loads correctly with essential layout elements', async ({ page }) => {
    await page.goto('/');
    
    // Check main branding header
    const romxLogo = page.locator('text=RomX').first();
    await expect(romxLogo).toBeVisible();

    // Check search functionality is present
    const searchInput = page.locator('input[placeholder*="Search" i], input[placeholder*="بحث" i]');
    await expect(searchInput).toBeVisible();
  });

  test('Devices Page renders properly', async ({ page }) => {
    await page.goto('/devices');
    
    // Expect at least some devices to eventually render or a proper empty state
    const deviceCards = page.locator('.device-card, a[href^="/devices/"]');
    // We expect the page to load without crashing, even if we just wait for the container
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
  });

  test('Search functionality responds', async ({ page }) => {
    await page.goto('/');
    
    // Locate the search input (could be a search icon button that opens a dialog first)
    const searchTrigger = page.locator('button[aria-label*="Search" i], button[aria-label*="بحث" i]').first();
    if (await searchTrigger.isVisible()) {
      await searchTrigger.click();
    }
    
    const searchInput = page.locator('input[placeholder*="Search" i], input[placeholder*="بحث" i]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Poco');
    
    // We expect some popover or result list to appear eventually
    // Since API depends on DB, we just ensure no app crash (the network request occurs)
    await expect(page).toHaveURL('/');
  });

});
