import { Tooltip } from "antd";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./editor-motion.css";

const rulerPadding = 10;
const rulerCaption = 22;
const rulerWidth = 40;
const viewportPadding = 8;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const finePointer =
  typeof window !== "undefined"
    ? window.matchMedia?.("(pointer: fine)")
    : undefined;

function subscribePointer(notify: () => void) {
  finePointer?.addEventListener("change", notify);
  return () => finePointer?.removeEventListener("change", notify);
}

const canUseRuler = () => finePointer?.matches ?? false;
const serverCanUseRuler = () => false;

interface ScrollMetrics {
  top: number;
  max: number;
  height: number;
  lineHeight: number;
  lines: number;
}

const textareaMeasures = new Map<Element, () => void>();
const pendingMeasures = new Set<() => void>();
let textareaObserver: ResizeObserver | undefined;
let measureFrame: number | undefined;

function queueMeasure(measure: () => void) {
  pendingMeasures.add(measure);
  measureFrame ??= requestAnimationFrame(() => {
    measureFrame = undefined;
    for (const callback of pendingMeasures) callback();
    pendingMeasures.clear();
  });
}

function observeTextarea(input: HTMLTextAreaElement, measure: () => void) {
  textareaObserver ??= new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const callback = textareaMeasures.get(target);
      if (!callback) continue;
      pendingMeasures.delete(callback);
      callback();
    }
  });
  textareaMeasures.set(input, measure);
  textareaObserver.observe(input);
  return () => {
    textareaObserver?.unobserve(input);
    textareaMeasures.delete(input);
    pendingMeasures.delete(measure);
    if (!textareaMeasures.size) {
      textareaObserver?.disconnect();
      textareaObserver = undefined;
    }
    if (!pendingMeasures.size && measureFrame !== undefined) {
      cancelAnimationFrame(measureFrame);
      measureFrame = undefined;
    }
  };
}

interface Drag {
  pointer: number;
  startY: number;
  startProgress: number;
  rulerTop: number;
  rulerLeft: number;
  rulerHeight: number;
}

