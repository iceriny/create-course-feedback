import {
  Select as AntSelect,
  Tooltip,
  type RefSelectProps,
  type SelectProps,
} from "antd";
import type { DefaultOptionType } from "antd/es/select";
import { useMemo, useRef, useState } from "react";
import { selectTooltipProps, withoutOptionTitles } from "./selectTooltips";

export default function Select<
  Value,
  Option extends DefaultOptionType = DefaultOptionType,
>({ options, onOpenChange, ...props }: SelectProps<Value, Option>) {
  const select = useRef<RefSelectProps>(null);
  const [tooltip, setTooltip] = useState("");
  const tooltipOptions = useMemo(
    () => options && withoutOptionTitles(options),
    [options],
  );
  return (
    <Tooltip
      title={() => tooltip}
      open={Boolean(tooltip)}
      trigger={["hover", "focus"]}
      onOpenChange={(visible) => {
        const root = select.current?.nativeElement;
        const label = root?.querySelector<HTMLElement>(".select-tooltip-label");
        const clipped = label && label.scrollWidth > label.clientWidth;
        setTooltip(
          visible && clipped && !root?.classList.contains("ant-select-open")
            ? label.textContent ?? ""
            : "",
        );
      }}
    >
      <AntSelect<Value, Option>
        {...props}
        {...selectTooltipProps}
        ref={select}
        options={tooltipOptions}
        onOpenChange={(open) => {
          if (open) setTooltip("");
          onOpenChange?.(open);
        }}
      />
    </Tooltip>
  );
}
