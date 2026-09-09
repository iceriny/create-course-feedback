import IconButton from "../common/IconButton";
import { UpOutlined, DownOutlined } from "@ant-design/icons";
const CourseTimePicker = lazy(() => import("./CourseTimePicker"));
import { lazy, Suspense, useState } from "react";
import { Button, Card, Flex, Input, Select, Popconfirm } from "antd";
import { cancelGeneration } from "../../services/ai/workspaceGeneration";
import dayjs from "dayjs";
import { useRosterStore } from "../../store/rosterStore";
import { useCourseStore } from "../../store/courseStore";

export default function CoursePanel() {
  const course = useRosterStore((state) => state.course);
  const changeCourse = useRosterStore((state) => state.setCourse);
  const setCourse: typeof changeCourse = (patch) => {
    cancelGeneration();
    changeCourse(patch);
  };
  const [expanded, setExpanded] = useState(true);
  const history = useCourseStore((state) => state.history);
  return (
    <Card
      className="course-panel"
      title="本次课程"
      extra={
        <Flex gap={8}>
          <Select
            aria-label="复用历史课程"
            placeholder="复用历史课程"
            value={undefined}
            popupMatchSelectWidth={false}
            options={Object.entries(history).map(([key, item]) => ({
              value: key,
              label: (
                <Flex justify="space-between" gap={16}>
                  <span>{item.courseName}</span>
                  <Popconfirm
                    title="删除这条课程模板？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      useCourseStore.getState().removeHistoryItem(key);
                    }}
                  >
                    <Button
                      aria-label={`删除课程模板 ${item.courseName}`}
                      size="small"
                      type="text"
                      danger
                      onClick={(e) => e.stopPropagation()}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Flex>
              ),
            }))}
            onSelect={(key) => {
              if (!key) return;
              const item = history[key];
              setCourse({
                name: item.courseName,
                contents: item.courseContents.map((v) => v.item).join("\n"),
                objectives: item.courseObjectives.map((v) => v.item).join("\n"),
              });
            }}
          />
          <IconButton
            label={expanded ? "收起课程" : "编辑课程"}
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          />
        </Flex>
      }
    >
      {expanded ? (
        <div className="course-grid">
          <label>
            课程名称
            <Input
              value={course.name}
              placeholder="例如：循环与条件判断"
              onChange={(e) => setCourse({ name: e.target.value })}
            />
          </label>
          <div className="field">
            <span>授课时间</span>
            <Suspense fallback={<span>正在加载时间选择…</span>}>
              <CourseTimePicker />
            </Suspense>
          </div>
          <label>
            课程内容
            <Input.TextArea
              value={course.contents}
              rows={3}
              placeholder="每行一项课程内容"
              onChange={(e) => setCourse({ contents: e.target.value })}
            />
          </label>
          <label>
            教学目标
            <Input.TextArea
              value={course.objectives}
              rows={3}
              placeholder="每行一项教学目标"
              onChange={(e) => setCourse({ objectives: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <Flex gap={24} wrap>
          <strong>{course.name}</strong>
          <span>
            {course.start
              ? dayjs(course.start).format("YYYY-MM-DD HH:mm")
              : "未设置时间"}
            {course.end ? ` – ${dayjs(course.end).format("HH:mm")}` : ""}
          </span>
          <span>
            {course.contents.split("\n").filter(Boolean).length} 项课程内容 ·{" "}
            {course.objectives.split("\n").filter(Boolean).length} 项教学目标
          </span>
        </Flex>
      )}
    </Card>
  );
}
