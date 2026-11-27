import dayjs from "dayjs";
import type { LessonCourse } from "./lesson";

const dateFormat = "YYYY-MM-DD";
const timeFormat = "HH:mm";

type CourseTime = Pick<LessonCourse, "start" | "end">;

export interface CourseTimeSegments {
  date: string;
  startTime: string;
  endTime: string;
  endDate?: string;
}

export function segmentCourseTime({
  start,
  end,
}: CourseTime): CourseTimeSegments {
  const first = dayjs(start);
  const last = dayjs(end);
  const firstDate = first.isValid() ? first.format(dateFormat) : "";
  const lastDate = last.isValid() ? last.format(dateFormat) : "";
  return {
    date: firstDate || lastDate,
    startTime: firstDate ? first.format(timeFormat) : "",
    endTime: lastDate ? last.format(timeFormat) : "",
    endDate:
      firstDate && lastDate && firstDate !== lastDate ? lastDate : undefined,
  };
}

export function moveCourseDate(segments: CourseTimeSegments, date: string) {
  const { endDate } = segments;
  if (!date || endDate === undefined || (!segments.date && endDate)) {
    return { ...segments, date };
  }

  const days =
    segments.date && endDate ? dayjs(endDate).diff(segments.date, "day") : 1;
  return {
    ...segments,
    date,
    endDate: dayjs(date).add(Math.max(1, days), "day").format(dateFormat),
  };
}

function localTimestamp(date: string, time: string) {
  if (!date || !time) return "";
  const local = `${date}T${time}`;
  const timestamp = dayjs(local);
  return timestamp.isValid() &&
    timestamp.format(`${dateFormat}T${timeFormat}`) === local
    ? timestamp.toISOString()
    : "";
}

export function resolveCourseTimeSegments(segments: CourseTimeSegments): {
  range: CourseTime;
  issue?: string;
} {
  const { date, startTime, endTime, endDate } = segments;
  const finalDate = endDate ?? date;
  const start = localTimestamp(date, startTime);
  const end = localTimestamp(finalDate, endTime);

  if (date && endDate && endDate <= date) {
    return { range: { start, end: "" }, issue: "结束日期须晚于开始日期。" };
  }
  const range = { start, end };
  if ((date && startTime && !start) || (finalDate && endTime && !end)) {
    return { range, issue: "请选择当地有效的日期和时间。" };
  }
  if (start && end && !dayjs(end).isAfter(start)) {
    return { range, issue: "结束时间须晚于开始时间。" };
  }
  return { range };
}

export interface ClassTime {
  start: string;
  end: string;
  days: number;
}
export function applyClassTime(slot: ClassTime, date = dayjs()) {
  const [hour, minute] = slot.start.split(":").map(Number);
  const [endHour, endMinute] = slot.end.split(":").map(Number);
  return {
    start: date.startOf("day").hour(hour).minute(minute).toISOString(),
    end: date
      .startOf("day")
      .add(slot.days, "day")
      .hour(endHour)
      .minute(endMinute)
      .toISOString(),
  };
}
export function readClassTimes(name: string): ClassTime[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`classTimes:${name}`) || "[]",
    );
    return Array.isArray(value)
      ? value.filter(
          (v): v is ClassTime =>
            v &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(v.start) &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(v.end) &&
            Number.isInteger(v.days) &&
            v.days >= 0 &&
            v.days <= 7 &&
            (v.days > 0 || v.end > v.start),
        )
      : [];
  } catch {
    return [];
  }
}
