import { describe, it, expect, vi, afterEach } from "vitest";
import dayjs from "dayjs";
import {
  applyClassTime,
  moveCourseDate,
  readClassTimes,
  resolveCourseTimeSegments,
  segmentCourseTime,
} from "./classTime";
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

describe("分段授课时间", () => {
  it("读取已有的跨日时段并在移动日期时保留跨日天数", () => {
    const range = applyClassTime(
      { start: "23:30", end: "08:50", days: 3 },
      dayjs("2026-09-09"),
    );
    const segments = segmentCourseTime(range);
    expect(resolveCourseTimeSegments(segments)).toEqual({ range });
    const moved = moveCourseDate(segments, "2026-08-27");
    expect(moved).toEqual({
      date: "2026-08-27",
      startTime: "23:30",
      endTime: "08:50",
      endDate: "2026-08-30",
    });
  });

  it("允许逐段编辑并识别同日倒序与错误跨日", () => {
    const segments = { date: "2026-09-09", startTime: "23:30", endTime: "" };
    const { range } = resolveCourseTimeSegments(segments);
    expect(segmentCourseTime(range)).toEqual(segments);
    expect(
      resolveCourseTimeSegments({ ...segments, endTime: "08:50" }).issue,
    ).toBe("结束时间须晚于开始时间。");
    expect(
      resolveCourseTimeSegments({
        ...segments,
        endTime: "08:50",
        endDate: "2026-09-09",
      }),
    ).toEqual({ range, issue: "结束日期须晚于开始日期。" });
  });
});
