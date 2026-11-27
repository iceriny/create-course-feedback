import { Button, Modal, Segmented } from "antd";
import {
  LeftOutlined,
  QuestionCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import IconButton from "../common/IconButton";
import Pagination from "../common/Pagination";
import Select from "../common/Select";
import LiquidGlass from "./LiquidGlass";
import {
  selectTooltipProps,
  withoutOptionTitles,
} from "../common/selectTooltips";
import ProgressBar from "./ProgressBar";
import type { RosterFilter } from "./rosterStatus";
import { workbenchShortcuts } from "./useWorkbenchShortcuts";

const pageSizes = [6, 10, 16, 24, 50];
const pageSizeChoices = pageSizes.map((value) => ({
  value,
  label: `每页 ${value} 人`,
}));
const paginationSizeChanger = {
  ...selectTooltipProps,
  options: withoutOptionTitles(
    pageSizes.map((value) => ({ value, label: `${value} 条/页` })),
  ),
};

export default function WorkbenchToolbar({
  compact,
  setCompact,
  pageSize,
  setPageSize,
  resumeLabel,
  onResume,
  confirmation,
  counts,
  filter,
  onFilter,
  onShowHelp,
}: {
  compact: boolean;
  setCompact: (compact: boolean) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  resumeLabel?: string;
  onResume: () => void;
  confirmation?: { name: string };
  counts: { total: number; done: number; processing: number; failed: number };
  filter: RosterFilter;
  onFilter: (filter: "processing" | "failed") => void;
  onShowHelp: () => void;
}) {
  return (
    <div className="workbench-toolbar">
      <LiquidGlass />
      <div className="view-toolbar">
        <Segmented
          aria-label="编辑布局"
          value={compact ? "compact" : "single"}
          options={[
            { value: "single", label: "逐人编辑", title: "" },
            { value: "compact", label: "多人编辑", title: "" },
          ]}
          onChange={(value) => setCompact(value === "compact")}
        />
        <span hidden={!compact}>
          <Select
            aria-label="每页人数"
            value={pageSize}
            options={pageSizeChoices}
            onChange={setPageSize}
          />
        </span>
        {resumeLabel && (
          <Button className="resume-student" onClick={onResume}>
            {resumeLabel}
          </Button>
        )}
        <IconButton
          type="text"
          label="快捷键"
          icon={<QuestionCircleOutlined />}
          onClick={onShowHelp}
        />
      </div>
      <ProgressBar
        confirmation={confirmation}
        counts={counts}
        filter={filter}
        onFilter={onFilter}
      />
    </div>
  );
}

export function WorkbenchPagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
}) {
  return (
    <Pagination
      current={page}
      pageSize={pageSize}
      total={total}
      showSizeChanger={paginationSizeChanger}
      pageSizeOptions={pageSizes}
      onChange={onChange}
    />
  );
}

export function MobileStudentNavigation({
  name,
  position,
  total,
  step,
}: {
  name: string;
  position: number;
  total: number;
  step: (direction: -1 | 1) => boolean;
}) {
  return (
    <nav className="mobile-student-navigation" aria-label="学生导航">
      <IconButton
        type="text"
        label="上一位学生"
        icon={<LeftOutlined />}
        disabled={position < 1}
        onClick={() => step(-1)}
      />
      <div aria-live="polite">
        <strong>{name}</strong>
        <span>{position >= 0 ? `${position + 1} / ${total}` : "当前编辑"}</span>
      </div>
      <IconButton
        type="text"
        label="下一位学生"
        icon={<RightOutlined />}
        disabled={position >= total - 1}
        onClick={() => step(1)}
      />
    </nav>
  );
}

export function WorkbenchShortcutHelp({
  open,
  onClose,
  afterClose,
}: {
  open: boolean;
  onClose: () => void;
  afterClose: () => void;
}) {
  return (
    <Modal
      title="工作台快捷键"
      open={open}
      onCancel={onClose}
      afterClose={afterClose}
      footer={null}
      width={520}
    >
      <dl className="workbench-shortcuts">
        {workbenchShortcuts.map(([key, description]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
