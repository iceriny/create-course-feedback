import { describe, expect, it } from "vitest";

import {
  createStudentsInfo,
  formatStructuredStudentPerformance,
  mergeStudentNamesWithExistingInfo,
  normalizeStoredStudents,
  parseStudentNamesInput,
  sortStudentsAndInfoByName,
} from "./student";
import type { StudentBasicInfo, StudentsInfo } from "../components/types";

describe("student domain", () => {
  it("formats structured performance for prompt input", () => {
    expect(
      formatStructuredStudentPerformance("female", {
        total: "积极",
        mastery_situation: "掌握稳定",
        attention: "专注",
        interaction: "主动回答",
        other: "继续保持",
      }),
    ).toBe(
      "性别:female,整体表现:积极,掌握情况:掌握稳定,专注度:专注,参与度:主动回答,其他:继续保持",
    );
  });

  it("normalizes stored old and new roster formats", () => {
    expect(normalizeStoredStudents([" 张三 ", "李四"])).toEqual([
      { name: "张三", gender: "male", version: "v2" },
      { name: "李四", gender: "male", version: "v2" },
    ]);

    expect(
      normalizeStoredStudents([
        { name: " 小红 ", gender: "female", version: "v1" },
        { name: "小蓝" },
      ]),
    ).toEqual([
      { name: "小红", gender: "female", version: "v1" },
      { name: "小蓝", gender: "male", version: "v2" },
    ]);
  });

  it("parses comma separated names and preserves first occurrence order", () => {
    expect(parseStudentNamesInput(["张三, 李四", "张三", " 王五 "])).toEqual([
      "张三",
      "李四",
      "王五",
    ]);
  });

  it("keeps existing gender and version while rebuilding roster", () => {
    const existingStudents: StudentBasicInfo[] = [
      { name: "张三", gender: "female", version: "v1" },
    ];

    expect(
      mergeStudentNamesWithExistingInfo(["张三", "李四"], existingStudents),
    ).toEqual([
      { name: "张三", gender: "female", version: "v1" },
      { name: "李四", gender: "male", version: "v2" },
    ]);
  });

  it("creates and sorts runtime student info by name", () => {
    const students: StudentBasicInfo[] = [
      { name: "B", gender: "male", version: "v2" },
      { name: "A", gender: "female", version: "v1" },
    ];
    const info = createStudentsInfo(students);
    const customInfo: Record<number, StudentsInfo> = {
      0: { ...info[0], content: "B content" },
      1: { ...info[1], content: "A content" },
    };

    expect(info[0]).toMatchObject({ name: "B", activated: true });
    expect(sortStudentsAndInfoByName(students, customInfo)).toEqual({
      sortedStudents: [
        { name: "A", gender: "female", version: "v1" },
        { name: "B", gender: "male", version: "v2" },
      ],
      sortedInfo: {
        0: customInfo[1],
        1: customInfo[0],
      },
    });
  });
});
