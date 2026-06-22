import { createWebStorageAdapter } from '@/src/shared/storage/web-storage';

describe('web storage adapter', () => {
  it('rejects the undefined localStorage exposed by React Native window globals', () => {
    expect(createWebStorageAdapter(undefined)).toBeNull();
  });

  it('wraps a usable browser localStorage implementation', async () => {
    const values = new Map<string, string>();
    const storage = createWebStorageAdapter({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    await storage?.setItem('lesson', 'cached');
    await expect(storage?.getItem('lesson')).resolves.toBe('cached');
  });
});
