// Run with Playwright available: node --test tests/delete-entry.cjs
// Optional: PLAYWRIGHT_CHANNEL=chrome (otherwise bundled Chromium).
// Every request is intercepted; these tests never contact a real database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
});
after(async () => { if (browser) await browser.close(); });

const today = '2026-10-21';
const tomorrow = '2026-10-22';
const entry = (id, date, calories) => ({ id, date, meal: 'lunch', text: `Repas fictif ${id}`, calories, protein: 20, carbs: 60, fat: 10 });
async function fixture(t, backups = []) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', serviceWorkers: 'block' });
  t.after(() => ctx.close());
  await ctx.addInitScript(({ backups }) => {
    localStorage.setItem('tom_foodlog_cfg', JSON.stringify({ dbUrl: 'https://foodlog.test/firebase', secret: 'test' }));
    localStorage.setItem('tom_foodlog_local_backup', JSON.stringify(backups));
    window.confirm = window.alert = () => { throw new Error('Native dialogs are unavailable'); };
  }, { backups });
  const f = {
    db: { [today]: { a: entry('a', today, 500), b: entry('b', today, 250) }, [tomorrow]: { a: entry('a', tomorrow, 600) } },
    deletes: [], mode: 'ok', release: null, holdRead: false, releaseRead: null,
  };
  f.deleteStarted = new Promise(resolve => { f.onDelete = resolve; });
  await ctx.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== 'https://foodlog.test') return route.abort();
    const match = url.pathname.match(/^\/firebase\/foodlog\/test\/days\/(\d{4}-\d{2}-\d{2})(?:\/([^/]+))?\.json$/);
    if (match) {
      const [, date, id] = match;
      if (request.method() === 'DELETE') {
        f.deletes.push({ date, id });
        const pending = f.mode === 'hold' ? new Promise(resolve => { f.release = resolve; }) : null;
        f.onDelete();
        if (pending) await pending;
        if (f.mode === 'network') return route.abort('failed');
        if (f.mode === '403') return route.fulfill({ status: 403, json: { error: 'Permission denied' } });
        delete f.db[date][id];
        return route.fulfill({ json: null });
      }
      assert.equal(request.method(), 'GET');
      const snapshot = JSON.stringify(f.db[date] || null);
      if (f.holdRead && date === today) {
        f.holdRead = false;
        await new Promise(resolve => { f.releaseRead = resolve; });
      }
      return route.fulfill({ contentType: 'application/json', body: snapshot });
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.js', 'style.css'].includes(file)) return route.fulfill({ status: 404, body: '' });
    const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
    return route.fulfill({ contentType, body: fs.readFileSync(path.join(__dirname, '..', file)) });
  });
  f.page = await ctx.newPage();
  f.errors = [];
  f.page.on('pageerror', e => f.errors.push(e.message));
  t.after(() => assert.deepEqual(f.errors, []));
  await f.page.clock.setFixedTime(new Date(`${today}T10:00:00Z`));
  await f.page.goto('https://foodlog.test/');
  await f.page.waitForFunction(() => document.querySelectorAll('.meal-item').length === 2);
  f.card = f.page.locator('[data-meal-id="a"]');
  return f;
}
async function openConfirmation(f) { await f.card.locator('.meal-del-btn').tap(); }
async function confirm(f) { await f.card.locator('.meal-delete-confirm').tap(); }
async function total(f, value) {
  await f.page.waitForFunction(value => document.getElementById('valTotalCal').textContent === String(value), value);
}

test('trash opens inline confirmation; cancelling makes no DELETE request', async t => {
  const f = await fixture(t);
  await openConfirmation(f);
  assert.equal(await f.card.locator('.meal-delete-confirmation').isVisible(), true);
  assert.equal(await f.card.locator('.meal-del-btn').getAttribute('aria-expanded'), 'true');
  assert.equal(f.deletes.length, 0);
  if (process.env.FOODLOG_SCREENSHOT) await f.page.screenshot({ path: process.env.FOODLOG_SCREENSHOT, fullPage: true });
  assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await f.card.locator('.meal-delete-cancel').tap();
  assert.equal(await f.card.locator('.meal-delete-confirmation').isVisible(), false);
  assert.equal(f.deletes.length, 0);
  await total(f, 750);
});

