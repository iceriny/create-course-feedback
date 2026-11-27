import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  memo,
  type ReactNode,
} from "react";
import {
  Button,
  Checkbox,
  DatePicker,
  Flex,
  Input,
  Popover,
  Tooltip,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { useShallow } from "zustand/react/shallow";
import {
  applyClassTime,
  moveCourseDate,
  readClassTimes,
  resolveCourseTimeSegments,
  segmentCourseTime,
  type ClassTime,
  type CourseTimeSegments,
} from "../../domain/classTime";
import { useRosterStore } from "../../store/rosterStore";
import useNarrowWorkspace from "../../hooks/useNarrowWorkspace";
import "./course-time-picker.css";

const dateFormat = "YYYY-MM-DD";
const dateCellFormats = { date: dateFormat, month: "YYYY-MM" };

function SegmentedCourseTime({
  segments,
  issue,
  onChange,
}: {
  segments: CourseTimeSegments;
  issue?: string;
  onChange: (segments: CourseTimeSegments) => void;
}) {
  const issueId = useId();
  const crossDay = segments.endDate !== undefined;
  const nextDate = segments.date
    ? dayjs(segments.date).add(1, "day").format(dateFormat)
    : "";
  const timeFields = [
    { field: "startTime", label: "开始时间" },
    { field: "endTime", label: "结束时间" },
  ] as const;

  return (
    <div
      className="course-time-segments"
      role="group"
      aria-label="授课时间"
      aria-describedby={issue ? issueId : undefined}
    >
      <div className="course-time-date-row">
        <label className="course-time-segment">
          <span>{crossDay ? "开始日期" : "日期"}</span>
          <Input
            type="date"
            variant="filled"
            value={segments.date}
            onChange={(event) =>
              onChange(moveCourseDate(segments, event.currentTarget.value))
            }
          />
        </label>
        <Checkbox
          checked={crossDay}
          onChange={(event) =>
            onChange({
              ...segments,
              endDate: event.target.checked ? nextDate : undefined,
            })
          }
        >
          跨日
        </Checkbox>
      </div>
      {crossDay && (
        <label className="course-time-segment course-time-end-date">
          <span>结束日期</span>
          <Input
            type="date"
            variant="filled"
            value={segments.endDate}
            min={nextDate || undefined}
            onChange={(event) =>
              onChange({ ...segments, endDate: event.currentTarget.value })
            }
          />
        </label>
      )}
      {timeFields.map(({ field, label }) => (
        <label className="course-time-segment" key={field}>
          <span>{label}</span>
          <Input
            type="time"
            variant="filled"
            value={segments[field]}
            onChange={(event) =>
              onChange({ ...segments, [field]: event.currentTarget.value })
            }
          />
        </label>
      ))}
      <div className="course-time-issue" id={issueId} aria-live="polite">
        {issue && <Typography.Text type="danger">{issue}</Typography.Text>}
      </div>
    </div>
  );
}

function CalendarPanel({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = panel.current!;
    // The picker sets titles on the table cells outside its cellRender slot.
    const removeTitles = () => {
      for (const cell of root.querySelectorAll("td[title]")) {
        cell.setAttribute("aria-label", cell.getAttribute("title")!);
        cell.removeAttribute("title");
      }
    };
    removeTitles();
    const observer = new MutationObserver(removeTitles);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributeFilter: ["title"],
    });
    return () => observer.disconnect();
  }, []);

  return <div ref={panel}>{children}</div>;
}

