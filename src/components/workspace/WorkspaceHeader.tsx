import { Button, Dropdown, Flex, Input, Popconfirm, Popover } from "antd";
import {
  CalendarOutlined,
  DesktopOutlined,
  EditOutlined,
  HistoryOutlined,
  MoonOutlined,
  PlusOutlined,
  SettingOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useAppearanceStore } from "../../store/appearanceStore";
import IconButton from "../common/IconButton";
import Logo from "../common/Logo";
import Select from "../common/Select";
import { SaveIndicator } from "./SaveStatus";

export function CreateClassForm({
  onCreate,
  autoFocus,
}: {
  onCreate: (name: string) => boolean;
  autoFocus?: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className="new-class-controls"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() && onCreate(name)) setName("");
      }}
    >
      <Input
        aria-label="新班级名称"
        value={name}
        placeholder="新班级名称"
        onChange={(event) => setName(event.target.value)}
        autoFocus={autoFocus}
      />
      <Button
        type="primary"
        htmlType="submit"
        icon={<PlusOutlined />}
        disabled={!name.trim()}
      >
        创建班级
      </Button>
    </form>
  );
}

export default function WorkspaceHeader({
  activeClass,
  classes,
  onSwitchClass,
  onStartLesson,
  onHistory,
  onTemplate,
  onSettings,
}: {
  activeClass: string;
  classes: readonly string[];
  onSwitchClass: (name: string) => boolean;
  onStartLesson: () => void;
  onHistory: () => void;
  onTemplate: () => void;
  onSettings: () => void;
}) {
  const appearance = useAppearanceStore();
  const [creatingClass, setCreatingClass] = useState(false);
  const classOptions = [...new Set([...classes, activeClass].filter(Boolean))];
  return (
    <header className="page-header">
      <div className="page-header-inner">
        <div className="chrome-identity">
          <span className="page-brand" aria-label="课程反馈生成器">
            <Logo className="page-brand-mark" />
            <span>课程反馈</span>
          </span>
          <div className="chrome-class">
            {classOptions.length ? (
              <Select
                className="chrome-class-picker"
                variant="borderless"
                aria-label="切换班级"
                value={activeClass || undefined}
                placeholder="选择班级"
                onChange={onSwitchClass}
                options={classOptions.map((value) => ({ value, label: value }))}
              />
            ) : null}
            {activeClass && (
              <Popover
                trigger="click"
                placement="bottomLeft"
                open={creatingClass}
                onOpenChange={setCreatingClass}
                content={
                  creatingClass ? (
                    <CreateClassForm
                      autoFocus
                      onCreate={(name) => {
                        if (!onSwitchClass(name)) return false;
                        setCreatingClass(false);
                        return true;
                      }}
                    />
                  ) : null
                }
              >
                <IconButton
                  type="text"
                  label="新建班级"
                  icon={<PlusOutlined />}
                />
              </Popover>
            )}
          </div>
          <SaveIndicator />
        </div>
        <nav className="chrome-actions" aria-label="工作台操作">
          {activeClass && (
            <Flex align="center" gap={4} className="chrome-lesson-actions">
              <Popconfirm
                title="保存本次记录并开始新一课？"
                description="学生名单保留，新课从空白的课堂记录开始。"
                onConfirm={onStartLesson}
              >
                <IconButton
                  type="text"
                  label="开始新课"
                  icon={<CalendarOutlined />}
                >
                  <span className="chrome-action-label">开始新课</span>
                </IconButton>
              </Popconfirm>
              <IconButton
                type="text"
                label="历史课次"
                icon={<HistoryOutlined />}
                onClick={onHistory}
              >
                <span className="chrome-action-label">历史课次</span>
              </IconButton>
            </Flex>
          )}
          <Flex align="center" gap={4} className="chrome-system-actions">
            <IconButton
              type="text"
              label="反馈模板"
              icon={<EditOutlined />}
              onClick={onTemplate}
            >
              <span className="chrome-action-label">反馈模板</span>
            </IconButton>
            <Dropdown
              trigger={["click"]}
              menu={{
                selectedKeys: [appearance.mode],
                items: [
                  {
                    key: "system",
                    label: "跟随系统",
                    icon: <DesktopOutlined />,
                  },
                  { key: "light", label: "浅色模式", icon: <SunOutlined /> },
                  { key: "dark", label: "暗色模式", icon: <MoonOutlined /> },
                ],
                onClick: ({ key }) =>
                  appearance.setMode(key as "system" | "light" | "dark"),
              }}
            >
              <IconButton
                type="text"
                label="切换外观"
                icon={
                  <span key={appearance.mode} className="appearance-icon">
                    {appearance.mode === "system" ? (
                      <DesktopOutlined />
                    ) : appearance.mode === "dark" ? (
                      <MoonOutlined />
                    ) : (
                      <SunOutlined />
                    )}
                  </span>
                }
              />
            </Dropdown>
            <IconButton
              type="text"
              label="设置"
              icon={<SettingOutlined />}
              onClick={onSettings}
            />
          </Flex>
        </nav>
      </div>
    </header>
  );
}
