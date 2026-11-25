import {
  cloneElement,
  Component,
  createRef,
  type HTMLAttributes,
  type ReactElement,
} from "react";
import { animateMotion, prefersReducedMotion } from "./engine";

type Card = ReactElement<
  HTMLAttributes<HTMLDivElement> & {
    "data-current-editor"?: boolean;
    "data-retiring"?: boolean;
    "data-prepared"?: boolean;
  }
>;
interface Props {
  compact: boolean;
  cursor: number;
  revision: string;
  cards: Card[];
  neighbors: Card[];
  navigation?: { id: string };
}
interface State {
  revision: string;
  compact: boolean;
  switchingMode: boolean;
  cards: Card[];
  retiring: Card[];
  prepared: Card["key"][];
}
type Geometry = {
  rect: DOMRect;
  opacity: number;
};

function visible(rect: DOMRect) {
  return (
    rect.bottom > 0 &&
    rect.top < innerHeight &&
    rect.right > 0 &&
    rect.left < innerWidth
  );
}

// React's pre-mutation snapshot captures the presentation position, including
// a partially completed move. All writes happen before the next paint.
export default class EditorStage extends Component<Props, State> {
  state: State = {
    revision: this.props.revision,
    compact: this.props.compact,
    switchingMode: false,
    cards: this.props.cards,
    retiring: [],
    prepared: [],
  };
  private stage = createRef<HTMLDivElement>();
  private animations: Animation[] = [];
  private generation = 0;
  private cancelPreparation?: () => void;