test('confirmed deletion removes only its entry and date-scoped backup, updating totals', async t => {
  const f = await fixture(t, [entry('a', today, 500), entry('a', tomorrow, 600)]);
  await openConfirmation(f);
  await confirm(f);
  await total(f, 250);
  assert.deepEqual(f.deletes, [{ date: today, id: 'a' }]);
  assert.equal(await f.card.count(), 0);
  assert.equal(await f.page.locator('[data-meal-id="b"]').count(), 1);
  const backups = await f.page.evaluate(() => JSON.parse(localStorage.getItem('tom_foodlog_local_backup')));
  assert.deepEqual(backups, [entry('a', tomorrow, 600)]);
});

test('double activation cannot submit a second pending deletion', async t => {
  const f = await fixture(t);
  f.mode = 'hold';
  await openConfirmation(f);
  await f.card.locator('.meal-delete-confirm').evaluate(btn => { btn.click(); btn.click(); });
  await f.deleteStarted;
  assert.equal(f.deletes.length, 1);
  assert.equal(await f.card.locator('.meal-delete-confirm').isDisabled(), true);
  assert.equal(await f.card.locator('.meal-delete-cancel').isDisabled(), true);
  await total(f, 750);
  f.mode = 'ok';
  f.release();
  await total(f, 250);
});

for (const mode of ['403', 'network']) {
  test(`${mode} failure keeps entry and backup, displays an error and permits retry`, async t => {
    const f = await fixture(t, [entry('a', today, 500)]);
    f.mode = mode;
    await openConfirmation(f);
    await confirm(f);
    await f.card.locator('.meal-delete-error').waitFor({ state: 'visible' });
    assert.match(await f.card.locator('.meal-delete-error').textContent(), /Suppression impossible/);
    assert.equal(await f.card.locator('.meal-delete-confirm').isEnabled(), true);
    await total(f, 750);
    assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem('tom_foodlog_local_backup')).length), 1);
    f.mode = 'ok';
    await confirm(f);
    await total(f, 250);
    assert.equal(f.deletes.length, 2);
  });
}

test('navigation during deletion retains the new day and deletes the original day only', async t => {
  const f = await fixture(t);
  f.mode = 'hold';
  await openConfirmation(f);
  await confirm(f);
  await f.deleteStarted;
  await f.page.locator('#btnNextDay').tap();
  await total(f, 600);
  f.mode = 'ok';
  const response = f.page.waitForResponse(resp => resp.request().method() === 'DELETE');
  f.release();
  await response;
  await f.page.waitForFunction(() => document.getElementById('toastMsg').textContent === 'Entrée supprimée');
  assert.equal(await f.page.locator('#datePicker').inputValue(), tomorrow);
  await total(f, 600);
  assert.deepEqual(f.deletes, [{ date: today, id: 'a' }]);
  assert.equal(f.db[tomorrow].a.calories, 600);
});

test('a delayed read from an old day cannot replace the current day', async t => {
  const f = await fixture(t);
  f.holdRead = true;
  const oldRequest = f.page.waitForRequest(req => req.url().endsWith(`${today}.json`));
  await f.page.locator('#btnRefresh').tap();
  await oldRequest;
  await f.page.locator('#btnNextDay').tap();
  await total(f, 600);
  const oldResponse = f.page.waitForResponse(resp => resp.url().endsWith(`${today}.json`));
  f.releaseRead();
  await oldResponse;
  await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await f.page.locator('#datePicker').inputValue(), tomorrow);
  await total(f, 600);
});
