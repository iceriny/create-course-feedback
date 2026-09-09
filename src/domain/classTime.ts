import dayjs from "dayjs";
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
