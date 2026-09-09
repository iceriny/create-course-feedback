import type { StudentBasicInfo, StudentsInfo } from "../types";

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

export const formatStructuredStudentPerformance = (
  gender: StudentBasicInfo["gender"],
  performance: StructuredStudentPerformance,
) => {
  return [
    `性别:${gender}`,
    `整体表现:${normalizeText(performance.total)}`,
    `掌握情况:${normalizeText(performance.mastery_situation)}`,
    `专注度:${normalizeText(performance.attention)}`,
    `参与度:${normalizeText(performance.interaction)}`,
    `其他:${normalizeText(performance.other)}`,
  ].join(",");
};

export const createStudentsFromNames = (
  names: string[],
): StudentBasicInfo[] => {
  return names.map((name) => ({
    name: name.trim(),
    gender: "male",
    version: "v2",
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
      gender: student.gender === "female" ? "female" : "male",
      version: student.version === "v1" ? "v1" : "v2",
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
      gender: existing?.gender || "male",
      version: existing?.version || "v2",
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
