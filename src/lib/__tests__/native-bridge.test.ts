import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initPullToRefreshGuard, setPullToRefreshEnabled } from '@/lib/native-bridge';

/** MutationObserver callbacks run on the microtask queue; a timer flush covers it. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('setPullToRefreshEnabled', () => {
  it('is a no-op when the shell is not present', () => {
    expect(() => setPullToRefreshEnabled(false)).not.toThrow();
  });

  it('forwards to the shell when present', () => {
    const setPull = vi.fn();
    window.FamilyLedgerAndroid = {
      saveBase64: () => 'saved',
      appVersion: () => '0.0.0-test',
      setPullToRefreshEnabled: setPull,
    };

    setPullToRefreshEnabled(false);
    setPullToRefreshEnabled(true);

    expect(setPull).toHaveBeenNthCalledWith(1, false);
    expect(setPull).toHaveBeenNthCalledWith(2, true);
    delete window.FamilyLedgerAndroid;
  });
});

describe('initPullToRefreshGuard', () => {
  const setPull = vi.fn();

  beforeAll(() => {
    initPullToRefreshGuard();
  });

  beforeEach(() => {
    setPull.mockClear();
    window.FamilyLedgerAndroid = {
      saveBase64: () => 'saved',
      appVersion: () => '0.0.0-test',
      setPullToRefreshEnabled: setPull,
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.FamilyLedgerAndroid;
  });

  it('disables refresh while a dialog is mounted and restores it on close', async () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    await flush();
    expect(setPull).toHaveBeenLastCalledWith(false);

    dialog.remove();
    await flush();
    expect(setPull).toHaveBeenLastCalledWith(true);
  });

  it('treats alert dialogs the same way', async () => {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alertdialog');
    document.body.appendChild(alert);
    await flush();
    expect(setPull).toHaveBeenLastCalledWith(false);

    alert.remove();
    await flush();
    expect(setPull).toHaveBeenLastCalledWith(true);
  });

  it('leaves refresh alone while a non-modal overlay is open', async () => {
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    await flush();
    expect(setPull).not.toHaveBeenCalledWith(false);
    menu.remove();
  });

  it('keeps a single observer even when initialised twice', async () => {
    initPullToRefreshGuard();
    initPullToRefreshGuard();
    setPull.mockClear();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    await flush();
    expect(setPull).toHaveBeenCalledTimes(1);
    expect(setPull).toHaveBeenCalledWith(false);

    dialog.remove();
    await flush();
    expect(setPull).toHaveBeenCalledTimes(2);
    expect(setPull).toHaveBeenLastCalledWith(true);
  });
});