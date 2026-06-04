import dayjs from "dayjs";

export type CourseListItem = { item: string };

export interface CourseTemplateContext {
  className: string;
  courseName: string;
  courseContentItems: CourseListItem[];
  courseObjectiveItems: CourseListItem[];
  courseContents: string[];
  courseObjectives: string[];
  courseTime: [dayjs.Dayjs, dayjs.Dayjs];
}

export interface CourseFormValues {
  "class-name"?: unknown;
  "course-name"?: unknown;
  "course-contents"?: unknown;
  "course-objectives"?: unknown;
  "course-time"?: unknown;
}

export const normalizeCourseItems = (items: unknown): CourseListItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (typeof item === "string") {
        return { item: item.trim() };
      }

      if (
        item &&
        typeof item === "object" &&
        "item" in item &&
        typeof item.item === "string"
      ) {
        return { item: item.item.trim() };
      }

      return undefined;
    })
    .filter((item): item is CourseListItem =>
      Boolean(item?.item && item.item !== ""),
    );
};

export const hasCompleteCourseTime = (
  time: unknown,
): time is [dayjs.Dayjs, dayjs.Dayjs] => {
  return (
    Array.isArray(time) &&
    time.length === 2 &&
    dayjs.isDayjs(time[0]) &&
    dayjs.isDayjs(time[1])
  );
};

export const buildCourseTemplateContext = (
  values: CourseFormValues,
): CourseTemplateContext | null => {
  const className =
    typeof values["class-name"] === "string" ? values["class-name"].trim() : "";
  const courseName =
    typeof values["course-name"] === "string"
      ? values["course-name"].trim()
      : "";
  const courseContentItems = normalizeCourseItems(values["course-contents"]);
  const courseObjectiveItems = normalizeCourseItems(
    values["course-objectives"],
  );
  const courseTime = values["course-time"];

  if (
    !className ||
    !courseName ||
    courseContentItems.length === 0 ||
    courseObjectiveItems.length === 0 ||
    !hasCompleteCourseTime(courseTime)
  ) {
    return null;
  }

  return {
    className,
    courseName,
    courseContentItems,
    courseObjectiveItems,
    courseContents: courseContentItems.map((item) => `- ${item.item}\n`),
    courseObjectives: courseObjectiveItems.map((item) => `- ${item.item}\n`),
    courseTime,
  };
};
