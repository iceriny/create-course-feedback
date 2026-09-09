import { beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryStorage } from "../../test/memoryStorage";
const { bulkPut } = vi.hoisted(() => ({ bulkPut: vi.fn() }));
vi.mock("../../db/db", () => ({
  db: {
    storage: { toArray: async () => [{ key: "v2", value: "{}" }], bulkPut },
    transaction: async (
      _mode: string,
      _table: unknown,
      callback: () => Promise<void>,
    ) => callback(),
  },
}));
import { createBackup, parseBackup, restoreBackup } from "./backup";
beforeEach(() => {
  installMemoryStorage();
  localStorage.clear();
  bulkPut.mockReset();
});
describe("backup workflow", () => {
  it("round trips raw strings and JSON without including credentials", async () => {
    localStorage.setItem("promptKey", "programming");
    localStorage.setItem("api_key:custom", "secret");
    localStorage.setItem("class-name", '["A"]');
    const backup = parseBackup(JSON.stringify(await createBackup()));
    localStorage.clear();
    await restoreBackup(backup);
    expect(localStorage.getItem("promptKey")).toBe("programming");
    expect(localStorage.getItem("class-name")).toBe('["A"]');
    expect(localStorage.getItem("api_key:custom")).toBeNull();
    expect(bulkPut).toHaveBeenCalledWith([{ key: "v2", value: "{}" }]);
  });
  it("rolls local changes back when database restoration fails", async () => {
    localStorage.setItem("promptKey", "before");
    bulkPut.mockRejectedValue(new Error("quota"));
    await expect(
      restoreBackup({
        version: 1,
        local: { promptKey: "after", newItem: "new" },
        indexed: {},
      }),
    ).rejects.toThrow();
    expect(localStorage.getItem("promptKey")).toBe("before");
    expect(localStorage.getItem("newItem")).toBeNull();
  });
  it("rejects incompatible versions and malformed drafts", () => {
    expect(() => parseBackup('{"version":2}')).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: 1,
          local: { "lessonDraft:A": "{}" },
          indexed: {},
        }),
      ),
    ).toThrow();
  });
});
