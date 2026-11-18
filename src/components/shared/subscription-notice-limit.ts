type NoticeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Claims one display of a subscription notice while respecting its persistent limit.
 */
export function claimNoticeDisplay(
  key: string,
  maxCount: number,
  storage: NoticeStorage | null,
  fallbackCounts: Map<string, number>,
  onStorageError: (error: unknown) => void,
): boolean {
  let count = fallbackCounts.get(key) ?? 0;

  if (storage) {
    try {
      const savedCount = storage.getItem(key);
      if (savedCount === 'shown') {
        count = Math.max(count, 1);
      } else if (savedCount !== null) {
        const parsedCount = Number.parseInt(savedCount, 10);
        if (Number.isFinite(parsedCount) && parsedCount >= 0) {
          count = Math.max(count, parsedCount);
        }
      }
    } catch (error) {
      onStorageError(error);
    }
  }

  if (count >= maxCount) {
    fallbackCounts.set(key, count);
    return false;
  }

  const nextCount = count + 1;
  fallbackCounts.set(key, nextCount);
  if (storage) {
    try {
      storage.setItem(key, String(nextCount));
    } catch (error) {
      onStorageError(error);
    }
  }
  return true;
}
