import Dexie, { type EntityTable } from "dexie";

/**
 * 存储项接口
 */
interface StorageItem {
  key: string;
  value: string; // JSON 字符串化的值
}

/**
 * Dexie 数据库类
 */
class StorageDatabase extends Dexie {
  storage!: EntityTable<StorageItem, "key">;

  constructor() {
    super("StorageDatabase");
    this.version(1).stores({
      storage: "key", // key 作为主键
    });
  }
}

// 创建并导出数据库实例
export const db = new StorageDatabase();
