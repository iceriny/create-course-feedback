import type {
  StudentBasicInfo,
  StudentContentPropsVersion,
  StudentsInfo,
} from "../types";

export interface StructuredStudentPerformance {
  total?: string;
  mastery_situation?: string;
  attention?: string;
  interaction?: string;
  other?: string;
}

const normalizeText = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

export const DEFAULT_STUDENT_VERSION: StudentContentPropsVersion = "v1";
export const observationFields = [
  ["total", "整体表现"],
  ["mastery_situation", "掌握情况"],
  ["attention", "专注度"],
  ["interaction", "互动"],
  ["other", "其他观察"],
] as const;

export function hasObservation(student: StudentBasicInfo, info: StudentsInfo) {
  const performance = info.performance ?? {};
  return student.version === "v1"
    ? Boolean(performance.brief?.trim())
    : observationFields.some(([field]) => performance[field]?.trim());
}

export function withObservationFormat(
  info: StudentsInfo,
  version: StudentContentPropsVersion,
) {
  const performance = info.performance;
  if (!performance) return performance;
  const filledFields = observationFields.filter(([field]) =>
    performance[field]?.trim(),
  );
  if (version === "v2" && !filledFields.length && performance.brief?.trim())
    return { ...performance, total: performance.brief };
  if (version === "v1" && !performance.brief?.trim() && filledFields.length) {
    const brief = filledFields
      .map(([field, label]) =>
        field === "total"
          ? performance[field]
          : `${label}：${performance[field]}`,
      )
      .join("\n");
    return { ...performance, brief };
  }
  return performance;
}

export const formatStructuredStudentPerformance = (
  gender: StudentBasicInfo["gender"],
  performance: StructuredStudentPerformance,
) => {
  return [
    ...(gender === "unspecified" ? [] : [`性别:${gender}`]),
    `整体表现:${normalizeText(performance.total)}`,
    `掌握情况:${normalizeText(performance.mastery_situation)}`,
    `专注度:${normalizeText(performance.attention)}`,
    `参与度:${normalizeText(performance.interaction)}`,
    `其他:${normalizeText(performance.other)}`,
  ].join(",");
};

export const createStudentsFromNames = (
  names: string[],
  version: StudentContentPropsVersion = DEFAULT_STUDENT_VERSION,
): StudentBasicInfo[] => {
  return names.map((name) => ({
    name: name.trim(),
    gender: "unspecified",
    version,
  }));
};

export const normalizeStoredStudents = (data: unknown): StudentBasicInfo[] => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  if (typeof data[0] === "string") {
    return createStudentsFromNames(
      data.filter((item): item is string => typeof item === "string"),
    );
  }

  return data
    .filter(
      (student): student is Partial<StudentBasicInfo> & { name: string } =>
        Boolean(
          student &&
            typeof student === "object" &&
            "name" in student &&
            typeof student.name === "string" &&
            student.name.trim(),
        ),
    )
    .map((student) => ({
      ...(typeof student.id === "string" ? { id: student.id } : {}),
      name: student.name.trim(),
      gender:
        student.gender === "male" || student.gender === "female"
          ? student.gender
          : "unspecified",
      version: student.version === "v2" ? "v2" : DEFAULT_STUDENT_VERSION,
    }));
};

export const parseStudentNamesInput = (rawValues: string[]): string[] => {
  const values: string[] = [];

  for (const value of rawValues) {
    const parts = value.split(/[,，、\n\r\t]+/);
    for (const part of parts) {
      const name = part.trim();
      if (name) {
        values.push(name);
      }
    }
  }

  return values;
};

export const mergeStudentNamesWithExistingInfo = (
  names: string[],
  existingStudents: StudentBasicInfo[],
): StudentBasicInfo[] => {
  const existingStudentsMap = new Map(
    existingStudents.map((student) => [
      student.name,
      { gender: student.gender, version: student.version },
    ]),
  );

  return names.map((name) => {
    const existing = existingStudentsMap.get(name);
    return {
      name,
      gender: existing?.gender || "unspecified",
      version: existing?.version || DEFAULT_STUDENT_VERSION,
    };
  });
};

export const createStudentsInfo = (
  students: StudentBasicInfo[],
): Record<number, StudentsInfo> => {
  return Object.fromEntries(
    students.map((student, index) => [
      index,
      {
        name: student.name,
        content: "",
        think_content: "",
        loading: false,
        activated: true,
      },
    ]),
  );
};

export const sortStudentsAndInfoByName = (
  students: StudentBasicInfo[],
  studentsInfo: Record<number, StudentsInfo>,
) => {
  const sortedStudents = [...students].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sortedInfo = Object.fromEntries(
    sortedStudents.map((student, index) => [
      index,
      studentsInfo[students.indexOf(student)],
    ]),
  );

  return { sortedStudents, sortedInfo };
};
