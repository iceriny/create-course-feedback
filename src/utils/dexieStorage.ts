import { db } from "../db/db";

/**
 * DexieStorage 类 - 提供类似 localStorage 的 API
 * 使用 IndexedDB 作为底层存储，支持异步操作和实时查询
 */
export class DexieStorage {
  /**
   * 设置存储项
   * @param key 键名
   * @param value 值（会自动进行 JSON 序列化）
   * @returns Promise<void>
   */
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await db.storage.put({ key, value: serializedValue });
    } catch (error) {
      console.error(`Failed to set item with key "${key}":`, error);
      throw error;
    }
  }

  /**
   * 获取存储项
   * @param key 键名
   * @returns Promise<T | null> 返回反序列化后的值，如果不存在则返回 null
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const item = await db.storage.get(key);
      if (!item) {
        return null;
      }
      return JSON.parse(item.value) as T;
    } catch (error) {
      console.error(`Failed to get item with key "${key}":`, error);
      return null;
    }
  }

  /**
   * 删除存储项
   * @param key 键名
   * @returns Promise<void>
   */
  async removeItem(key: string): Promise<void> {
    try {
      await db.storage.delete(key);
    } catch (error) {
      console.error(`Failed to remove item with key "${key}":`, error);
      throw error;
    }
  }

  /**
   * 清空所有存储项
   * @returns Promise<void>
   */
  async clear(): Promise<void> {
    try {
      await db.storage.clear();
    } catch (error) {
      console.error("Failed to clear storage:", error);
      throw error;
    }
  }

  /**
   * 获取所有键名
   * @returns Promise<string[]>
   */
  async getAllKeys(): Promise<string[]> {
    try {
      return (await db.storage.toCollection().keys()) as string[];
    } catch (error) {
      console.error("Failed to get all keys:", error);
      return [];
    }
  }

  /**
   * 获取所有键值对
   * @returns Promise<[string, T][]> 返回 [key, value] 数组
   */
  async getAllEntries<T>(): Promise<[string, T][]> {
    try {
      const items = await db.storage.toArray();
      return items.map((item) => {
        try {
          const value = JSON.parse(item.value) as T;
          return [item.key, value] as [string, T];
        } catch (error) {
          console.error(`Failed to parse value for key "${item.key}":`, error);
          return [item.key, null as unknown as T] as [string, T];
        }
      });
    } catch (error) {
      console.error("Failed to get all entries:", error);
      return [];
    }
  }

  /**
   * 检查键是否存在
   * @param key 键名
   * @returns Promise<boolean>
   */
  async hasItem(key: string): Promise<boolean> {
    try {
      const count = await db.storage.where("key").equals(key).count();
      return count > 0;
    } catch (error) {
      console.error(`Failed to check item with key "${key}":`, error);
      return false;
    }
  }
}

// 导出默认实例
export const dexieStorage = new DexieStorage();
