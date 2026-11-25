import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { observationFields } from "../../domain/student";
import "./viewport-editor.css";

type Visibility = {
  near: boolean;
  stage: HTMLElement;
  card: HTMLElement | null;
  update: (near: boolean) => void;
};
type VisibilityChange = { near: boolean; distance: number; due: number };

const visibility = new WeakMap<Element, Visibility>();
const pending = new Map<Element, VisibilityChange>();
const stageObservers = new WeakMap<
  HTMLElement,
  { observer: MutationObserver; users: number }
>();
let viewport: IntersectionObserver | undefined;
let workFrame: number | undefined;
let workTimer: number | undefined;
const recycleDelay = 300;
const gridHeights = new WeakMap<
  HTMLElement,
  { width: number; brief?: number; detailed?: number }
>();

function measureGridCard(
  node: HTMLElement,
  { width, height }: DOMRectReadOnly,
  detailed: boolean,
) {
  const grid = node.closest<HTMLElement>(".compact-grid");
  if (!grid) return;
  if (!width || !height) return;
  const key = detailed ? "detailed" : "brief";
  let sizes = gridHeights.get(grid);
  if (!sizes || Math.abs(sizes.width - width) > 1) {
    grid.style.removeProperty("--measured-brief-card");
    grid.style.removeProperty("--measured-detailed-card");
    sizes = { width };
    gridHeights.set(grid, sizes);
  }
  // Generated feedback can add controls that don't belong to the base form.
  if (node.querySelector('[data-generated="true"]')) return;
  if (sizes[key] !== undefined && sizes[key] <= height) return;
  sizes[key] = height;
  grid.style.setProperty(`--measured-${key}-card`, `${height}px`);
}

function canUpdate(node: Element) {
  const entry = visibility.get(node);
  return (
    entry &&
    node.isConnected &&
    !entry.stage.hasAttribute("data-moving") &&
    !entry.stage.hasAttribute("data-navigation-scrolling") &&
    !entry.card?.hasAttribute("data-retiring")
  );
}

function processVisibility() {
  workFrame = undefined;
  const now = performance.now();
  let next: [Element, VisibilityChange] | undefined;
  for (const [node, change] of pending) {
    if (!canUpdate(node) || change.due > now) continue;
    if (
      !next ||
      (change.near && !next[1].near) ||
      (change.near === next[1].near && change.distance < next[1].distance)
    ) {
      next = [node, change];
    }
  }
  if (next) {
    const [node, change] = next;
    pending.delete(node);
    const entry = visibility.get(node)!;
    entry.near = change.near;
    // Preparing neighboring forms can yield to the next frame or user input.
    // Direct selection and keyboard focus still mount their target immediately.
    startTransition(() => entry.update(change.near));
  }
  scheduleVisibility();
}

function scheduleVisibility() {
  if (workFrame !== undefined) return;
  if (workTimer !== undefined) {
    window.clearTimeout(workTimer);
    workTimer = undefined;
  }
  let nextDue = Infinity;
  for (const [node, change] of pending) {
    if (canUpdate(node)) nextDue = Math.min(nextDue, change.due);
  }
  if (!Number.isFinite(nextDue)) return;
  const delay = nextDue - performance.now();
  if (delay <= 0) {
    // Only one editor is mounted or recycled during a frame.
    workFrame = requestAnimationFrame(processVisibility);
  } else {
    workTimer = window.setTimeout(scheduleVisibility, delay);
  }
}

function observeStage(stage: HTMLElement) {
  let watched = stageObservers.get(stage);
  if (!watched) {
    const observer = new MutationObserver(scheduleVisibility);
    observer.observe(stage, {
      attributes: true,
      attributeFilter: ["data-moving", "data-navigation-scrolling"],
    });
    watched = { observer, users: 0 };
    stageObservers.set(stage, watched);
  }
  watched.users++;
  return () => {
    if (--watched.users === 0) {
      watched.observer.disconnect();
      stageObservers.delete(stage);
    }
  };
}