export default function FixedTextEditor({
  label,
  value,
  children,
  onDragChange,
}: {
  label: string;
  value: string;
  children: ReactNode;
  onDragChange?: (dragging: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const previousValue = useRef(value);
  const pendingDrag = useRef<{ frame: number; top: number } | null>(null);
  const [measured, setMetrics] = useState<ScrollMetrics | null>(null);
  const [ruler, setRuler] = useState<(Drag & { active: boolean }) | null>(null);
  const rulerEnabled = useSyncExternalStore(
    subscribePointer,
    canUseRuler,
    serverCanUseRuler,
  );
  const hasText = rulerEnabled && Boolean(value);
  const metrics = hasText ? measured : null;
  const drag = ruler?.active ? ruler : null;

  const measure = useCallback(() => {
    const input = textarea.current;
    if (!input) return;
    const height = input.clientHeight;
    const scrollHeight = height ? input.scrollHeight : 0;
    const max = scrollHeight - height;
    if (max <= 1) {
      setMetrics(null);
      return;
    }
    const style = getComputedStyle(input);
    const lineHeight = Number.parseFloat(style.lineHeight) || 22;
    const padding =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom);
    const lines = Math.max(
      1,
      Math.round((scrollHeight - padding) / lineHeight),
    );
    const top = clamp(input.scrollTop, 0, max);
    setMetrics((last) =>
      last?.top === top &&
      last.max === max &&
      last.height === height &&
      last.lines === lines &&
      last.lineHeight === lineHeight
        ? last
        : { top, max, height, lines, lineHeight },
    );
  }, []);

  const syncScroll = useCallback(() => {
    const top = textarea.current?.scrollTop;
    if (top === undefined) return;
    setMetrics((last) => {
      if (!last) return last;
      const next = clamp(top, 0, last.max);
      return last.top === next ? last : { ...last, top: next };
    });
  }, []);

  const cancelDragScroll = useCallback(() => {
    if (pendingDrag.current) cancelAnimationFrame(pendingDrag.current.frame);
    pendingDrag.current = null;
  }, []);

  useEffect(() => cancelDragScroll, [cancelDragScroll]);

  useEffect(() => {
    if (!hasText) {
      setMetrics(null);
      return;
    }
    const input = container.current?.querySelector("textarea");
    if (!input) return;
    textarea.current = input;
    const unobserve = observeTextarea(input, measure);
    input.addEventListener("scroll", syncScroll, { passive: true });
    return () => {
      unobserve();
      input.removeEventListener("scroll", syncScroll);
      textarea.current = null;
    };
  }, [hasText, measure, syncScroll]);

  useEffect(() => {
    const previous = previousValue.current;
    previousValue.current = value;
    // The observer reports the first size for newly populated fields.
    if (previous && value && previous !== value && textarea.current) {
      queueMeasure(measure);
    }
  }, [measure, value]);

  useLayoutEffect(() => {
    if (metrics || !drag) return;
    cancelDragScroll();
    setRuler(null);
    onDragChange?.(false);
  }, [cancelDragScroll, drag, metrics, onDragChange]);

  const scrollTo = (top: number) => {
    if (!textarea.current) return;
    textarea.current.scrollTop = top;
    syncScroll();
  };

  const flushDragScroll = () => {
    const pending = pendingDrag.current;
    if (!pending) return;
    cancelDragScroll();
    scrollTo(pending.top);
  };

  const progress = metrics ? metrics.top / metrics.max : 0;
  const lastStartLine = metrics
    ? Math.min(metrics.lines, Math.ceil(metrics.max / metrics.lineHeight) + 1)
    : 1;
  const currentLine =
    metrics && metrics.max - metrics.top <= 1
      ? lastStartLine
      : Math.floor((metrics?.top ?? 0) / (metrics?.lineHeight ?? 1)) + 1;

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!metrics || drag || event.button !== 0 || event.pointerType === "touch")
      return;
    const track = event.currentTarget.querySelector(".line-navigator-track")!;
    const rect = track.getBoundingClientRect();
    const mark = rect.top + progress * rect.height;
    const startProgress =
      Math.abs(event.clientY - mark) <= 7
        ? progress
        : clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    const rulerHeight = Math.min(
      232,
      Math.max(148, rect.height),
      window.innerHeight - 2 * viewportPadding,
    );
    const railHeight = rulerHeight - rulerPadding - rulerCaption;
    const rulerTop = clamp(
      event.clientY - rulerPadding - railHeight * startProgress,
      viewportPadding,
      window.innerHeight - rulerHeight - viewportPadding,
    );
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setRuler({
      active: true,
      pointer: event.pointerId,
      startY: event.clientY,
      startProgress,
      rulerTop,
      rulerLeft: rect.right + 4 - rulerWidth,
      rulerHeight,
    });
    onDragChange?.(true);
    scrollTo(startProgress * metrics.max);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!metrics || drag?.pointer !== event.pointerId) return;
    // Keep the grab point steady when the expanded ruler is pushed away from
    // a viewport edge, while allowing the pointer to reach either end.
    const top = Math.min(drag.rulerTop + rulerPadding, drag.startY - 1);
    const bottom = Math.max(
      drag.rulerTop + drag.rulerHeight - rulerCaption,
      drag.startY + 1,
    );
    const distance = event.clientY - drag.startY;
    const ratio =
      distance < 0
        ? drag.startProgress +
          (distance / (drag.startY - top)) * drag.startProgress
        : drag.startProgress +
          (distance / (bottom - drag.startY)) * (1 - drag.startProgress);
    const nextScroll = clamp(ratio, 0, 1) * metrics.max;
    if (pendingDrag.current) {
      pendingDrag.current.top = nextScroll;
    } else {
      pendingDrag.current = {
        frame: requestAnimationFrame(flushDragScroll),
        top: nextScroll,
      };
    }
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag?.pointer !== event.pointerId) return;
    flushDragScroll();
    setRuler({ ...drag, active: false });
    onDragChange?.(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!metrics || !textarea.current) return;
    const page = Math.max(
      metrics.lineHeight,
      metrics.height - metrics.lineHeight,
    );
    const stops: Record<string, number> = {
      ArrowUp: metrics.top - metrics.lineHeight,
      ArrowDown: metrics.top + metrics.lineHeight,
      PageUp: metrics.top - page,
      PageDown: metrics.top + page,
      Home: 0,
      End: metrics.max,
    };
    const next = stops[event.key];
    if (next === undefined) return;
    event.preventDefault();
    scrollTo(next);
  };

  const trackPosition = { translate: `0 ${progress * 100}%` };
  const ticks = Math.min(lastStartLine, 17);

  return (
    <div
      className="fixed-text-editor"
      ref={container}
      data-native-scroll={!rulerEnabled || undefined}
    >
      {children}
      {metrics && (
        <Tooltip
          title={drag ? undefined : "拖动定位到某一行"}
          placement="left"
          trigger={["hover", "focus"]}
        >
          <div
            className="line-navigator"
            role="slider"
            tabIndex={0}
            aria-label={`${label}的显示行`}
            aria-orientation="vertical"
            aria-valuemin={1}
            aria-valuemax={lastStartLine}
            aria-valuenow={currentLine}
            aria-valuetext={`从第 ${currentLine} 行显示，共 ${metrics.lines} 行`}
            data-dragging={Boolean(drag)}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onLostPointerCapture={finishDrag}
            onKeyDown={onKeyDown}
          >
            <span className="line-navigator-track" aria-hidden="true">
              <span className="line-navigator-position" style={trackPosition}>
                <span className="line-navigator-thumb" />
              </span>
            </span>
          </div>
        </Tooltip>
      )}
      {ruler &&
        metrics &&
        createPortal(
          <div
            className="line-navigator-ruler"
            aria-hidden="true"
            data-open={ruler.active}
            style={{
              top: ruler.rulerTop,
              left: ruler.rulerLeft,
              height: ruler.rulerHeight,
            }}
          >
            <div className="line-navigator-ticks">
              {Array.from({ length: ticks }, (_, i) => (
                <i
                  key={i}
                  style={{ top: `${(i / Math.max(1, ticks - 1)) * 100}%` }}
                />
              ))}
              <span className="line-navigator-position" style={trackPosition}>
                <span className="line-navigator-mark" />
              </span>
            </div>
            <span className="line-navigator-number">{currentLine}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
