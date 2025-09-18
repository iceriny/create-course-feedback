/**
 * 优化的 localStorage 操作工具
 * 批量操作、错误处理、性能优化
 */

interface LocalStorageData {
  [key: string]: string | null;
}

/**
 * 批量读取 localStorage 数据
 * @param keys 要读取的键名数组
 * @returns 包含所有数据的对象
 */
export function batchGetLocalStorage(keys: string[]): LocalStorageData {
  const result: LocalStorageData = {};

  for (const key of keys) {
    try {
      result[key] = localStorage.getItem(key);
    } catch (error) {
      console.warn(`读取 localStorage 键 "${key}" 失败:`, error);
      result[key] = null;
    }
  }

  return result;
}

/**
 * 批量设置 localStorage 数据
 * @param data 要设置的数据对象
 */
export function batchSetLocalStorage(data: Record<string, string>): void {
  for (const [key, value] of Object.entries(data)) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`设置 localStorage 键 "${key}" 失败:`, error);
    }
  }
}

/**
 * 安全解析 JSON 字符串
 * @param jsonString JSON 字符串
 * @param defaultValue 解析失败时的默认值
 * @returns 解析结果或默认值
 */
export function safeJsonParse<T>(
  jsonString: string | null,
  defaultValue: T,
): T {
  if (!jsonString) return defaultValue;

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn("JSON 解析失败:", error);
    return defaultValue;
  }
}

/**
 * 安全序列化对象为 JSON
 * @param data 要序列化的数据
 * @returns JSON 字符串或 null（失败时）
 */
export function safeJsonStringify(data: unknown): string | null {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn("JSON 序列化失败:", error);
    return null;
  }
}

/**
 * 延迟执行函数（防抖）
 * @param func 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * 检查 localStorage 可用性
 * @returns 是否可用
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = "__test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}
