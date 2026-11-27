import { onMotionReduced, prefersReducedMotion } from "./preference";

export { prefersReducedMotion } from "./preference";

// Sample a unit step response once. CSS transitions and Web Animations then
// run the same trajectory on the browser's own animation timeline.
function spring(damping: number, frequency: number, fallback: string) {
  if (!CSS.supports("animation-timing-function", "linear(0, 1)"))
    return fallback;
  const samples = Array.from({ length: 33 }, (_, index) => {
    if (index === 32) return 1;
    const t = (frequency * index) / 32;
    if (damping === 1) return +(1 - (1 + t) * Math.exp(-t)).toFixed(4);
    const w = Math.sqrt(1 - damping * damping);
    return +(
      1 -
      Math.exp(-damping * t) *
        (Math.cos(w * t) + (damping / w) * Math.sin(w * t))
    ).toFixed(4);
  });
  return `linear(${samples.join(", ")})`;
}

type Intent = "feedback" | "enter" | "move" | "exit";
let duration: Record<Intent, number>;
const active = new Set<Animation>();
const channels = new WeakMap<Element, Map<string, Animation>>();
let curves: Record<Intent, string>;

export function motionTiming(intent: Intent) {
  return { duration: duration[intent], easing: curves[intent] };
}

export function initializeMotion() {
  const settle = spring(1, 7.8, "cubic-bezier(.18,.78,.22,1)");
  const rebound = spring(0.72, 9, "cubic-bezier(.2,.9,.25,1.1)");
  const release = "cubic-bezier(.4,0,.72,.42)";
  curves = { feedback: rebound, enter: settle, move: settle, exit: release };
  const root = document.documentElement.style;
  const tokens = getComputedStyle(document.documentElement);
  duration = {
    feedback: parseFloat(tokens.getPropertyValue("--motion-fast")),
    enter: parseFloat(tokens.getPropertyValue("--motion-base")),
    move: parseFloat(tokens.getPropertyValue("--motion-travel")),
    exit: parseFloat(tokens.getPropertyValue("--motion-exit")),
  };
  root.setProperty("--motion-settle", settle);
  root.setProperty("--motion-spring", rebound);
  root.setProperty("--motion-release", release);
  const unsubscribe = onMotionReduced(() => {
    for (const animation of active) animation.cancel();
  });
  import.meta.hot?.dispose(unsubscribe);
}

export function animateMotion(
  element: Element,
  frames: Keyframe[],
  intent: Intent,
  channel: string = intent,
) {
  let running = channels.get(element);
  running?.get(channel)?.cancel();
  if (prefersReducedMotion() || !element.animate) return;
  if (!running) {
    running = new Map();
    channels.set(element, running);
  }
  const animation = element.animate(frames, motionTiming(intent));
  running.set(channel, animation);
  active.add(animation);
  const release = () => {
    active.delete(animation);
    if (running.get(channel) === animation) running.delete(channel);
  };
  void animation.finished.then(release, release);
  return animation;
}
