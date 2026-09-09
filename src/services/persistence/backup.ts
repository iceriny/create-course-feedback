import { isLessonDraft } from "../../domain/lesson";
import { db } from "../../db/db";
export interface Backup {
  version: 1;
  local: Record<string, string>;
  indexed: Record<string, string>;
}
const secret = (key: string) => /api_key|token|password/i.test(key);
export function parseBackup(text: string): Backup {
  if (text.length > 10_000_000)
    throw new Error("文件过大，请选择本工具导出的备份。");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("备份格式不正确。");
  if (value.version !== undefined && value.version !== 1)
    throw new Error("暂不支持此备份版本。");
  const local =
    value.version === 1
      ? value.local
      : Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            [
              "promptKey",
              "api_provider",
              "custom_model",
              "lastActiveClass",
            ].includes(key) && typeof item === "string"
              ? item
              : JSON.stringify(item),
          ]),
        );
  const indexed = value.version === 1 ? value.indexed : {};
  for (const record of [local, indexed]) {
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      Object.values(record).some((v) => typeof v !== "string")
    )
      throw new Error("备份数据不完整。");
  }
  for (const [key, item] of Object.entries(local) as [string, string][]) {
    if (key.startsWith("lessonDraft:") || key.startsWith("lessonArchive:")) {
      const draft = JSON.parse(item);
      if (!isLessonDraft(draft)) throw new Error("课次记录不完整。");
    }
  }
  return {
    version: 1,
    local: Object.fromEntries(
      Object.entries(local).filter(([key]) => !secret(key)),
    ) as Record<string, string>,
    indexed,
  };
}
export async function createBackup(): Promise<Backup> {
  const local = Object.fromEntries(
    Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index)!,
    )
      .filter(
        (key) => !secret(key) && !key.startsWith("__") && key !== "version",
      )
      .map((key) => [key, localStorage.getItem(key)!]),
  );
  const indexed = Object.fromEntries(
    (await db.storage.toArray()).map((item) => [item.key, item.value]),
  );
  return { version: 1, local, indexed };
}
export async function restoreBackup(backup: Backup) {
  const before = new Map(
    Object.keys(backup.local).map((key) => [key, localStorage.getItem(key)]),
  );
  try {
    await db.transaction("rw", db.storage, async () => {
      for (const [key, value] of Object.entries(backup.local))
        localStorage.setItem(key, value);
      await db.storage.bulkPut(
        Object.entries(backup.indexed).map(([key, value]) => ({ key, value })),
      );
    });
  } catch (error) {
    for (const [key, value] of before) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    throw error;
  }
}
