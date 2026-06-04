import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
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
  onHandleSubmit: () => void;
  //   onImport: () => void;
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
  //   onImport,
  onHandleSubmit,
  onAIOptimize,
  onTemplateEdit,
  onClassSelect,
  onHistoryLoad,
  onHistoryDelete,
}) => {
  const { token } = useToken();
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classFilterText, setClassFilterText] = useState("");
  const [showAllClassOptions, setShowAllClassOptions] = useState(true);
  const classBlurTimerRef = useRef<number | null>(null);
  const submitTimerRef = useRef<number | null>(null);

  const classOptions = useMemo(() => {
    const filterText = classFilterText.trim().toUpperCase();
    return classList
      .filter(
        (item) =>
          showAllClassOptions ||
          !filterText ||
          item.toUpperCase().includes(filterText),
      )
      .map((item) => ({
        value: item,
        label: <span>{item}</span>,
      }));
  }, [classFilterText, classList, showAllClassOptions]);

  const clearClassBlurTimer = useCallback(() => {
    if (classBlurTimerRef.current !== null) {
      window.clearTimeout(classBlurTimerRef.current);
      classBlurTimerRef.current = null;
    }
  }, []);

  const requestSubmit = useCallback(() => {
    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current);
    }
    submitTimerRef.current = window.setTimeout(() => {
      submitTimerRef.current = null;
      onHandleSubmit();
    }, 0);
  }, [onHandleSubmit]);

  const handleClassLoad = useCallback(
    (value: string | undefined) => {
      const className = value?.trim();
      if (!className) return;
      const savedClassName =
        classList.find((item) => item === className) ??
        classList.find((item) => item.toUpperCase() === className.toUpperCase());

      if (!savedClassName) return;

      clearClassBlurTimer();
      form.setFieldValue("class-name", savedClassName);
      setClassFilterText("");
      setShowAllClassOptions(true);
      setIsClassDropdownOpen(false);
      onClassSelect(savedClassName);
    },
    [classList, clearClassBlurTimer, form, onClassSelect],
  );

  useEffect(() => {
    return () => {
      clearClassBlurTimer();
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, [clearClassBlurTimer]);

  // 处理历史记录删除
  const handleHistoryDelete = useCallback(
    (key: string, event: React.MouseEvent) => {
      event.stopPropagation();
      onHistoryDelete(key);
    },
    [onHistoryDelete],
  );

  return (
    <Card
      id="course-info-card"
      size="medium"
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
        // <Button
        //   key="submit"
        //   style={{ width: "100%" }}
        //   type="link"
        //   htmlType="submit"
        // >
        //   提交
        // </Button>,
        // AI优化按钮
        <Button key="ai" type="link" onClick={onAIOptimize}>
          <ThunderboltOutlined />
          AI 优化
        </Button>,
        // 导入按钮
        // <Button
        //   key="import"
        //   style={{ width: "100%" }}
        //   type="link"
        //   onClick={onImport}
        // >
        //   导入
        // </Button>,
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
      <Form.Item label="班级名" name="class-name" rules={[{ required: true }]}>
        <AutoComplete
          options={classOptions}
          open={isClassDropdownOpen && classOptions.length > 0}
          onOpenChange={(open) => {
            setIsClassDropdownOpen(open);
            if (open) {
              setShowAllClassOptions(true);
            }
          }}
          onFocus={() => {
            clearClassBlurTimer();
            setClassFilterText("");
            setShowAllClassOptions(true);
            setIsClassDropdownOpen(classList.length > 0);
          }}
          onSelect={(value) => handleClassLoad(value)}
          onSearch={(value) => {
            setClassFilterText(value);
            setShowAllClassOptions(false);
            setIsClassDropdownOpen(classList.length > 0);
          }}
          onBlur={(event) => {
            const value = (event.target as HTMLInputElement).value;
            clearClassBlurTimer();
            classBlurTimerRef.current = window.setTimeout(() => {
              setIsClassDropdownOpen(false);
              setShowAllClassOptions(true);
              handleClassLoad(value);
            }, 120);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            handleClassLoad((event.target as HTMLInputElement).value);
          }}
          filterOption={false}
        />
      </Form.Item>

      {/* 课程名称 表单项 */}
      <Form.Item
        label="课程名称"
        name="course-name"
        rules={[{ required: true }]}
      >
        <AutoComplete
          options={Object.keys(history)
            .sort((a, b) => b.localeCompare(a))
            .map((key) => {
              const item = history[key];
              return {
                key,
                value: item.courseName,
                label: (
                  <Flex justify="space-between" align="center">
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "200px",
                      }}
                    >
                      {item.courseName}
                    </span>
                    <Flex gap={10} align="center">
                      <span style={{ color: "gray", fontSize: "12px" }}>
                        {item.time
                          ? dayjs(item.time[0]).format("YYYY-MM-DD")
                          : "--"}
                      </span>
                      <Button
                        icon={
                          <CloseOutlined
                            style={{
                              color: token.colorError,
                            }}
                          />
                        }
                        type="link"
                        onClick={(event) => handleHistoryDelete(key, event)}
                      />
                    </Flex>
                  </Flex>
                ),
              };
            })}
          style={{ width: "100%" }}
          onSelect={(_value, option) => {
            onHistoryLoad(option.key);
          }}
          filterOption={(inputValue, option) =>
            option?.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
          }
          placeholder="历史记录"
        />
      </Form.Item>

      {/* 授课时间 表单项 */}
      <Form.Item
        label="授课时间"
        name="course-time"
        rules={[{ required: true, message: "请选择授课时间" }]}
      >
        <RangePicker
          onChange={(date) => {
            if (date?.[0] && date?.[1]) {
              requestSubmit();
            }
          }}
          onOpenChange={(isTimeOpen) => {
            if (!isTimeOpen) {
              const pickerDate = form.getFieldValue("course-time") as
                | dayjs.Dayjs[]
                | undefined;
              if (pickerDate?.[0] && pickerDate?.[1]) {
                requestSubmit();
              }
            }
          }}
          minuteStep={10}
          needConfirm={false}
          renderExtraFooter={() => {
            const pickerDate: dayjs.Dayjs[] = form.getFieldValue("course-time");
            const set = (date: dayjs.Dayjs[]) => {
              // 处理循环引用
              if (
                pickerDate &&
                date[0].isSame(pickerDate[0]) &&
                date[1].isSame(pickerDate[1])
              ) {
                return;
              }
              form.setFieldValue("course-time", date);
              requestSubmit();
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
                <Tooltip title="当前选择日期的昨天" mouseEnterDelay={0.6}>
                  <Button
                    style={{ padding: 12 }}
                    size="small"
                    type="link"
                    onClick={() => {
                      if (pickerDate) {
                        set([
                          pickerDate[0].subtract(1, "day"),
                          pickerDate[1].subtract(1, "day"),
                        ]);
                      } else {
                        const today = dayjs();
                        const start = today
                          .startOf("day")
                          .set("hour", 8)
                          .subtract(1, "day");
                        const end = today
                          .startOf("day")
                          .set("hour", 9)
                          .set("minute", 50)
                          .subtract(1, "day");
                        set([start, end]);
                      }
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
                      if (pickerDate) {
                        set([
                          pickerDate[0].subtract(1, "week"),
                          pickerDate[1].subtract(1, "week"),
                        ]);
                      } else {
                        const today = dayjs();
                        const start = today
                          .startOf("day")
                          .set("hour", 8)
                          .subtract(1, "week");
                        const end = today
                          .startOf("day")
                          .set("hour", 9)
                          .set("minute", 50)
                          .subtract(1, "week");
                        set([start, end]);
                      }
                    }}
                  >
                    上周
                  </Button>
                </Tooltip>
                <Tooltip title="将选择的日期设置为今天" mouseEnterDelay={0.6}>
                  <Button
                    style={{ padding: 12 }}
                    size="small"
                    type="primary"
                    onClick={() => {
                      let start = dayjs().startOf("day").set("hour", 8);
                      let end = dayjs()
                        .startOf("day")
                        .set("hour", 9)
                        .set("minute", 50);
                      if (pickerDate) {
                        start = start
                          .set("hour", pickerDate[0].hour())
                          .set("minute", pickerDate[0].minute())
                          .set("second", pickerDate[0].second());
                        end = end
                          .set("hour", pickerDate[1].hour())
                          .set("minute", pickerDate[1].minute())
                          .set("second", pickerDate[1].second());
                      }
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
                  return Promise.reject(new Error("至少需要有一个课程内容"));
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
                <Flex
                  key={subField.key}
                  gap={16}
                  align="center"
                  justify="space-between"
                  style={{ width: "100%" }}
                >
                  <Form.Item
                    noStyle
                    name={[subField.name, "item"]}
                    rules={[{ required: true }]}
                  >
                    <Input
                      style={{
                        width: "100%",
                      }}
                      onPressEnter={() => {
                        opt.add();
                        requestSubmit();
                      }}
                      placeholder="填写课程内容"
                      onBlur={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        // 如果不是空, 则自动提交表单
                        if (value.trim()) {
                          requestSubmit();
                        }
                      }}
                    />
                  </Form.Item>
                  {/* 删除按钮 */}
                  <CloseOutlined
                    onClick={() => {
                      opt.remove(subField.name);
                      requestSubmit();
                    }}
                  />
                </Flex>
              ))}
              {/* 添加课程内容按钮 */}
              <Button
                type="dashed"
                onClick={() => {
                  opt.add();
                  requestSubmit();
                }}
                block
              >
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
                  return Promise.reject(new Error("至少需要有一个课程目标"));
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
                <Flex
                  key={subField.key}
                  gap={16}
                  align="center"
                  justify="space-between"
                  style={{ width: "100%" }}
                >
                  <Form.Item
                    noStyle
                    name={[subField.name, "item"]}
                    rules={[{ required: true }]}
                  >
                    <Input
                      style={{
                        width: "100%",
                      }}
                      onBlur={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        // 如果不是空, 则自动提交表单
                        if (value.trim()) {
                          requestSubmit();
                        }
                      }}
                      placeholder="填写教学目标"
                    />
                  </Form.Item>
                  {/* 删除按钮 */}
                  <CloseOutlined
                    onClick={() => {
                      opt.remove(subField.name);
                      requestSubmit();
                    }}
                  />
                </Flex>
              ))}
              {/* 添加课程内容按钮 */}
              <Button
                type="dashed"
                onClick={() => {
                  opt.add();
                  requestSubmit();
                }}
                block
              >
                + 添加教学目标
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
