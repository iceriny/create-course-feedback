import type { ReactNode } from "react";
import type { BaseOptionType } from "antd/es/select";
import TruncatedLabel from "./TruncatedLabel";

export function withoutOptionTitles<Option extends BaseOptionType>(
  options: Option[],
): Option[] {
  return options.map((option) => ({
    ...option,
    title: "",
    ...(Array.isArray(option.options) && {
      options: withoutOptionTitles(option.options),
    }),
  }));
}

type OptionLabel = { label?: ReactNode; value?: ReactNode };

function isText(value: ReactNode): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

export const selectTooltipProps = {
  title: "",
  labelRender: ({ label, value }: OptionLabel) => {
    const text = label ?? value;
    return isText(text) ? (
      <span className="select-tooltip-label">{text}</span>
    ) : text;
  },
  optionRender: ({ label, value }: OptionLabel) => {
    const text = label ?? value;
    return isText(text) ? <TruncatedLabel text={text} /> : text;
  },
};
