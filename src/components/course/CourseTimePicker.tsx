import { useEffect, useState } from "react";
import { Button, DatePicker, Flex, Popover, message } from "antd";
import dayjs from "dayjs";
import {
  applyClassTime,
  readClassTimes,
  type ClassTime,
} from "../../domain/classTime";
import { useRosterStore } from "../../store/rosterStore";
import { cancelGeneration } from "../../services/ai/workspaceGeneration";
export default function CourseTimePicker() {
  const name = useRosterStore((s) => s.activeClass);
  const course = useRosterStore((s) => s.course);
  const [slots, setSlots] = useState(() => readClassTimes(name));
  const [notice, holder] = message.useMessage();
  const change = (patch: { start: string; end: string }) => {
    cancelGeneration();
    useRosterStore.getState().setCourse(patch);
  };
  useEffect(() => {
    const state = useRosterStore.getState();
    const defaults = readClassTimes(state.activeClass);
    if (!state.course.start && !state.course.end && defaults[0])
      state.setCourse(applyClassTime(defaults[0]));
  }, []);
  const save = (next: ClassTime[]) => {
    try {
      localStorage.setItem(`classTimes:${name}`, JSON.stringify(next));
      setSlots(next);
    } catch {
      void notice.error("常用时间保存失败，请重试。");
    }
  };
  const shortcuts = (
    <Flex className="time-shortcuts" gap={8} wrap>
      {[
        [-1, "昨天"],
        [-7, "上周"],
        [0, "本日"],
      ].map(([offset, label]) => (
        <Button
          key={label}
          size="small"
          type="text"
          autoInsertSpace={false}
          onClick={() => {
            const start = course.start
              ? dayjs(course.start)
              : dayjs().startOf("day").hour(8);
            const end = course.end
              ? dayjs(course.end)
              : start.add(110, "minute");
            const delta =
              offset === 0
                ? dayjs().startOf("day").diff(start.startOf("day"), "day")
                : Number(offset);
            change({
              start: start.add(delta, "day").toISOString(),
              end: end.add(delta, "day").toISOString(),
            });
          }}
        >
          {label}
        </Button>
      ))}
    </Flex>
  );
  return (
    <div className="course-time-picker">
      {holder}
      <DatePicker.RangePicker
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
        value={
          course.start && course.end
            ? [dayjs(course.start), dayjs(course.end)]
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
          <div className="time-picker-footer">{shortcuts}</div>
        )}
      />
      <Flex gap={8} wrap>
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
                          course.start ? dayjs(course.start) : dayjs(),
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
          <Button size="small">
            常用时间{slots[0] ? ` · ${slots[0].start}–${slots[0].end}` : ""}
          </Button>
        </Popover>
      </Flex>
    </div>
  );
}
