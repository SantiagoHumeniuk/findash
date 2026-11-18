import { describe, expect, it, vi } from 'vitest';
import { claimNoticeDisplay } from './subscription-notice-limit';

function createStorage(values: Map<string, string> = new Map<string, string>()): Storage {
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    get length() {
      return values.size;
    },
  };
}

describe('claimNoticeDisplay', () => {
  it('allows at most two expired-plan notices across component mounts', () => {
    const values = new Map<string, string>();
    const storage = createStorage(values);
    const key = 'subscription_notice_user_request_expired';
    const reportStorageError = vi.fn();

    expect(claimNoticeDisplay(key, 2, storage, new Map(), reportStorageError)).toBe(true);
    expect(claimNoticeDisplay(key, 2, storage, new Map(), reportStorageError)).toBe(true);
    expect(claimNoticeDisplay(key, 2, storage, new Map(), reportStorageError)).toBe(false);
    expect(values.get(key)).toBe('2');
    expect(reportStorageError).not.toHaveBeenCalled();
  });

  it('counts the previous one-time marker as the first display', () => {
    const key = 'subscription_notice_user_request_expired';
    const storage = createStorage(new Map([[key, 'shown']]));

    expect(claimNoticeDisplay(key, 2, storage, new Map(), vi.fn())).toBe(true);
    expect(claimNoticeDisplay(key, 2, storage, new Map(), vi.fn())).toBe(false);
  });

  it('uses the in-memory limit and reports errors if storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('Storage unavailable'); }),
      setItem: vi.fn(() => { throw new Error('Storage unavailable'); }),
    };
    const fallbackCounts = new Map<string, number>();
    const reportStorageError = vi.fn();
    const key = 'subscription_notice_user_request_expired';

    expect(claimNoticeDisplay(key, 2, storage, fallbackCounts, reportStorageError)).toBe(true);
    expect(claimNoticeDisplay(key, 2, storage, fallbackCounts, reportStorageError)).toBe(true);
    expect(claimNoticeDisplay(key, 2, storage, fallbackCounts, reportStorageError)).toBe(false);
    expect(reportStorageError).toHaveBeenCalled();
  });
});
