export interface KeyValueStorage {
  readonly length: number;
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

const getStorage = (storage?: KeyValueStorage): KeyValueStorage | null => {
  if (storage) return storage;
  return typeof localStorage === "undefined" ? null : localStorage;
};

export const readStorageString = (
  key: string,
  storage?: KeyValueStorage,
): string | null => {
  return getStorage(storage)?.getItem(key) ?? null;
};

export const writeStorageString = (
  key: string,
  value: string,
  storage?: KeyValueStorage,
) => {
  getStorage(storage)?.setItem(key, value);
};

export const readStorageJson = <T>(
  key: string,
  fallback: T,
  storage?: KeyValueStorage,
): T => {
  const value = readStorageString(key, storage);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const writeStorageJson = <T>(
  key: string,
  value: T,
  storage?: KeyValueStorage,
) => {
  writeStorageString(key, JSON.stringify(value), storage);
};

export const removeStorageItem = (
  key: string,
  storage?: KeyValueStorage,
) => {
  getStorage(storage)?.removeItem(key);
};

export const listStorageKeys = (storage?: KeyValueStorage): string[] => {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return [];

  return Array.from({ length: targetStorage.length }, (_, index) =>
    targetStorage.key(index),
  ).filter((key): key is string => Boolean(key));
};