  // Mount at most the two adjacent detail editors while the browser is idle.
  // Their first Ant form render then stays off the navigation event's critical path.
  private prepareNeighbor = () => {
    this.cancelPreparation?.();
    const candidate = this.props.neighbors.find(
      (card) => !this.state.prepared.includes(card.key),
    );
    if (!candidate) return;
    const prepare = () => {
      this.setState(
        (state) => ({
          prepared: this.props.neighbors
            .map((card) => card.key)
            .filter(
              (key) => key === candidate.key || state.prepared.includes(key),
            ),
        }),
        this.prepareNeighbor,
      );
    };
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(prepare);
      this.cancelPreparation = () => cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(prepare, 100);
      this.cancelPreparation = () => clearTimeout(handle);
    }
  };

  componentDidMount() {
    this.prepareNeighbor();
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    if (props.revision === state.revision) return null;
    const keys = new Set(props.cards.map((card) => card.key));
    return {
      revision: props.revision,
      compact: props.compact,
      switchingMode: props.compact !== state.compact,
      cards: props.cards,
      prepared:
        props.compact !== state.compact
          ? []
          : props.neighbors
              .map((card) => card.key)
              .filter(
                (key) =>
                  state.prepared.includes(key) ||
                  state.cards.some((card) => card.key === key),
              ),
      retiring: prefersReducedMotion()
        ? []
        : [...state.retiring, ...state.cards].filter(
            (card) => !keys.has(card.key),
          ),
    };
  }

  getSnapshotBeforeUpdate(previous: Props) {
    if (previous.revision === this.props.revision) return null;
    const currentOnly =
      previous.compact !== this.props.compact || prefersReducedMotion();
    const geometry = new Map<HTMLElement, Geometry>();
    const stage = this.stage.current!;
    for (const card of Array.from(stage.children) as HTMLElement[]) {
      if (
        card.hidden ||
        card.hasAttribute("data-prepared") ||
        (currentOnly && card.dataset.currentEditor !== "true")
      )
        continue;
      const surface =
        stage.dataset.moving === "mode"
          ? (card.querySelector<HTMLElement>(".editor-backplate") ?? card)
          : card;
      const rect = surface.getBoundingClientRect();
      geometry.set(card, {
        rect,
        opacity:
          !currentOnly && this.animations.length && visible(rect)
            ? Number(getComputedStyle(card).opacity)
            : 1,
      });
    }
    return geometry;
  }

  componentDidUpdate(
    previous: Props,
    _state: State,
    before: Map<HTMLElement, Geometry> | null,
  ) {
    if (previous.revision === this.props.revision) {
      if (
        this.props.neighbors.some(
          (card, i) => card.key !== previous.neighbors[i]?.key,
        )
      )
        this.prepareNeighbor();
      return;
    }
    const generation = ++this.generation;
    this.stop();
    const stage = this.stage.current!;
    this.cancelPreparation?.();
    const cards = (Array.from(stage.children) as HTMLElement[]).filter(
      (card) => !card.hasAttribute("data-prepared"),
    );
    for (const card of cards) {
      card.style.removeProperty("width");
      card.style.removeProperty("height");
      card.style.removeProperty("left");
      card.style.removeProperty("top");
      card.style.removeProperty("display");
      if (
        before &&
        card.dataset.studentId &&
        !card.hasAttribute("data-retiring") &&
        !before.has(card)
      ) {
        card.setAttribute("data-content-arriving", "");
      }
    }
    const finish = () => {
      if (generation !== this.generation) return;
      delete stage.dataset.moving;
      for (const card of stage.children)
        card.removeAttribute("data-content-arriving");
      this.animations = [];
      // An outgoing picture stays out of hit testing until React releases it.
      for (const card of cards)
        if (card.hasAttribute("data-retiring")) card.style.display = "none";
      if (this.state.retiring.length) {
        const live = new Set(
          cards
            .filter(
              (node) =>
                node.hasAttribute("data-retiring") &&
                node.querySelector("[data-editor-ready]"),
            )
            .map((node) => node.dataset.studentId),
        );
        const prepared = this.props.neighbors
          .map((neighbor) => neighbor.key)
          .filter(
            (key) => live.has(String(key)) || this.state.prepared.includes(key),
          );
        this.setState({ retiring: [], prepared }, () => {
          if (generation === this.generation) this.prepareNeighbor();
        });
      } else this.prepareNeighbor();
    };
    const current = stage.querySelector<HTMLElement>(
      '[data-current-editor="true"]',
    );
    if (!current || !before) {
      finish();
      return;
    }
    const old = before.get(current);
    let next = current.getBoundingClientRect();
    if (old && visible(old.rect) && !visible(next)) {
      // Preserve the selected card's screen position across long grid reflows.
      window.scrollBy({ top: next.top - old.rect.top, behavior: "instant" });
      next = current.getBoundingClientRect();
    }
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    if (previous.compact !== this.props.compact) {
      stage.dataset.moving = "mode";
      if (old && visible(next) && next.width && next.height) {
        this.morphCard(current, old.rect, next);
      }
      if (this.animations.length)
        void Promise.allSettled(this.animations.map((a) => a.finished)).then(
          finish,
        );
      else finish();
      return;
    }
    const bounds = stage.getBoundingClientRect();
    const peer =
      previous.compact === this.props.compact &&
      previous.navigation !== this.props.navigation &&
      this.props.navigation?.id === current.dataset.studentId;
    const sign = this.props.cursor >= previous.cursor ? 1 : -1;
    const stride = bounds.width + 12;
    const previousActive = [...before.keys()].find(
      (node) => node.dataset.studentId === previous.cards[0]?.key,
    );
    const origin = previousActive && before.get(previousActive)?.rect;
    const incomingX = old
      ? old.rect.left - next.left
      : (origin ? origin.left - bounds.left : 0) + sign * stride;
    stage.dataset.moving = peer
      ? this.props.compact
        ? "page"
        : "peer"
      : "layout";

    const play = (
      node: HTMLElement,
      frames: Keyframe[],
      intent: "enter" | "exit" | "move",
      channel = "geometry",
    ) => {
      const animation = animateMotion(node, frames, intent, channel);
      if (animation) this.animations.push(animation);
      return animation;
    };
    // Place all outgoing nodes first, then read the final layout in one batch.
    const discard = new Set<string>();
    for (const card of cards) {
      if (!card.hasAttribute("data-retiring")) continue;
      const rect = before.get(card)?.rect;
      if (
        !rect ||
        !visible(rect) ||
        rect.right <= bounds.left ||
        rect.left >= bounds.right
      ) {
        card.style.display = "none";
        if (card.dataset.studentId) discard.add(card.dataset.studentId);
        continue;
      }
      Object.assign(card.style, {
        left: `${rect.left - bounds.left}px`,
        top: `${rect.top - bounds.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
    const targets = cards.map((card) => ({
      card,
      rect: card.getBoundingClientRect(),
    }));
    for (const { card, rect } of targets) {
      const from = before.get(card)?.rect;
      if (card.hasAttribute("data-retiring")) {
        if (card.style.display === "none") continue;
        const exit = peer
          ? play(
              card,
              [
                { transform: "none" },
                { transform: `translateX(${-incomingX}px)` },
              ],
              "move",
            )
          : play(
              card,
              [{ opacity: before.get(card)?.opacity ?? 1 }, { opacity: 0 }],
              "exit",
            );
        void exit?.finished.then(
          () => {
            if (generation === this.generation) card.style.display = "none";
          },
          () => {},
        );
        continue;
      }
      if (!visible(rect) && (!from || !visible(from))) continue;
      const opacity = before.get(card)?.opacity ?? 1;
      if (opacity < 0.999)
        play(card, [{ opacity }, { opacity: 1 }], "enter", "visibility");
      const dx = peer ? incomingX : from ? from.left - rect.left : 0;
      const dy = from ? from.top - rect.top : 0;
      if (Math.abs(dx) + Math.abs(dy) > 0.5)
        play(
          card,
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          "move",
        );
      else if (!from && !peer)
        play(
          card,
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
          "enter",
        );
    }
    if (this.animations.length)
      void Promise.allSettled(this.animations.map((a) => a.finished)).then(
        finish,
      );
    else finish();
    if (discard.size && this.animations.length)
      this.setState((state) => ({
        retiring: state.retiring.filter(
          (card) => !discard.has(String(card.key)),
        ),
      }));
  }

  private morphCard(card: HTMLElement, from: DOMRect, to: DOMRect) {
    const x = from.left - to.left,
      y = from.top - to.top;
    const sx = from.width / to.width,
      sy = from.height / to.height;
    if (!sx || !sy) return;
    const move = (node: HTMLElement, frames: Keyframe[]) => {
      const animation = animateMotion(node, frames, "move", "geometry");
      if (animation) this.animations.push(animation);
    };
    if (Math.abs(x) + Math.abs(y) > 0.5)
      move(card, [
        { transform: `translate(${x}px, ${y}px)` },
        { transform: "none" },
      ]);
    if (
      Math.abs(from.width - to.width) + Math.abs(from.height - to.height) <
      0.5
    )
      return;
    const plate = card.querySelector<HTMLElement>(".editor-backplate");
    if (plate)
      move(plate, [
        { transform: `scale(${sx}, ${sy})` },
        { transform: "scale(1)" },
      ]);

    // Text and live inputs lay out once at their final size. Only reveal the
    // part covered by the moving sheet, without scaling the form's texture.
    const face = card.querySelector<HTMLElement>(".viewport-editor");
    const right = Math.max(0, to.width - from.width);
    const bottom = Math.max(0, to.height - from.height);
    if (face && (right || bottom))
      move(face, [
        { clipPath: `inset(0 ${right}px ${bottom}px 0)` },
        { clipPath: "inset(0px)" },
      ]);
  }

  private stop() {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }
  componentWillUnmount() {
    this.generation++;
    this.cancelPreparation?.();
    this.stop();
  }

  render() {
    return (
      <div
        ref={this.stage}
        className={
          this.props.compact ? "editor-stage compact-grid" : "editor-stage"
        }
      >
        {this.props.cards.concat(
          this.state.retiring.map((card) =>
            cloneElement(card, {
              "data-current-editor": false,
              "data-retiring": true,
              hidden: this.state.switchingMode,
              "aria-hidden": true,
              inert: true,
            }),
          ),
          this.props.neighbors
            .filter(
              (card) =>
                this.state.prepared.includes(card.key) &&
                !this.state.retiring.some(
                  (leaving) => leaving.key === card.key,
                ),
            )
            .map((card) =>
              cloneElement(card, {
                "data-prepared": true,
                hidden: true,
                "aria-hidden": true,
                inert: true,
                "data-current-editor": false,
              }),
            ),
        )}
      </div>
    );
  }
}
