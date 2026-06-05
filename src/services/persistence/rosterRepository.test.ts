import { beforeEach, describe, expect, it } from "vitest";

import type { KeyValueStorage } from "./localStorageRepository";
import {
  readStorageString,
  writeStorageJson,
} from "./localStorageRepository";
import {
  getRosterStorageKey,
  readRosterStudents,
  writeRosterStudents,
} from "./rosterRepository";

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

describe("roster repository", () => {
  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("reads legacy roster data and writes normalized students", () => {
    writeStorageJson(getRosterStorageKey("cpp0608"), [" 张三 "], storage);

    expect(readRosterStudents("cpp0608", storage)).toEqual([
      { name: "张三", gender: "male", version: "v2" },
    ]);

    writeRosterStudents(
      "cpp0608",
      [{ name: "李四", gender: "female", version: "v1" }],
      storage,
    );

    expect(readStorageString(getRosterStorageKey("cpp0608"), storage)).toBe(
      '[{"name":"李四","gender":"female","version":"v1"}]',
    );
  });
});
