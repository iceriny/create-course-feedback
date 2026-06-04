import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { dexieStorage, type DexieStorage as DexieStorageType } from '../utils/dexieStorage';

/**
 * React Hook - 实时获取和操作 Dexie 存储
 *
 * @param key 存储键名
 * @param storage 可选的存储实例，默认使用全局 dexieStorage 实例
 * @returns [value, setValue, removeValue] 三元组
 *   - value: 当前存储的值（未加载时为 undefined，不存在时为 null）
 *   - setValue: 设置值的函数
 *   - removeValue: 删除值的函数
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [count, setCount, removeCount] = useDexieStorage<number>('count');
 *
 *   return (
 *     <div>
 *       <p>Count: {count ?? 0}</p>
 *       <button onClick={() => setCount((count ?? 0) + 1)}>Increment</button>
 *       <button onClick={removeCount}>Remove</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDexieStorage<T>(
  key: string,
  storage: DexieStorageType = dexieStorage
): [T | null | undefined, (value: T | ((prev: T | null) => T)) => Promise<void>, () => Promise<void>] {
  // 使用 useLiveQuery 实时监听数据变化
  const value = useLiveQuery(async () => {
    const item = await db.storage.get(key);
    if (!item) {
      return null;
    }
    try {
      return JSON.parse(item.value) as T;
    } catch (error) {
      console.error(`Failed to parse value for key "${key}":`, error);
      return null;
    }
  }, [key]) as T | null | undefined;

  // 设置值的函数，支持直接设置值或通过函数更新
  const setValue = useCallback(
    async (newValue: T | ((prev: T | null) => T)) => {
      if (typeof newValue === 'function') {
        // 如果是函数，先获取当前值，然后调用函数
        const currentValue = await storage.getItem<T>(key);
        const updatedValue = (newValue as (prev: T | null) => T)(currentValue);
        await storage.setItem(key, updatedValue);
      } else {
        // 直接设置值
        await storage.setItem(key, newValue);
      }
    },
    [key, storage]
  );

  // 删除值的函数
  const removeValue = useCallback(async () => {
    await storage.removeItem(key);
  }, [key, storage]);

  return [value, setValue, removeValue];
}
