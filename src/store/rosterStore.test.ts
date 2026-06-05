import { beforeEach, describe, expect, it } from "vitest";

import { installMemoryStorage } from "../test/memoryStorage";
import { useRosterStore } from "./rosterStore";

describe("roster store", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
    useRosterStore.getState().resetRosterState();
  });

  it("uses the store as the roster and runtime feedback state source", () => {
    useRosterStore
      .getState()
      .updateStudentsFromRawValues(["李四", "张三"], "cpp0608");
    useRosterStore.getState().updateStudentGender(1, "female", "cpp0608");
    useRosterStore.getState().updateStudentInfo(0, {
      content: "反馈草稿",
      activated: false,
    });

    expect(useRosterStore.getState().studentsList).toEqual([
      { name: "李四", gender: "male", version: "v2" },
      { name: "张三", gender: "female", version: "v2" },
    ]);
    expect(useRosterStore.getState().studentsInfo[0]).toMatchObject({
      activated: false,
      content: "反馈草稿",
      name: "李四",
    });
    expect(JSON.parse(localStorage.getItem("cpp0608_std") ?? "[]")).toEqual([
      { name: "李四", gender: "male", version: "v2" },
      { name: "张三", gender: "female", version: "v2" },
    ]);
  });

  it("loads, toggles, and sorts students without losing runtime output", () => {
    localStorage.setItem(
      "cpp0608_std",
      JSON.stringify([
        { name: "B", gender: "male", version: "v2" },
        { name: "A", gender: "female", version: "v1" },
      ]),
    );

    useRosterStore.getState().loadStudentsFromStorage("cpp0608");
    useRosterStore.getState().updateStudentInfo(0, { content: "B content" });
    useRosterStore.getState().sortStudentsByName("cpp0608");
    useRosterStore.getState().toggleAllStudentsActivation();

    expect(
      useRosterStore.getState().studentsList.map((item) => item.name),
    ).toEqual(["A", "B"]);
    expect(useRosterStore.getState().studentsInfo[1]).toMatchObject({
      activated: false,
      content: "B content",
      name: "B",
    });
    expect(useRosterStore.getState().getActivatedStudentsCount()).toEqual({
      activated: 0,
      total: 2,
    });
  });

  it("rejects roster edits before a class is selected", () => {
    expect(() =>
      useRosterStore.getState().updateStudentsFromRawValues(["张三"], ""),
    ).toThrow("班级名不能为空！");
  });
});