function observeEditor(
  node: HTMLElement,
  near: boolean,
  onVisibility: (near: boolean) => void,
) {
  const stage = node.closest<HTMLElement>(".editor-stage");
  if (!stage) return;
  const stopWatchingStage = observeStage(stage);
  viewport ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const node = entry.target;
        const current = visibility.get(node);
        if (!current) continue;
        if (current.near === entry.isIntersecting) {
          pending.delete(node);
          continue;
        }
        const { top, bottom } = entry.boundingClientRect;
        pending.set(node, {
          near: entry.isIntersecting,
          distance: Math.max(0, top - innerHeight, -bottom),
          due: entry.isIntersecting ? 0 : performance.now() + recycleDelay,
        });
      }
      scheduleVisibility();
    },
    { rootMargin: "200px 0px 280px" },
  );
  visibility.set(node, {
    stage,
    card: node.closest(".student-card-anchor"),
    near,
    update: onVisibility,
  });
  viewport.observe(node);
  return () => {
    viewport?.unobserve(node);
    visibility.delete(node);
    pending.delete(node);
    stopWatchingStage();
    scheduleVisibility();
  };
}

export default function ViewportEditor({
  defer,
  selected,
  detailed,
  name,
  children,
}: {
  defer: boolean;
  selected: boolean;
  detailed?: boolean;
  name: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const focusEditor = useRef<"first" | "last">(undefined);
  const lastVisibility = useRef(!defer);
  const [nearViewport, setNearViewport] = useState(!defer);
  const [interacted, setInteracted] = useState(false);
  const mounted = !defer || selected || nearViewport || interacted;

  useLayoutEffect(() => {
    if (defer || lastVisibility.current) return;
    // A live card reused by the grid can wait for normal viewport recycling.
    lastVisibility.current = true;
    setNearViewport(true);
  }, [defer]);

  useEffect(() => {
    const node = root.current;
    if (!node || !defer) return;
    return observeEditor(node, lastVisibility.current, (near) => {
      lastVisibility.current = near;
      setNearViewport(near);
    });
  }, [defer]);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !mounted || !focusEditor.current) return;
    const frame = requestAnimationFrame(() => {
      const controls = Array.from(
        node.querySelectorAll<HTMLElement>(
          "button, input, select, textarea, a[href], [tabindex]",
        ),
      ).filter(
        (control) =>
          control.tabIndex >= 0 &&
          !control.matches(":disabled") &&
          control.getClientRects().length > 0,
      );
      const target =
        focusEditor.current === "last" ? controls.at(-1) : controls[0];
      focusEditor.current = undefined;
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [mounted]);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !defer || !mounted) return;
    const measure = new ResizeObserver(([entry]) => {
      measureGridCard(node, entry.contentRect, Boolean(detailed));
    });
    measure.observe(node);
    return () => measure.disconnect();
  }, [defer, detailed, mounted]);

  const enterEditor = (direction: "first" | "last") => {
    focusEditor.current = direction;
    setInteracted(true);
  };

  return (
    <div
      className="viewport-editor"
      ref={root}
      data-editor-ready={mounted || undefined}
      data-deferred={defer || undefined}
      data-selected={selected || undefined}
      onFocusCapture={(event) => {
        if (mounted && defer) setInteracted(true);
        if (!mounted) {
          const from = event.relatedTarget;
          const backwards =
            event.target.matches(":focus-visible") &&
            from instanceof Node &&
            (event.currentTarget.compareDocumentPosition(from) &
              Node.DOCUMENT_POSITION_FOLLOWING) !==
              0;
          enterEditor(backwards ? "last" : "first");
        }
      }}
    >
      {mounted && children}
      {defer && (
        <div
          className="viewport-editor-placeholder"
          data-detailed={detailed || undefined}
          aria-hidden={mounted || undefined}
          inert={mounted}
        >
          <button type="button" onClick={() => enterEditor("first")}>
            {name}
          </button>
          <div className="viewport-preview-form" aria-hidden="true" inert>
            <div className="viewport-preview-preferences">
              <span />
              <span />
            </div>
            <div className="viewport-preview-observations">
              {(detailed ? observationFields : [["brief", "课堂表现"]]).map(
                ([field, label]) => (
                  <div key={field}>
                    <span>{label}</span>
                    <i />
                  </div>
                ),
              )}
            </div>
            <div className="viewport-preview-shortcut" />
            <div className="viewport-preview-feedback">
              <strong>反馈正文</strong>
              <i />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
