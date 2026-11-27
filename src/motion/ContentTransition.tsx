import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { animateMotion, prefersReducedMotion } from "./engine";
import "./overlay-content.css";

type Direction = "forward" | "back" | "replace";
type Props = {
  contentKey: string;
  replacementKey?: string;
  direction: Direction;
  children: ReactNode;
};

type Pane = {
  contentKey: string;
  replacementKey?: string;
  children: ReactNode;
  order: number;
};
type RetiringPane = { pane: Pane; direction: Direction };

function paneKey(pane: Pick<Pane, "contentKey" | "replacementKey">) {
  return JSON.stringify([pane.contentKey, pane.replacementKey]);
}

export default function ContentTransition({
  contentKey,
  replacementKey,
  direction,
  children,
}: Props) {
  const incoming = { contentKey, replacementKey, children };
  const committed = useRef(incoming);
  // Only committed content can become the outgoing visual snapshot.
  useLayoutEffect(() => {
    committed.current = { contentKey, replacementKey, children };
  }, [contentKey, replacementKey, children]);
  const [frame, setFrame] = useState<{
    active: Pane;
    outgoing: RetiringPane[];
    direction: Direction;
    nextOrder: number;
  }>({
    active: { ...incoming, order: 0 },
    outgoing: [],
    direction,
    nextOrder: 1,
  });
  const navigated = frame.active.contentKey !== contentKey;
  const replaced = frame.active.replacementKey !== replacementKey;
  if (navigated || replaced) {
    const arrival = navigated ? direction : "replace";
    const incomingKey = paneKey(incoming);
    const returning = frame.outgoing.find(
      ({ pane }) => paneKey(pane) === incomingKey,
    );
    // Keep returning panes in the same DOM slot so their transitions continue.
    const order = returning?.pane.order ?? frame.nextOrder;
    const outgoing =
      paneKey(committed.current) === paneKey(frame.active)
        ? { ...frame.active, children: committed.current.children }
        : frame.active;
    setFrame({
      active: { ...incoming, order },
      outgoing: prefersReducedMotion()
        ? []
        : [
            ...frame.outgoing.filter(
              ({ pane }) => paneKey(pane) !== incomingKey,
            ),
            { pane: outgoing, direction: arrival },
          ],
      direction: arrival,
      nextOrder: Math.max(frame.nextOrder, order + 1),
    });
  }

  const viewport = useRef<HTMLDivElement>(null);
  const activeKey = paneKey(frame.active);
  const previousKey = useRef(activeKey);
  const resize = useRef<Animation>(undefined);
  useLayoutEffect(() => {
    const element = viewport.current;
    const oldKey = previousKey.current;
    previousKey.current = activeKey;
    if (!element || oldKey === activeKey || prefersReducedMotion()) return;

    const panes = Array.from(
      element.querySelectorAll<HTMLElement>(":scope > [data-overlay-pane]"),
    );
    const previous = panes.find((pane) => pane.dataset.overlayKey === oldKey);
    const current = panes.find((pane) => pane.dataset.overlayKey === activeKey);
    if (!previous || !current) return;

    const from =
      resize.current?.playState === "running"
        ? element.offsetHeight
        : previous.offsetHeight;
    const to = current.offsetHeight;
    resize.current?.cancel();
    if (Math.abs(to - from) < 1) return;
    const motion = animateMotion(
      element,
      [{ height: `${from}px` }, { height: `${to}px` }],
      "enter",
      "overlay-height",
    );
    if (!motion) return;
    resize.current = motion;
    element.dataset.resizing = "";
    const release = () => {
      if (resize.current !== motion) return;
      resize.current = undefined;
      delete element.dataset.resizing;
    };
    void motion.finished.then(release, release);
  }, [activeKey]);
  useLayoutEffect(() => () => resize.current?.cancel(), []);

  return (
    <div
      ref={viewport}
      className="overlay-content"
      data-direction={frame.direction}
    >
      {[
        ...frame.outgoing.map((entry) => ({ ...entry, retiring: entry })),
        {
          pane: { ...frame.active, children },
          direction: frame.direction,
          retiring: undefined,
        },
      ]
        .sort((left, right) => left.pane.order - right.pane.order)
        .map(({ pane, direction, retiring }) => {
          return (
            <div
              key={paneKey(pane)}
              data-overlay-key={paneKey(pane)}
              data-overlay-direction={direction}
              data-overlay-pane={retiring ? "outgoing" : "active"}
              aria-hidden={retiring ? true : undefined}
              inert={Boolean(retiring)}
              onAnimationEnd={(event) => {
                if (
                  !retiring ||
                  event.animationName !== "overlay-pane-clock" ||
                  event.target !== event.currentTarget
                )
                  return;
                setFrame((current) => ({
                  ...current,
                  outgoing: current.outgoing.filter(
                    (entry) => entry !== retiring,
                  ),
                }));
              }}
            >
              {pane.children}
            </div>
          );
        })}
    </div>
  );
}
