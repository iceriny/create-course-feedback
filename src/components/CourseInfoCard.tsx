import { FC, useCallback } from "react";
import {
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Tooltip,
  theme,
} from "antd";
import type { FormInstance } from "antd/es/form";
import {
  CloseOutlined,
  EditOutlined,
  InfoCircleFilled,
  ThunderboltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { HistorysType } from "./types";

const { RangePicker } = DatePicker;
const { useToken } = theme;

// 课程信息卡片组件属性接口
export interface CourseInfoCardProps {
  form: FormInstance;
  classList: string[];
  history: HistorysType;
  onSubmit: () => void;
  onImport: () => void;
  onAIOptimize: () => void;
  onTemplateEdit: () => void;
  onClassSelect: (className: string) => void;
  onHistoryLoad: (key: string) => void;
  onHistoryDelete: (key: string) => void;
}

/**
 * 课程信息卡片组件
 */
const CourseInfoCard: FC<CourseInfoCardProps> = ({
  form,
  classList,
  history,
  onSubmit,
  onImport,
  onAIOptimize,
  onTemplateEdit,
  onClassSelect,
  onHistoryLoad,
  onHistoryDelete,
}) => {
  const { token } = useToken();

  // 处理历史记录删除
  const handleHistoryDelete = useCallback(
    (key: string, event: React.MouseEvent) => {
      event.stopPropagation();
      onHistoryDelete(key);
    },
    [onHistoryDelete]
  );

  return (
    <Card
      id="course-info-card"
      size="default"
      title={
        <>
          <InfoCircleFilled
            style={{
              marginRight: "2rem",
              color: token.colorPrimary,
            }}
          />
          课程信息
        </>
      }
      style={{
        minWidth: "800px",
        boxShadow: "10px 10px 80px 10px rgba(0, 0, 0, 0.1)",
      }}
      actions={[
        // 提交按钮
        <Button
          key="submit"
          style={{ width: "100%" }}
          type="link"
          htmlType="submit"
          onClick={onSubmit}
        >
          提交
        </Button>,
        // AI优化按钮
        <Button key="ai" type="link" onClick={onAIOptimize}>
          <ThunderboltOutlined />
          AI 优化
        </Button>,
        // 导入按钮
        <Button
          key="import"
          style={{ width: "100%" }}
          type="link"
          onClick={onImport}
        >
          导入
        </Button>,
        // 自定义模板按钮
        <Button
          key="template"
          style={{ width: "100%" }}
          type="link"
          onClick={onTemplateEdit}
        >
          <EditOutlined />
          自定义模板
        </Button>,
      ]}
    >
      {/* 班级名 表单项 */}
      <Form.Item
        label="班级名"
        name="class-name"
        rules={[{ required: true }]}
      >
        <Input
          addonAfter={
            <Select
              defaultValue={null}
              notFoundContent="无录入班级信息"
              placeholder="选择班级"
              style={{ width: 120 }}
              onSelect={(value: string | null) => {
                if (value !== null) {
                  onClassSelect(value);
                }
              }}
              options={classList.map((item) => ({
                value: item,
                label: item,
              }))}
            />
          }
        />
      </Form.Item>

      {/* 课程名称 表单项 */}
      <Form.Item
        label="课程名称"
        name="course-name"
        rules={[{ required: true }]}
      >
        <Input
          addonAfter={
            <Select
              defaultValue={null}
              notFoundContent="无历史记录"
              placeholder="历史记录"
              style={{ width: 200 }}
              onSelect={(value: string | null) => {
                if (value !== null) {
                  onHistoryLoad(value);
                }
              }}
              optionRender={(options) => {
                const value = options?.value;
                if (!value) return null;
                return (
                  <Flex gap={10} align="center">
                    {options.data.label.length > 10
                      ? options.data.label.slice(0, 10) + "..."
                      : options.data.label}
                    <Button
                      icon={
                        <CloseOutlined
                          style={{
                            color: token.colorError,
                          }}
                        />
                      }
                      type="link"
                      onClick={(event) => handleHistoryDelete(String(value), event)}
                    />
                  </Flex>
                );
              }}
              options={Object.keys(history).map((key) => ({
                value: key,
                label: history[key].courseName,
              }))}
            />
          }
        />
      </Form.Item>

      {/* 授课时间 表单项 */}
      <Form.Item
        label="授课时间"
        name="course-time"
        rules={[{ required: true }]}
      >
        <RangePicker
          needConfirm={false}
          renderExtraFooter={() => {
            const pickerDate: dayjs.Dayjs[] = form.getFieldValue("course-time");
            const set = (date: dayjs.Dayjs[]) => {
              form.setFieldValue("course-time", date);
            };
            return (
              <Flex
                style={{
                  width: "100%",
                  margin: "12px 0",
                  justifyContent: "end",
                }}
                gap={5}
              >
                <Tooltip
                  title="当前选择日期的昨天"
                  mouseEnterDelay={0.6}
                >
                  <Button
                    style={{ padding: 12 }}
                    size="small"
                    type="link"
                    onClick={() => {
                      set([
                        pickerDate[0].subtract(1, "day"),
                        pickerDate[1].subtract(1, "day"),
                      ]);
                    }}
                  >
                    昨天
                  </Button>
                </Tooltip>
                <Tooltip
                  title="当前选择日期的前一周同一天"
                  mouseEnterDelay={0.6}
                >
                  <Button
                    style={{ padding: 12 }}
                    size="small"
                    type="link"
                    onClick={() => {
                      set([
                        pickerDate[0].subtract(1, "week"),
                        pickerDate[1].subtract(1, "week"),
                      ]);
                    }}
                  >
                    上周
                  </Button>
                </Tooltip>
                <Tooltip
                  title="将选择的日期设置为今天"
                  mouseEnterDelay={0.6}
                >
                  <Button
                    style={{ padding: 12 }}
                    size="small"
                    type="primary"
                    onClick={() => {
                      let start = dayjs().startOf("day");
                      let end = dayjs().startOf("day");
                      console.log("pickerDate", pickerDate);
                      start = start
                        .set("hour", pickerDate[0].hour())
                        .set("minute", pickerDate[0].minute())
                        .set("second", pickerDate[0].second());
                      end = end
                        .set("hour", pickerDate[1].hour())
                        .set("minute", pickerDate[1].minute())
                        .set("second", pickerDate[1].second());
                      set([start, end]);
                    }}
                  >
                    本日
                  </Button>
                </Tooltip>
              </Flex>
            );
          }}
          showTime={{ format: "HH:mm" }}
          format="YYYY-MM-DD HH:mm"
        />
      </Form.Item>

      {/* 课程内容表单项 */}
      <Form.Item label="课程内容">
        <Form.List
          name="course-contents"
          rules={[
            {
              validator: async (_, contents) => {
                if (!contents || contents.length < 1) {
                  return Promise.reject(
                    new Error("至少需要有一个课程内容"),
                  );
                }
              },
            },
          ]}
        >
          {(fields, opt, { errors }) => (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                rowGap: 16,
              }}
            >
              {/* 遍历课程内容字段 */}
              {fields.map((subField) => (
                <Space key={subField.key}>
                  <Form.Item
                    noStyle
                    name={[subField.name, "item"]}
                    rules={[{ required: true }]}
                  >
                    <Input
                      style={{
                        width: 350,
                      }}
                      onPressEnter={() => {
                        opt.add();
                      }}
                      placeholder="填写课程内容"
                    />
                  </Form.Item>
                  {/* 删除按钮 */}
                  <CloseOutlined
                    onClick={() => {
                      opt.remove(subField.name);
                    }}
                  />
                </Space>
              ))}
              {/* 添加课程内容按钮 */}
              <Button type="dashed" onClick={() => opt.add()} block>
                + 添加课程内容
              </Button>
              <Form.ErrorList errors={errors} />
            </div>
          )}
        </Form.List>
      </Form.Item>

      {/* 教学目标表单项 */}
      <Form.Item label="教学目标">
        <Form.List
          name="course-objectives"
          rules={[
            {
              validator: async (_, objectives) => {
                if (!objectives || objectives.length < 1) {
                  return Promise.reject(
                    new Error("至少需要有一个课程目标"),
                  );
                }
              },
            },
          ]}
        >
          {(fields, opt, { errors }) => (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                rowGap: 16,
              }}
            >
              {fields.map((subField) => (
                <Space key={subField.key}>
                  <Form.Item
                    noStyle
                    name={[subField.name, "item"]}
                    rules={[{ required: true }]}
                  >
                    <Input
                      style={{
                        width: 350,
                      }}
                      placeholder="填写课程内容"
                    />
                  </Form.Item>
                  {/* 删除按钮 */}
                  <CloseOutlined
                    onClick={() => {
                      opt.remove(subField.name);
                    }}
                  />
                </Space>
              ))}
              {/* 添加课程内容按钮 */}
              <Button type="dashed" onClick={() => opt.add()} block>
                + 添加课程内容
              </Button>
              <Form.ErrorList errors={errors} />
            </div>
          )}
        </Form.List>
      </Form.Item>
    </Card>
  );
};

export default CourseInfoCard;
