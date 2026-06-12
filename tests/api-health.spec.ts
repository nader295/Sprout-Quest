import { test, expect } from '@playwright/test';

test.describe('API Health Checks', () => {

  test('devices/suggest returns properly formatted responses', async ({ request }) => {
    const response = await request.get('/api/devices/suggest?q=poco');
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('suggestions');
    expect(Array.isArray(json.suggestions)).toBeTruthy();
  });

  test('community stats API responds correctly', async ({ request }) => {
    const response = await request.get('/api/community');
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('total');
    expect(json).toHaveProperty('countries');
  });

  // Protected Cron Health Endpoint
  test('cron health endpoint returns 401 without secret', async ({ request }) => {
    const response = await request.get('/api/cron');
    // Should be unauthorized since we didn't provide CRON_SECRET auth header
    expect(response.status()).toBe(401);
  });

});
