import dayjs from "dayjs";
import type { CourseTemplateContext } from "../../domain/course";
import type {
  ClassTime,
  HistorysType,
  HistoryType,
} from "../../components/types";

export const DEFAULT_COURSE_HISTORY_LIMIT = 20;

const toHistoryType = (
  value: unknown,
  fallbackTime?: [string, string],
): HistoryType => {
  const item = value && typeof value === "object" ? value : {};
  const history = item as Partial<HistoryType>;

  return {
    courseName:
      typeof history.courseName === "string" ? history.courseName : "",
    courseContents: Array.isArray(history.courseContents)
      ? history.courseContents
      : [],
    courseObjectives: Array.isArray(history.courseObjectives)
      ? history.courseObjectives
      : [],
    time:
      Array.isArray(history.time) && history.time.length === 2
        ? [String(history.time[0]), String(history.time[1])]
        : fallbackTime,
  };
};

export const migrateCourseHistory = (
  historyData: unknown,
  baseDate = dayjs("2000-01-01T00:00:00.000Z"),
) => {
  if (
    !historyData ||
    typeof historyData !== "object" ||
    Array.isArray(historyData)
  ) {
    return { history: {} as HistorysType, migrated: false };
  }

  const migratedHistory: HistorysType = {};
  let migrationDate = baseDate;
  let migrated = false;

  for (const [key, value] of Object.entries(historyData)) {
    if (dayjs(key).isValid()) {
      migratedHistory[key] = toHistoryType(value);
      continue;
    }

    const newKey = migrationDate.toISOString();
    migratedHistory[newKey] = toHistoryType(value, [newKey, newKey]);
    migrationDate = migrationDate.add(1, "day");
    migrated = true;
  }

  return { history: migratedHistory, migrated };
};

export const buildClassTimeFromCourseContext = (
  courseContext: CourseTemplateContext,
): ClassTime => {
  return {
    time: {
      first: courseContext.courseTime[0].format("YYYY-MM-DD HH:mm"),
      last: courseContext.courseTime[1].format("YYYY-MM-DD HH:mm"),
    },
  };
};

export const addCourseContextToHistory = (
  history: HistorysType,
  courseContext: CourseTemplateContext,
  limit = DEFAULT_COURSE_HISTORY_LIMIT,
): HistorysType => {
  const nextHistory: HistorysType = {
    ...history,
    [courseContext.courseTime[0].toISOString()]: {
      courseName: courseContext.courseName,
      courseContents: courseContext.courseContentItems,
      courseObjectives: courseContext.courseObjectiveItems,
      time: [
        courseContext.courseTime[0].toISOString(),
        courseContext.courseTime[1].toISOString(),
      ],
    },
  };

  const keys = Object.keys(nextHistory);
  while (keys.length > limit) {
    const deleteKey = keys.shift();
    if (deleteKey) {
      delete nextHistory[deleteKey];
    }
  }

  return nextHistory;
};

export const removeCourseHistoryItem = (
  history: HistorysType,
  key: string,
): HistorysType => {
  const nextHistory = { ...history };
  delete nextHistory[key];
  return nextHistory;
};

export const parseStoredClassTime = (
  value: string | null,
): ClassTime | null => {
  if (!value) return null;

  try {
    const data = JSON.parse(value) as Partial<ClassTime>;
    if (
      typeof data.time?.first === "string" &&
      typeof data.time?.last === "string"
    ) {
      return {
        time: {
          first: data.time.first,
          last: data.time.last,
        },
      };
    }
  } catch (error) {
    console.error("Failed to parse class time:", error);
  }

  return null;
};

export const shiftClassTimeToPreviousWeek = (
  classTime: ClassTime,
  now = dayjs(),
): [dayjs.Dayjs, dayjs.Dayjs] => {
  const oldFirstTime = dayjs(classTime.time.first);
  const oldLastTime = dayjs(classTime.time.last);

  return [
    now
      .subtract(1, "week")
      .day(oldFirstTime.day())
      .hour(oldFirstTime.hour())
      .minute(oldFirstTime.minute()),
    now
      .subtract(1, "week")
      .day(oldLastTime.day())
      .hour(oldLastTime.hour())
      .minute(oldLastTime.minute()),
  ];
};
