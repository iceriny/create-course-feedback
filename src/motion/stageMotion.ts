import { createContext } from "react";

export type StageMovement = "mode" | "page" | "peer" | "layout";

export function createStageMotionSignal() {
  let movement: StageMovement | undefined;
  let scrolls = 0;
  const listeners = new Map<() => void, number>();
  const isBusy = () => movement !== undefined || scrolls > 0;
  const notifyWhenSettled = () => {
    if (isBusy()) return;
    for (const listener of listeners.keys()) listener();
  };

  return {
    isBusy,
    getMovement: () => movement,
    setMovement(next: StageMovement | undefined) {
      if (movement === next) return;
      movement = next;
      notifyWhenSettled();
    },
    beginNavigationScroll() {
      scrolls++;
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        scrolls--;
        notifyWhenSettled();
      };
    },
    subscribe(listener: () => void) {
      // All cards share a scheduler, but release their subscriptions separately.
      listeners.set(listener, (listeners.get(listener) ?? 0) + 1);
      return () => {
        const users = listeners.get(listener) ?? 0;
        if (users <= 1) listeners.delete(listener);
        else listeners.set(listener, users - 1);
      };
    },
  };
}

export type StageMotionSignal = ReturnType<typeof createStageMotionSignal>;

export const StageMotionContext = createContext<StageMotionSignal | null>(null);

const stageSignals = new WeakMap<HTMLElement, StageMotionSignal>();

export function bindStageMotion(stage: HTMLElement, signal: StageMotionSignal) {
  stageSignals.set(stage, signal);
  return () => stageSignals.delete(stage);
}

export function beginStageNavigationScroll(stage?: HTMLElement | null) {
  const signal = stage ? stageSignals.get(stage) : undefined;
  return signal?.beginNavigationScroll() ?? (() => {});
}
