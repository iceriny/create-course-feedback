import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motionTiming } from "./engine";
import { onMotionReduced, prefersReducedMotion } from "./preference";
import "./disclosure.css";

interface Props {
  open: boolean;
  id?: string;
  collapsed?: ReactNode;
  children: ReactNode;
  triggerId?: string;
  retainExpanded?: boolean;
  flow?: (
    frame: HTMLElement,
  ) =>
    | { slot: HTMLElement; panel: HTMLElement; followers: HTMLElement[] }
    | undefined;
}

export default function Disclosure({
  open,
  id,
  collapsed,
  children,
  triggerId,
  retainExpanded = false,
  flow,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const expanded = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation | null>(null);
  const releaseFlow = useRef<(() => void) | undefined>(undefined);
  const [visited, setVisited] = useState(open);
  const [shown, setShown] = useState(open);
  const [switching, setSwitching] = useState(false);

  if (shown !== open) {
    setShown(open);
    setSwitching(true);
    if (open && retainExpanded) setVisited(true);
  }

  useLayoutEffect(() => {
    const frame = viewport.current;
    const entering = (open ? expanded : summary).current;
    const leaving = (open ? summary : expanded).current;
    if (!switching || !frame || !entering || !leaving) return;

    if (triggerId && leaving.contains(document.activeElement)) {
      document.getElementById(triggerId)?.focus({ preventScroll: true });
    }

    const { duration, easing } = motionTiming("enter");
    const layout = flow?.(frame);

    const finish = () => {
      motion.current?.cancel();
      motion.current = null;
      releaseFlow.current?.();
      releaseFlow.current = undefined;
      frame.removeAttribute("data-moving");
      setSwitching(false);
    };

    if (prefersReducedMotion() || duration <= 0 || !frame.animate) {
      finish();
      return;
    }

    let target = entering.getBoundingClientRect().height;
    let legDuration = duration;
    const animate = (from: number, time: number) => {
      motion.current?.cancel();
      frame.setAttribute("data-moving", "");
      // Reserve the final footprint once. The real panel can reveal and clip
      // its contents at the correct height without reflowing the workbench.
      if (layout) frame.style.height = `${from}px`;
      const starts = layout?.followers.map((node) =>
        node.getBoundingClientRect(),
      );
      releaseFlow.current?.();
      if (layout) {
        layout.slot.style.height = `${layout.panel.offsetHeight + target - from}px`;
        frame.style.removeProperty("height");
      }
      const animation = frame.animate(
        [{ height: `${from}px` }, { height: `${target}px` }],
        { duration: time, easing, fill: "both" },
      );
      legDuration = time;
      motion.current = animation;
      if (layout && starts) {
        const ends = layout.followers.map((node) =>
          node.getBoundingClientRect(),
        );
        const moves: Animation[] = [];
        for (const [index, node] of layout.followers.entries()) {
          const old = starts[index],
            next = ends[index];
          const dy = old.top - next.top;
          if (
            Math.abs(dy) < 0.5 ||
            Math.min(old.top, next.top) >= innerHeight ||
            Math.max(old.bottom, next.bottom) <= 0
          )
            continue;
          moves.push(
            node.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], {
              duration: time,
              easing,
            }),
          );
        }
        releaseFlow.current = () => {
          moves.forEach((move) => move.cancel());
          layout.slot.style.removeProperty("height");
        };
      }
      animation.onfinish = () => {
        if (motion.current === animation) finish();
      };
    };

    // Keep the in-flight height until the replacement animation takes over.
    animate(
      motion.current
        ? frame.getBoundingClientRect().height
        : leaving.getBoundingClientRect().height,
      duration,
    );

    const observer = new ResizeObserver(() => {
      const next = entering.getBoundingClientRect().height;
      if (!motion.current || Math.abs(next - target) < 0.5) return;
      const remaining = legDuration - Number(motion.current.currentTime ?? 0);
      target = next;
      animate(frame.getBoundingClientRect().height, Math.max(remaining, 1));
    });
    observer.observe(entering);
    const unsubscribe = onMotionReduced(finish);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [open, switching, triggerId, flow]);

  useLayoutEffect(
    () => () => {
      motion.current?.cancel();
      releaseFlow.current?.();
      motion.current = null;
    },
    [],
  );

  return (
    <div
      className="motion-disclosure"
      data-switching={switching}
      ref={viewport}
    >
      <div
        id={id}
        ref={expanded}
        className="motion-disclosure-panel"
        data-active={open}
        hidden={!open && !switching}
        inert={!open}
      >
        {(open || switching || (retainExpanded && visited)) && children}
      </div>
      <div
        ref={summary}
        className="motion-disclosure-panel"
        data-active={!open}
        hidden={open && !switching}
        inert={open}
      >
        {(!open || switching) && collapsed}
      </div>
    </div>
  );
}
