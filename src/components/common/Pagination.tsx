import {
  Pagination as AntPagination,
  Tooltip,
  type PaginationProps,
} from "antd";
import { cloneElement, isValidElement, type ReactNode } from "react";

function PageItem({
  control,
  label,
  disabled,
}: {
  control: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  if (!isValidElement<{ disabled?: boolean; "aria-label"?: string }>(control)) {
    return control;
  }
  return (
    <Tooltip title={disabled ? undefined : label}>
      {cloneElement(control, { disabled, "aria-label": label })}
    </Tooltip>
  );
}

export default function Pagination(props: PaginationProps) {
  const jump = props.showLessItems ? 3 : 5;
  const labels = {
    prev: "上一页",
    next: "下一页",
    "jump-prev": `向前 ${jump} 页`,
    "jump-next": `向后 ${jump} 页`,
  };
  const renderItem: PaginationProps["itemRender"] = (_page, type, control) =>
    type === "page" ? control : (
      <PageItem control={control} label={labels[type]} />
    );
  return <AntPagination {...props} showTitle={false} itemRender={renderItem} />;
}
