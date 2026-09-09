import { describe, it, expect, vi, afterEach } from "vitest";
import dayjs from "dayjs";
import { applyClassTime, readClassTimes } from "./classTime";
afterEach(() => vi.unstubAllGlobals());
describe("班级常用时间", () => {
  it("以所选日期应用时段，支持跨午夜", () => {
    const value = applyClassTime(
      { start: "23:30", end: "00:50", days: 1 },
      dayjs("2026-09-09"),
    );
    expect(dayjs(value.start).format("YYYY-MM-DD HH:mm")).toBe(
      "2026-09-09 23:30",
    );
    expect(dayjs(value.end).format("YYYY-MM-DD HH:mm")).toBe(
      "2026-09-10 00:50",
    );
  });
  it("按班级读取多个时段，首项为默认", () => {
    const slots = [
      { start: "08:00", end: "09:50", days: 0 },
      { start: "14:00", end: "15:50", days: 0 },
    ];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) =>
        key === "classTimes:A" ? JSON.stringify(slots) : null,
    });
    expect(readClassTimes("A")).toEqual(slots);
    expect(readClassTimes("B")).toEqual([]);
  });
  it("跳过无效时间与倒序时段", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          null,
          { start: "25:00", end: "26:00", days: 0 },
          { start: "09:00", end: "08:00", days: 0 },
        ]),
    });
    expect(readClassTimes("A")).toEqual([]);
  });
});
