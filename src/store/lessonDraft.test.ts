import { beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryStorage } from "../test/memoryStorage";
import { flushLessonDraft, useRosterStore } from "./rosterStore";
beforeEach(() => {
  installMemoryStorage();
  localStorage.clear();
  useRosterStore.getState().resetRosterState();
});
describe("lesson workflow", () => {
  it("keeps observation and feedback attached through sorting, additions and renaming", () => {
    const store = useRosterStore.getState();
    store.updateStudentsFromRawValues(["Zoe, Amy"], "A");
    const id = useRosterStore.getState().studentsList[0].id;
    store.updateStudentInfo(0, {
      performance: { brief: "Zoe observation" },
      content: "Zoe feedback",
      confirmed: true,
    });
    store.sortStudentsByName("A");
    expect(useRosterStore.getState().studentsInfo[1]).toMatchObject({
      performance: { brief: "Zoe observation" },
      content: "Zoe feedback",
    });
    store.updateStudentsFromRawValues(["Amy", "Zoe", "New"], "A");
    expect(useRosterStore.getState().studentsList[1].id).toBe(id);
    expect(useRosterStore.getState().studentsInfo[1].content).toBe(
      "Zoe feedback",
    );
    store.renameStudent(1, "Zoe renamed");
    expect(useRosterStore.getState().studentsList[1].id).toBe(id);
  });
  it("recovers separate class drafts and turns interrupted work into a retryable state", () => {
    const store = useRosterStore.getState();
    store.loadStudentsFromStorage("A");
    store.updateStudentsFromRawValues(["Zoe"], "A");
    store.setCourse({ name: "Lesson A" });
    store.updateStudentInfo(0, {
      content: "old draft",
      performance: { total: "careful" },
      loading: true,
    });
    expect(flushLessonDraft()).toBe(true);
    store.loadStudentsFromStorage("B");
    store.setCourse({ name: "Lesson B" });
    store.loadStudentsFromStorage("A");
    expect(useRosterStore.getState().course.name).toBe("Lesson A");
    expect(useRosterStore.getState().studentsInfo[0]).toMatchObject({
      content: "old draft",
      performance: { total: "careful" },
      loading: false,
      generation: { status: "failed" },
    });
  });
  it("does not switch classes when saving fails", () => {
    useRosterStore.getState().loadStudentsFromStorage("A");
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    useRosterStore.getState().loadStudentsFromStorage("B");
    expect(useRosterStore.getState().activeClass).toBe("A");
    expect(useRosterStore.getState().saveStatus).toBe("error");
    spy.mockRestore();
  });
  it("assigns different identities to students with identical names", () => {
    useRosterStore
      .getState()
      .updateStudentsFromRawValues(["张三，张三\n李四"], "A");
    const students = useRosterStore.getState().studentsList;
    expect(students).toHaveLength(3);
    expect(new Set(students.map((s) => s.id)).size).toBe(3);
  });
});

it("archives completed lessons and restores them without overwriting the new draft", () => {
  const store = useRosterStore.getState();
  store.loadStudentsFromStorage("A");
  store.updateStudentsFromRawValues(["Zoe"], "A");
  store.setCourse({ name: "First" });
  store.updateStudentInfo(0, { content: "Reviewed draft", confirmed: true });
  const id = useRosterStore.getState().lessonId;
  store.newLesson();
  const newId = useRosterStore.getState().lessonId;
  expect(newId).not.toBe(id);
  expect(useRosterStore.getState().studentsInfo[0].content).toBe("");
  store.setCourse({ name: "Second" });
  store.restoreLesson(JSON.parse(localStorage.getItem(`lessonArchive:${id}`)!));
  expect(useRosterStore.getState().studentsInfo[0].content).toBe(
    "Reviewed draft",
  );
  expect(
    JSON.parse(localStorage.getItem(`lessonArchive:${newId}`)!).course.name,
  ).toBe("Second");
});
