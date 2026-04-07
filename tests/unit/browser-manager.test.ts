// Unit tests for BrowserManager — pool logic, semaphore, queue, cleanup

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { BrowserManager } from '../../src/utils/browser';

// We mock Playwright to test pool logic without launching real browsers
const mockPage = (closed = false) => ({
  _closed: closed,
  isClosed() { return this._closed; },
  close: mock(async function(this: any) { this._closed = true; }),
});

const mockContext = () => {
  const ctx = {
    newPage: mock(async () => mockPage()),
    close: mock(async () => {}),
  };
  return ctx;
};

const mockBrowser = () => {
  const ctx = mockContext();
  const browser = {
    _connected: true,
    _handlers: {} as Record<string, Function>,
    isConnected() { return this._connected; },
    newContext: mock(async () => ctx),
    close: mock(async function(this: any) { this._connected = false; }),
    on(event: string, handler: Function) { this._handlers[event] = handler; },
  };
  return { browser, ctx };
};

// Patch chromium.launch on the BrowserManager prototype
function createTestManager(maxPages: number) {
  const { browser, ctx } = mockBrowser();
  const manager = new BrowserManager(maxPages);

  // Override private ensureBrowser to return our mock
  (manager as any).ensureBrowser = async () => {
    (manager as any).browser = browser;
    return browser;
  };
  // Override ensureContext to return our mock context
  (manager as any).ensureContext = async () => {
    (manager as any).context = ctx;
    return ctx;
  };
  // Override isConnected to use mock
  (manager as any).browser = browser;

  return { manager, browser, ctx };
}

describe('BrowserManager', () => {
  test('acquirePage returns a page and increments active count', async () => {
    const { manager } = createTestManager(5);
    const page = await manager.acquirePage();
    expect(page).toBeDefined();
    expect(manager.getActivePagesCount()).toBe(1);
    await manager.releasePage(page as any);
  });

  test('releasePage decrements active count', async () => {
    const { manager } = createTestManager(5);
    const page = await manager.acquirePage();
    expect(manager.getActivePagesCount()).toBe(1);
    await manager.releasePage(page as any);
    expect(manager.getActivePagesCount()).toBe(0);
  });

  test('releasePage closes the page', async () => {
    const { manager } = createTestManager(5);
    const page = await manager.acquirePage();
    await manager.releasePage(page as any);
    expect((page as any).close).toHaveBeenCalled();
  });

  test('pool respects maxPages limit', async () => {
    const { manager } = createTestManager(2);
    const p1 = await manager.acquirePage();
    const p2 = await manager.acquirePage();
    expect(manager.getActivePagesCount()).toBe(2);

    // Third acquire should queue (we test by racing with a timeout)
    let acquired = false;
    const p3Promise = manager.acquirePage().then((p) => { acquired = true; return p; });

    // Give it a tick — should NOT have resolved yet
    await new Promise((r) => setTimeout(r, 50));
    expect(acquired).toBe(false);
    expect(manager.getActivePagesCount()).toBe(2);

    // Release one — should unblock the queued request
    await manager.releasePage(p1 as any);
    const p3 = await p3Promise;
    expect(acquired).toBe(true);
    expect(manager.getActivePagesCount()).toBe(2); // p2 + p3

    await manager.releasePage(p2 as any);
    await manager.releasePage(p3 as any);
    expect(manager.getActivePagesCount()).toBe(0);
  });

  test('FIFO queue order is maintained', async () => {
    const { manager } = createTestManager(1);
    const p1 = await manager.acquirePage();

    const order: number[] = [];
    const p2Promise = manager.acquirePage().then((p) => { order.push(2); return p; });
    const p3Promise = manager.acquirePage().then((p) => { order.push(3); return p; });

    // Release p1 — should give slot to p2 first (FIFO)
    await manager.releasePage(p1 as any);
    const p2 = await p2Promise;

    await manager.releasePage(p2 as any);
    const p3 = await p3Promise;

    expect(order).toEqual([2, 3]);

    await manager.releasePage(p3 as any);
  });

  test('isConnected returns correct state', async () => {
    const { manager, browser } = createTestManager(5);
    // After acquiring a page, browser should be "connected"
    const page = await manager.acquirePage();
    expect(manager.isConnected()).toBe(true);

    browser._connected = false;
    expect(manager.isConnected()).toBe(false);

    await manager.releasePage(page as any);
  });

  test('getActivePagesCount never goes below 0', async () => {
    const { manager } = createTestManager(5);
    // Release without acquire — should stay at 0
    await manager.releasePage(mockPage() as any);
    expect(manager.getActivePagesCount()).toBe(0);
  });

  test('destroy rejects queued waiters', async () => {
    const { manager } = createTestManager(1);
    const p1 = await manager.acquirePage();

    let rejected = false;
    const p2Promise = manager.acquirePage().catch(() => { rejected = true; });

    await manager.destroy();
    await p2Promise;
    expect(rejected).toBe(true);
    expect(manager.getActivePagesCount()).toBe(0);
  });

  test('destroy resets active pages to 0', async () => {
    const { manager } = createTestManager(5);
    await manager.acquirePage();
    await manager.acquirePage();
    expect(manager.getActivePagesCount()).toBe(2);

    await manager.destroy();
    expect(manager.getActivePagesCount()).toBe(0);
  });

  test('default maxPages is 5 when env not set', () => {
    const saved = process.env.MAX_BROWSER_PAGES;
    delete process.env.MAX_BROWSER_PAGES;
    const manager = new BrowserManager();
    // Access private field
    expect((manager as any).maxPages).toBe(5);
    process.env.MAX_BROWSER_PAGES = saved;
  });

  test('maxPages reads from MAX_BROWSER_PAGES env var', () => {
    const saved = process.env.MAX_BROWSER_PAGES;
    process.env.MAX_BROWSER_PAGES = '3';
    const manager = new BrowserManager();
    expect((manager as any).maxPages).toBe(3);
    process.env.MAX_BROWSER_PAGES = saved;
  });
});
