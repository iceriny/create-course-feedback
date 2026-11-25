import { Button, Tooltip, type ButtonProps } from "antd";

export default function IconButton({
  label,
  tooltipClassName,
  ...props
}: Omit<ButtonProps, "title"> & { label: string; tooltipClassName?: string }) {
  return (
    <Tooltip
      title={label}
      trigger={["hover", "focus"]}
      classNames={{ root: tooltipClassName }}
    >
      <Button
        {...props}
        className={["icon-action", props.className].filter(Boolean).join(" ")}
        aria-label={label}
      />
    </Tooltip>
  );
}
