import { Tooltip } from "antd";
import { useRef, useState } from "react";

export default function TruncatedLabel({ text }: { text: string | number }) {
  const label = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <Tooltip
      title={text}
      open={open}
      onOpenChange={(visible) => {
        const node = label.current;
        setOpen(Boolean(visible && node && node.scrollWidth > node.clientWidth));
      }}
    >
      <span ref={label} className="select-tooltip-label">
        {text}
      </span>
    </Tooltip>
  );
}
