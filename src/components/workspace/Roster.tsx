import { Checkbox, Flex, Input } from "antd";
import Select from "../common/Select";
import { memo, useMemo } from "react";
import { useRosterStore } from "../../store/rosterStore";
import { statusLabel, type FeedbackStatus } from "../../domain/feedbackStatus";
import type { StudentBasicInfo } from "../../types";
import FeedbackStatusLight from "./FeedbackStatusLight";
import RosterMotionList from "./RosterMotionList";
import {
  rosterFilters,
  type RosterEntry,
  type RosterFilter,
} from "./rosterStatus";

function participation(
  student: StudentBasicInfo,
  index: number,
  status: FeedbackStatus,
  touch = false,
) {
  return (
    <Checkbox
      aria-label={`本次参与 ${student.name}`}
      checked={status !== "inactive"}
      onChange={() => useRosterStore.getState().toggleStudentActivation(index)}
    >
      {touch ? "参与" : undefined}
    </Checkbox>
  );
}

const RosterRow = memo(function RosterRow({
  student,
  index,
  status,
  selected,
  onSelect,
}: {
  student: StudentBasicInfo;
  index: number;
  status: FeedbackStatus;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div data-roster-row={student.id} className="roster-item">
      {participation(student, index, status)}
      <button
        type="button"
        className="roster-student"
        aria-current={selected ? "true" : undefined}
        aria-description={statusLabel(status)}
        onClick={() => onSelect(student.id!)}
      >
        <span className="roster-name">{student.name}</span>
        <FeedbackStatusLight status={status} />
      </button>
    </div>
  );
});

export default memo(function Roster({
  entries,
  selected,
  onSelect,
  search,
  setSearch,
  filter,
  setFilter,
  counts,
}: {
  entries: RosterEntry[];
  selected: string;
  onSelect: (id: string) => void;
  search: string;
  setSearch: (value: string) => void;
  filter: RosterFilter;
  setFilter: (value: RosterFilter) => void;
  counts: Partial<Record<RosterFilter, number>>;
}) {
  const entryOrder = JSON.stringify(entries.map(({ student }) => student.id));
  const selectedEntry = entries.find((entry) => entry.student.id === selected);
  const options = useMemo(
    () =>
      entries.map(({ student, status }) => ({
        value: student.id!,
        label: `${student.name} · ${statusLabel(status)}`,
      })),
    [entries],
  );
  return (
    <>
      <Input
        variant="filled"
        className="roster-search"
        data-roster-search
        aria-label="查找学生"
        placeholder="查找学生"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Flex className="roster-selectors" gap={8}>
        <Select
          variant="filled"
          className="roster-mobile-picker"
          aria-label="查找或切换学生"
          placeholder="查找或切换学生"
          showSearch={{ optionFilterProp: "label" }}
          value={selectedEntry ? selected : undefined}
          onChange={(id) => onSelect(id)}
          options={options}
        />
        <Select
          variant="filled"
          className="roster-filter"
          aria-label="筛选学生"
          value={filter}
          onChange={setFilter}
          options={rosterFilters.map(([value, label]) => ({
            value,
            label: `${label} (${counts[value] ?? 0})`,
            disabled: value !== "all" && value !== filter && !counts[value],
          }))}
        />
        <span className="roster-mobile-participation">
          {selectedEntry &&
            participation(
              selectedEntry.student,
              selectedEntry.index,
              selectedEntry.status,
              true,
            )}
        </span>
      </Flex>
      <RosterMotionList
        className="roster-items"
        order={entryOrder}
        search={search}
        selected={selected}
      >
        {entries.map(({ student, index, status }) => (
          <RosterRow
            key={student.id}
            student={student}
            index={index}
            status={status}
            selected={student.id === selected}
            onSelect={onSelect}
          />
        ))}
      </RosterMotionList>
    </>
  );
});