export default memo(function CourseTimePicker({ active }: { active: boolean }) {
  const name = useRosterStore((s) => s.activeClass);
  const course = useRosterStore(
    useShallow((s) => ({ start: s.course.start, end: s.course.end })),
  );
  const [slots, setSlots] = useState(() => readClassTimes(name));
  const [edit, setEdit] = useState<{
    range: Pick<typeof course, "start" | "end">;
    segments: CourseTimeSegments;
  }>();
  const [notice, holder] = message.useMessage();
  const picker = useRef<HTMLDivElement>(null);
  const checkedDefault = useRef(false);
  const narrow = useNarrowWorkspace();
  // Keep incomplete fields alongside the most recent range these fields saved.
  const segments =
    edit?.range.start === course.start && edit.range.end === course.end
      ? edit.segments
      : segmentCourseTime(course);
  useLayoutEffect(() => {
    const container = picker.current;
    if (
      active &&
      container &&
      container.parentElement === document.activeElement
    ) {
      container.querySelector("input")?.focus();
    }
  }, [active, narrow]);
  const change = (patch: { start: string; end: string }) => {
    setEdit(undefined);
    useRosterStore.getState().setCourse(patch);
  };
  const changeSegments = (next: CourseTimeSegments) => {
    const { range } = resolveCourseTimeSegments(next);
    setEdit({ range, segments: next });
    useRosterStore.getState().setCourse(range);
  };
  useEffect(() => {
    if (!active) return;
    const state = useRosterStore.getState();
    const defaults = readClassTimes(state.activeClass);
    setSlots((previous) =>
      previous.length === defaults.length &&
      previous.every(
        (slot, i) =>
          slot.start === defaults[i].start &&
          slot.end === defaults[i].end &&
          slot.days === defaults[i].days,
      )
        ? previous
        : defaults,
    );
    if (
      !checkedDefault.current &&
      !state.course.start &&
      !state.course.end &&
      defaults[0]
    )
      state.setCourse(applyClassTime(defaults[0]));
    checkedDefault.current = true;
  }, [active]);
  const save = (next: ClassTime[]) => {
    try {
      localStorage.setItem(`classTimes:${name}`, JSON.stringify(next));
      setSlots(next);
    } catch {
      void notice.error("常用时间保存失败，请重试。");
    }
  };
  const shortcuts = (
    [
      [-1, "昨天"],
      [-7, "上周"],
      [0, "本日"],
    ] as const
  ).map(([offset, label]) => (
    <Button
      key={label}
      size="small"
      type="text"
      autoInsertSpace={false}
      onClick={() => {
        if (narrow && edit && segments === edit.segments) {
          const date = segments.date ? dayjs(segments.date) : dayjs();
          const nextDate = offset === 0 ? dayjs() : date.add(offset, "day");
          changeSegments(moveCourseDate(segments, nextDate.format(dateFormat)));
          return;
        }
        const start = course.start
          ? dayjs(course.start)
          : dayjs().startOf("day").hour(8);
        const end = course.end ? dayjs(course.end) : start.add(110, "minute");
        const delta =
          offset === 0
            ? dayjs().startOf("day").diff(start.startOf("day"), "day")
            : offset;
        change({
          start: start.add(delta, "day").toISOString(),
          end: end.add(delta, "day").toISOString(),
        });
      }}
    >
      {label}
    </Button>
  ));
  return (
    <div className="course-time-picker" ref={picker}>
      {holder}
      {narrow ? (
        <SegmentedCourseTime
          segments={segments}
          issue={resolveCourseTimeSegments(segments).issue}
          onChange={changeSegments}
        />
      ) : (
        <DatePicker.RangePicker
          variant="filled"
          aria-label="授课时间"
          popupAlign={{
            overflow: {
              shiftY: true,
              shiftX: true,
              adjustY: true,
              adjustX: true,
            },
          }}
          classNames={{ popup: { root: "course-time-popup" } }}
          panelRender={(panel) => <CalendarPanel>{panel}</CalendarPanel>}
          cellRender={(value, { originNode, type }) => {
            if ((type === "date" || type === "month") && dayjs.isDayjs(value)) {
              return (
                <Tooltip title={value.format(dateCellFormats[type])}>
                  {originNode}
                </Tooltip>
              );
            }
            return originNode;
          }}
          value={
            course.start || course.end
              ? [
                  course.start ? dayjs(course.start) : null,
                  course.end ? dayjs(course.end) : null,
                ]
              : null
          }
          showTime={{ format: "HH:mm" }}
          format="YYYY-MM-DD HH:mm"
          minuteStep={10}
          needConfirm={false}
          onChange={(dates) =>
            change({
              start: dates?.[0]?.toISOString() || "",
              end: dates?.[1]?.toISOString() || "",
            })
          }
          renderExtraFooter={() => (
            <Flex className="time-picker-footer time-shortcuts" gap={8} wrap>
              {shortcuts}
            </Flex>
          )}
        />
      )}
      <Flex className="time-shortcuts" align="center" gap={8} wrap>
        {shortcuts}
        <Popover
          trigger="click"
          title="班级常用时间"
          content={
            <div className="time-presets">
              {slots.length === 0 && (
                <span>保存当前时段后，下次新课会自动填入。</span>
              )}
              {slots.map((slot, i) => (
                <Flex
                  key={`${slot.start}-${slot.end}-${slot.days}`}
                  gap={8}
                  align="center"
                  wrap
                >
                  <Button
                    onClick={() =>
                      change(
                        applyClassTime(
                          slot,
                          segments.date ? dayjs(segments.date) : dayjs(),
                        ),
                      )
                    }
                  >
                    {slot.start}–{slot.end}
                    {slot.days ? `（+${slot.days}天）` : ""}
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    disabled={i === 0}
                    onClick={() =>
                      save([slot, ...slots.filter((_, n) => n !== i)])
                    }
                  >
                    {i === 0 ? "默认" : "设为默认"}
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    danger
                    onClick={() => save(slots.filter((_, n) => n !== i))}
                  >
                    删除
                  </Button>
                </Flex>
              ))}
              <Button
                disabled={
                  !course.start ||
                  !course.end ||
                  !dayjs(course.end).isAfter(course.start)
                }
                onClick={() => {
                  const slot = {
                    start: dayjs(course.start).format("HH:mm"),
                    end: dayjs(course.end).format("HH:mm"),
                    days: dayjs(course.end)
                      .startOf("day")
                      .diff(dayjs(course.start).startOf("day"), "day"),
                  };
                  if (slot.days > 7) {
                    void notice.warning("请选择一周以内的授课时段。");
                    return;
                  }
                  if (
                    !slots.some(
                      (v) => JSON.stringify(v) === JSON.stringify(slot),
                    )
                  )
                    save([...slots, slot]);
                }}
              >
                保存当前时段
              </Button>
            </div>
          }
        >
          <Button type="text" size="small" autoInsertSpace={false}>
            常用时间{slots[0] ? ` · ${slots[0].start}–${slots[0].end}` : ""}
          </Button>
        </Popover>
      </Flex>
    </div>
  );
});
