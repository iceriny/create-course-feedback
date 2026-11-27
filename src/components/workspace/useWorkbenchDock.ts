import { useLayoutEffect, useRef } from "react";

const downwardThreshold = 96;
const wheelGestureGap = 180;

function handlesOwnScroll(target: EventTarget | null) {
  let element = target instanceof Element ? target : null;
  while (
    element &&
    element !== document.body &&
    element !== document.documentElement
  ) {
    const remaining = element.scrollHeight - element.clientHeight;
    if (remaining > 1) {
      const style = getComputedStyle(element);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        (element.scrollTop < remaining - 1 ||
          style.overscrollBehaviorY !== "auto")
      ) {
        return true;
      }
    }
    element = element.parentElement;
  }
  return false;
}

export default function useWorkbenchDock(lessonId: string, visible: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const workbench = ref.current;
    if (!visible || !workbench) return;
    const toolbar = workbench.querySelector<HTMLElement>(".workbench-toolbar");
    const actions = workbench.querySelector<HTMLElement>(".action-bar");
    if (!toolbar) return;
    const stickyInset = Number.parseFloat(getComputedStyle(toolbar).top) || 0;

    const measure = () => {
      workbench.style.setProperty(
        "--toolbar-height",
        `${toolbar.offsetHeight}px`,
      );
      workbench.style.setProperty(
        "--dock-height",
        `${actions?.offsetHeight ?? 0}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    if (actions) observer.observe(actions);
    measure();
    const threshold = workbench.querySelector(".workbench-threshold");
    const dock = new IntersectionObserver(
      ([entry]) => {
        workbench.toggleAttribute(
          "data-docked",
          !entry.isIntersecting && entry.boundingClientRect.top < stickyInset,
        );
      },
      { rootMargin: `${-stickyInset}px 0px 0px` },
    );
    if (threshold) dock.observe(threshold);

    const wideScreen = window.matchMedia("(min-width: 701px)");
    let held: { top: number; distance: number; time: number } | undefined;
    const wheel = (event: WheelEvent) => {
      if (event.deltaY < 0) held = undefined;
      if (
        !wideScreen.matches ||
        event.deltaY <= 0 ||
        Math.abs(event.deltaX) > event.deltaY ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !event.cancelable ||
        event.defaultPrevented
      )
        return;

      const position = window.scrollY;
      const top = Math.round(
        position + workbench.getBoundingClientRect().top - stickyInset,
      );
      const page = document.scrollingElement;
      if (!page || top <= 0 || top >= page.scrollHeight - page.clientHeight)
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? page.clientHeight
            : 1);

      if (held && (held.top !== top || Math.abs(position - top) > 1))
        held = undefined;
      const reachesDock = position < top && position + delta >= top;
      if (
        (!held && !reachesDock) ||
        (event.target instanceof Element &&
          event.target.closest(
            '[role="dialog"], .ant-modal-wrap, .ant-drawer, .ant-select-dropdown, .ant-picker-dropdown, .ant-popover',
          )) ||
        handlesOwnScroll(event.target)
      )
        return;
      if (held) {
        // A new gesture after a pause goes on immediately. Momentum in the
        // gesture that reached the toolbar needs to travel past the threshold.
        if (event.timeStamp - held.time > wheelGestureGap) {
          held = undefined;
          return;
        }
        event.preventDefault();
        const distance = held.distance + delta;
        if (distance < downwardThreshold) {
          held = { top, distance, time: event.timeStamp };
        } else {
          held = undefined;
          window.scrollBy({
            top: distance - downwardThreshold,
            behavior: "instant",
          });
        }
      } else {
        event.preventDefault();
        held = { top, distance: 0, time: event.timeStamp };
        window.scrollTo({ top, behavior: "instant" });
      }
    };
    window.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      dock.disconnect();
      window.removeEventListener("wheel", wheel);
    };
  }, [lessonId, visible]);

  return ref;
}
