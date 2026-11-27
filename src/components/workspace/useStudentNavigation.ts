import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { onMotionReduced, prefersReducedMotion } from "../../motion/preference";
import { beginStageNavigationScroll } from "../../motion/stageMotion";
import { useRosterStore } from "../../store/rosterStore";

type FocusTarget = "card" | "observation" | "feedback";

function savedStudent(lessonId: string) {
  try {
    return localStorage.getItem(`lessonSelection:${lessonId}`) ?? "";
  } catch {
    return "";
  }
}

export default function useStudentNavigation(
  lessonId: string,
  workbenchRef: RefObject<HTMLDivElement | null>,
) {
  const [selected, setSelected] = useState<{ lessonId: string; id: string }>();
  const [navigationTarget, setNavigationTarget] = useState<{
    id: string;
    target: FocusTarget;
    lessonId: string;
  }>();
  const cards = useRef(new Map<string, HTMLDivElement>());
  const lastStudent = useMemo(() => savedStudent(lessonId), [lessonId]);
  const preferredId =
    selected?.lessonId === lessonId ? selected.id : lastStudent;

  const rememberStudent = useCallback((id: string) => {
    const { lessonId } = useRosterStore.getState();
    setSelected((previous) =>
      previous?.id === id && previous.lessonId === lessonId
        ? previous
        : { id, lessonId },
    );
    try {
      if (savedStudent(lessonId) !== id)
        localStorage.setItem(`lessonSelection:${lessonId}`, id);
    } catch {
      /* The student can still be selected when browser storage is full. */
    }
  }, []);

  const navigateStudent = useCallback(
    (id: string, target: FocusTarget = "card") => {
      rememberStudent(id);
      setNavigationTarget({
        id,
        target,
        lessonId: useRosterStore.getState().lessonId,
      });
    },
    [rememberStudent],
  );

  useLayoutEffect(() => {
    if (navigationTarget?.lessonId !== lessonId) return;
    const card = cards.current.get(navigationTarget.id);
    if (!card) return;
    const selector =
      navigationTarget.target === "feedback"
        ? "[data-feedback-body]"
        : "[data-observation]";
    const target =
      navigationTarget.target === "card"
        ? card
        : (card.querySelector<HTMLElement>(selector) ?? card);
    let pendingFocus = true;
    const cancelFocus = () => {
      pendingFocus = false;
    };
    // Focusing can open an Ant tooltip. Let that event run outside this commit.
    queueMicrotask(() => {
      if (pendingFocus && target.isConnected)
        target.focus({ preventScroll: true });
    });
    const workbench = workbenchRef.current;
    const headers = workbench?.querySelectorAll(
      ".workbench-toolbar, .mobile-student-navigation",
    );
    const inset = Math.max(
      0,
      ...Array.from(headers ?? []).map((header) => {
        const style = getComputedStyle(header);
        return style.position === "sticky" && style.display !== "none"
          ? header.clientHeight + (Number.parseFloat(style.top) || 0) + 8
          : 0;
      }),
    );
    const isCard = navigationTarget.target === "card";
    const actionBar = workbench?.querySelector('.action-bar[data-open="true"]');
    const reveal = () => {
      const rect = target.getBoundingClientRect();
      const bar = actionBar?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportBottom = viewport
        ? viewport.height + viewport.offsetTop
        : innerHeight;
      const visibleBottom =
        bar && bar.top > inset
          ? Math.min(viewportBottom, bar.top)
          : viewportBottom;
      if (rect.top >= inset - 1 && rect.bottom <= visibleBottom - 8) return 0;
      const top = isCard
        ? inset
        : Math.max(inset, (visibleBottom + inset - rect.height) / 2);
      const offset = window.scrollY;
      const page = document.scrollingElement;
      const end = Math.max(
        0,
        (page?.scrollHeight ?? innerHeight) - innerHeight,
      );
      const destination = Math.min(end, Math.max(0, offset + rect.top - top));
      const distance = Math.abs(destination - offset);
      if (distance <= 1) return 0;
      window.scrollTo({
        top: destination,
        behavior: prefersReducedMotion() ? "instant" : "smooth",
      });
      return distance;
    };
    const distance = reveal();
    if (!distance || prefersReducedMotion()) return cancelFocus;
    const stage =
      distance >= innerHeight
        ? card.closest<HTMLElement>(".editor-stage.compact-grid")
        : null;
    const endStageScroll = beginStageNavigationScroll(stage);
    const controller = new AbortController();
    let settleTimer: number;
    let canRetry = Boolean(stage);
    const cancel = () => {
      cancelFocus();
      controller.abort();
      window.clearTimeout(settleTimer);
      endStageScroll();
    };
    // Allow for late geometry updates and browsers without scrollend.
    const finish = () => {
      const remaining = target.isConnected ? reveal() : 0;
      if (canRetry && remaining >= innerHeight && !prefersReducedMotion()) {
        canRetry = false;
        scheduleFinish(1200);
        return;
      }
      cancel();
    };
    const scheduleFinish = (delay: number) => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(finish, delay);
    };
    scheduleFinish(1200);
    if (stage) {
      window.addEventListener("scroll", () => scheduleFinish(150), {
        passive: true,
        signal: controller.signal,
      });
    }
    window.addEventListener("scrollend", finish, {
      signal: controller.signal,
    });
    const unsubscribe = onMotionReduced(finish);
    controller.signal.addEventListener("abort", unsubscribe, { once: true });
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"])
      window.addEventListener(type, cancel, {
        once: true,
        passive: true,
        signal: controller.signal,
      });
    return cancel;
  }, [lessonId, navigationTarget, workbenchRef]);

  return {
    cards,
    preferredId,
    rememberStudent,
    navigateStudent,
    navigationTarget,
  };
}
