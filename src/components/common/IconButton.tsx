import { Button, Tooltip, type ButtonProps } from "antd";

export default function IconButton({
  label,
  ...props
}: ButtonProps & { label: string }) {
  return (
    <Tooltip title={label} trigger={["hover", "focus"]}>
      <Button
        {...props}
        className={["icon-action", props.className].filter(Boolean).join(" ")}
        aria-label={label}
      />
    </Tooltip>
  );
}
