import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { narrowWorkspaceQuery } from "../../hooks/useNarrowWorkspace";

const editable =
  "input, textarea, select, [contenteditable=true], [role=textbox]";
const selectControl =
  "[role=combobox], [role=listbox], .ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown, .ant-popover";
const swipeControl = `${editable}, ${selectControl}, button, a, label, [role=slider], .ant-alert`;

export const workbenchShortcuts = [
  ["Ctrl / ⌘ + Enter", "在观察框记录下一位，在反馈框确认并下一位"],
  ["Ctrl / ⌘ + Alt / Option + G", "生成或更新当前反馈"],
  ["Ctrl / ⌘ + Alt / Option + X", "复制当前已确认反馈"],
  ["Alt / Option + ↑ / ↓", "切换上一位或下一位"],
  ["/", "查找学生"],
  ["?", "查看快捷键"],
] as const;

export default function useWorkbenchShortcuts({
  workbenchRef,
  blocked,
  step,
  showHelp,
}: {
  workbenchRef: RefObject<HTMLDivElement | null>;
  blocked: boolean;
  step: (direction: -1 | 1) => boolean;
  showHelp: () => void;
}) {
  const commands = useRef({ step, showHelp });
  useEffect(() => {
    commands.current = { step, showHelp };
  }, [step, showHelp]);
  useEffect(() => {
    if (blocked) return;
    const keydown = (event: KeyboardEvent) => {
      const primary = event.ctrlKey !== event.metaKey;
      const submit =
        primary && !event.altKey && !event.shiftKey && event.key === "Enter";
      const letter = (
        event.code.startsWith("Key") ? event.code.slice(3) : event.key
      ).toLowerCase();
      const studentAction =
        primary &&
        event.altKey &&
        !event.shiftKey &&
        (letter === "g" || letter === "x");
      const movement =
        !event.ctrlKey &&
        !event.metaKey &&
        event.altKey &&
        !event.shiftKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown");
      const discover =
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key === "?" || event.key === "/");
      if (!submit && !studentAction && !movement && !discover) return;
      const workbench = workbenchRef.current;
      const target = event.target;
      if (
        !workbench ||
        !(target instanceof Element) ||
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.getModifierState("AltGraph") ||
        (target.closest(selectControl) &&
          !target.matches("[data-observation]")) ||
        Array.from(
          document.querySelectorAll(
            ".ant-modal-wrap, .ant-drawer-content-wrapper",
          ),
        ).some(
          (overlay) =>
            overlay.getClientRects().length &&
            getComputedStyle(overlay).visibility !== "hidden",
        )
      )
        return;

      const editing = Boolean(target.closest(editable));
      const focused = target.closest<HTMLElement>(
        ".student-card-anchor[data-student-id]",
      );
      const card =
        focused && workbench.contains(focused)
          ? focused
          : workbench.contains(target) && !editing
            ? workbench.querySelector<HTMLElement>(
                '.student-card-anchor[data-current-editor="true"][data-student-id]',
              )
            : null;
      const click = (action: string) => {
        const button = card?.querySelector<HTMLButtonElement>(
          `[data-workbench-action="${action}"]`,
        );
        if (
          !button ||
          button.disabled ||
          button.getAttribute("aria-disabled") === "true"
        )
          return false;
        if (!event.repeat) button.click();
        return true;
      };

      let handled = false;
      if (submit) {
        if (
          target.matches(
            "[data-observation]:not([data-workbench-voice-active])",
          )
        )
          handled = click("record-next");
        else if (target.matches("[data-feedback-body]"))
          handled = click("review-next");
      } else if (studentAction) {
        handled = click(letter === "g" ? "generate" : "copy");
      } else if (!editing && movement) {
        if (!event.repeat)
          handled = commands.current.step(event.key === "ArrowUp" ? -1 : 1);
        else handled = true;
      } else if (!editing && discover) {
        if (event.key === "/") {
          const desktop = workbench.querySelector<HTMLInputElement>(
            "input[data-roster-search]",
          );
          if (desktop?.getClientRects().length) {
            desktop.focus();
            handled = true;
          } else {
            const mobile = workbench.querySelector<HTMLInputElement>(
              ".roster-mobile-picker input",
            );
            if (mobile?.getClientRects().length) {
              mobile.focus();
              handled = true;
            }
          }
        } else if (event.key === "?" && !event.repeat) {
          commands.current.showHelp();
          handled = true;
        }
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [blocked, workbenchRef]);
}

export function useMobileStudentSwipe(step: (direction: -1 | 1) => boolean) {
  const start = useRef<{ id: number; x: number; y: number }>(undefined);
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (
        event.pointerType !== "touch" ||
        !event.isPrimary ||
        !window.matchMedia(narrowWorkspaceQuery).matches
      )
        return;
      start.current = undefined;
      if (
        !(event.target instanceof Element) ||
        event.target.closest(swipeControl)
      )
        return;
      start.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const point = start.current;
      if (point?.id !== event.pointerId) return;
      start.current = undefined;
      if (window.getSelection()?.toString()) return;
      const x = event.clientX - point.x;
      const y = event.clientY - point.y;
      if (Math.abs(x) >= 54 && Math.abs(x) > 1.5 * Math.abs(y))
        step(x > 0 ? -1 : 1);
    },
    onPointerCancel: () => {
      start.current = undefined;
    },
  };
}
