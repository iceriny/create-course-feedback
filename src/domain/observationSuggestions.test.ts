import { describe, it, expect, vi, afterEach } from "vitest";
import {
  rankSuggestions,
  readObservationHistory,
  textSimilarity,
} from "./observationSuggestions";
afterEach(() => vi.unstubAllGlobals());
describe("表现提示", () => {
  it("优先匹配中文文字，去重并排除当前内容", () => {
    expect(
      rankSuggestions(["积极发言", "态度认真", "态度认真", "认真"], "认真"),
    ).toEqual(["态度认真", "积极发言"]);
    expect(textSimilarity("注意 集中", "注意力集中")).toBeGreaterThan(
      textSimilarity("注意集中", "积极发言"),
    );
  });
  it("空输入也提供启发选项", () =>
    expect(rankSuggestions(["认真", "积极", "认真"], "")).toEqual([
      "积极",
      "认真",
    ]));
  it("汇集所有班级课次，保留学生身份以区分历史与启发", () => {
    const draft = {
      lessonId: "1",
      activeClass: "A",
      course: { name: "", start: "", end: "", contents: "", objectives: "" },
      studentsList: [{ id: "a", name: "同名", gender: "male", version: "v2" }],
      studentsInfo: {
        0: {
          content: "",
          activated: true,
          loading: false,
          performance: { total: "认真" },
        },
      },
    };
    const values: Record<string, string> = {
      "lessonArchive:1": JSON.stringify(draft),
      "lessonDraft:B": JSON.stringify({
        ...draft,
        activeClass: "B",
        studentsList: [{ ...draft.studentsList[0], id: "b" }],
      }),
      "lessonArchive:bad": "invalid",
      other: "invalid",
    };
    vi.stubGlobal("localStorage", {
      length: 4,
      key: (i: number) => Object.keys(values)[i],
      getItem: (key: string) => values[key],
    });
    expect(readObservationHistory()).toEqual([
      {
        studentId: "a",
        name: "同名",
        className: "A",
        field: "total",
        text: "认真",
      },
      {
        studentId: "b",
        name: "同名",
        className: "B",
        field: "total",
        text: "认真",
      },
    ]);
  });
});
