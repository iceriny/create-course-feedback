import { useLayoutEffect, useRef, useState } from "react";
import { Checkbox, Input, Select } from "antd";
import { useRosterStore } from "../../store/rosterStore";
import { statusLabel } from "../../domain/feedbackStatus";
type Filter = "all" | "pending" | "failed" | "confirmed";

export default function Roster({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const students = useRosterStore((s) => s.studentsList);
  const summary = useRosterStore((s) =>
    s.studentsList
      .map(
        (_, i) =>
          `${statusLabel(s.studentsInfo[i])}:${s.studentsInfo[i]?.activated}`,
      )
      .join("|"),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const statuses = summary.split("|");
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current,
      item = selectedRef.current;
    if (!list || !item) return;
    const box = list.getBoundingClientRect(),
      row = item.getBoundingClientRect();
    if (row.top < box.top) list.scrollTop += row.top - box.top;
    else if (row.bottom > box.bottom) list.scrollTop += row.bottom - box.bottom;
  }, [selected, search, filter]);
  return (
    <>
      <Input
        aria-label="查找学生"
        placeholder="查找学生"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Select
        aria-label="筛选学生"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "全部学生" },
          { value: "pending", label: "待确认" },
          { value: "failed", label: "需重试" },
          { value: "confirmed", label: "已确认" },
        ]}
      />
      <div className="roster-items" ref={listRef}>
        {students.map((s, index) => {
          const [label, activated] = statuses[index].split(":");
          if (
            !s.name.toLowerCase().includes(search.toLowerCase()) ||
            (filter === "pending" && label === "已确认") ||
            (filter === "failed" && label !== "需重试") ||
            (filter === "confirmed" && label !== "已确认")
          )
            return null;
          return (
            <div
              key={s.id}
              ref={s.id === selected ? selectedRef : undefined}
              className={`roster-item ${s.id === selected ? "selected" : ""}`}
            >
              <Checkbox
                aria-label={`本次生成 ${s.name}`}
                checked={activated === "true"}
                onChange={() =>
                  useRosterStore.getState().toggleStudentActivation(index)
                }
              />
              <button
                aria-current={s.id === selected ? "true" : undefined}
                onClick={() => onSelect(s.id!)}
              >
                <span>{s.name}</span>
                <small>{label}</small>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
