import { beforeEach, describe, expect, it } from "vitest";

import type { KeyValueStorage } from "./localStorageRepository";
import {
  listStorageKeys,
  readStorageJson,
  readStorageString,
  removeStorageItem,
  writeStorageJson,
  writeStorageString,
} from "./localStorageRepository";

const createMemoryStorage = (): KeyValueStorage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe("local storage repository", () => {
  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("reads and writes string values", () => {
    writeStorageString("name", "cpp0608", storage);

    expect(readStorageString("name", storage)).toBe("cpp0608");
  });

  it("reads and writes json values with a fallback", () => {
    writeStorageJson("students", [{ name: "张三" }], storage);
    writeStorageString("broken", "{", storage);

    expect(readStorageJson("students", [], storage)).toEqual([
      { name: "张三" },
    ]);
    expect(readStorageJson("broken", ["fallback"], storage)).toEqual([
      "fallback",
    ]);
  });

  it("lists and removes storage keys", () => {
    writeStorageString("a", "1", storage);
    writeStorageString("b", "2", storage);
    removeStorageItem("a", storage);

    expect(listStorageKeys(storage)).toEqual(["b"]);
  });
});
