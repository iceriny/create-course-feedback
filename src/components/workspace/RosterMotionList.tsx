import { Component, createRef } from "react";
import type { ReactNode } from "react";
import {
  animateMotion,
  motionTiming,
  prefersReducedMotion,
} from "../../motion/engine";
import "./roster-motion.css";

type Props = {
  children: ReactNode;
  className: string;
  order: string;
  search?: string;
  selected?: string;
};

type Position = {
  row: HTMLElement;
  top: number;
  height: number;
  opacity: string;
  visible: boolean;
};

function translateY(transform: string) {
  return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
}

export default class RosterMotionList extends Component<Props> {
  private list = createRef<HTMLDivElement>();
  private marker = createRef<HTMLSpanElement>();
  private ghosts = createRef<HTMLDivElement>();
  private resize?: ResizeObserver;
  private markerMotion?: Animation;
  private markerTop?: number;
  private rows = new Map<HTMLElement, Animation>();
  private exits = new Set<Animation>();

  componentDidMount() {
    const list = this.list.current;
    if (!list || this.props.selected === undefined) return;
    this.moveMarker(true);
    this.resize = new ResizeObserver(() => this.moveMarker(true));
    this.resize.observe(list);
  }

  getSnapshotBeforeUpdate(previous: Props) {
    const list = this.list.current;
    if (
      previous.order === this.props.order ||
      previous.search !== this.props.search ||
      !list?.clientHeight ||
      prefersReducedMotion()
    ) {
      return null;
    }
    const top = list.scrollTop;
    const bottom = top + list.clientHeight;
    const positions = new Map<string, Position>();
    for (const row of list.querySelectorAll<HTMLElement>(
      ":scope > [data-roster-row]",
    )) {
      const style = this.rows.has(row) ? getComputedStyle(row) : undefined;
      const rowTop = row.offsetTop + translateY(style?.transform ?? "none");
      const height = row.offsetHeight;
      positions.set(row.dataset.rosterRow!, {
        row,
        top: rowTop,
        height,
        opacity: style?.opacity ?? "1",
        visible: rowTop + height > top && rowTop < bottom,
      });
    }
    return positions;
  }

  componentDidUpdate(
    previous: Props,
    _state: unknown,
    positions: Map<string, Position> | null,
  ) {
    if (previous.order !== this.props.order) this.animateRows(positions);
    if (
      previous.selected !== this.props.selected ||
      previous.order !== this.props.order ||
      previous.search !== this.props.search
    ) {
      this.moveMarker(previous.search !== this.props.search);
    }
  }

  componentWillUnmount() {
    this.resize?.disconnect();
    this.markerMotion?.cancel();
    for (const animation of this.rows.values()) animation.cancel();
    for (const animation of this.exits) animation.cancel();
  }

  private moveMarker(instant: boolean) {
    const list = this.list.current;
    const marker = this.marker.current;
    if (!list?.clientHeight || !marker) return;
    const selected = this.props.selected;
    const row = selected
      ? list.querySelector<HTMLElement>(
          `:scope > [data-roster-row="${CSS.escape(selected)}"]`,
        )
      : null;
    if (!row) {
      this.markerMotion?.cancel();
      marker.hidden = true;
      this.markerTop = undefined;
      return;
    }
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    const oldScroll = list.scrollTop;
    if (top < oldScroll) list.scrollTop = top;
    else if (bottom > oldScroll + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;

    if (top === this.markerTop && !marker.hidden && !instant) return;
    const from = translateY(getComputedStyle(marker).transform);
    this.markerMotion?.cancel();
    marker.style.height = `${row.offsetHeight}px`;
    marker.style.transform = `translateY(${top}px)`;
    const wasVisible = !marker.hidden;
    marker.hidden = false;
    this.markerTop = top;
    if (!wasVisible || instant || prefersReducedMotion() || from === top)
      return;
    const visibleStart = Math.max(
      list.scrollTop - row.offsetHeight,
      Math.min(list.scrollTop + list.clientHeight, from),
    );
    this.markerMotion = animateMotion(
      marker,
      [
        { transform: `translateY(${visibleStart}px)` },
        { transform: `translateY(${top}px)` },
      ],
      "move",
    );
  }

  private animateRows(positions: Map<string, Position> | null) {
    const list = this.list.current;
    if (!list) return;
    if (!positions) {
      for (const animation of this.rows.values()) animation.cancel();
      for (const animation of this.exits) animation.cancel();
      return;
    }

    const next = Array.from(
      list.querySelectorAll<HTMLElement>(":scope > [data-roster-row]"),
    );
    const ids = new Set(next.map((row) => row.dataset.rosterRow!));
    const exits = Array.from(positions).filter(
      ([id, position]) => position.visible && !ids.has(id),
    );
    if (next.length === 0 && exits.length)
      list.style.minHeight = `${Math.max(...exits.map(([, p]) => p.top + p.height))}px`;
    else list.style.removeProperty("min-height");
    for (const [, position] of exits) this.exitRow(position);

    const viewportTop = list.scrollTop;
    const viewportEnd = viewportTop + list.clientHeight;
    const hasExit = this.exits.size > 0;
    const exitTime = motionTiming("exit").duration;
    const move = motionTiming("move");
    const duration = move.duration + exitTime;
    const frames = next.flatMap((row) => {
      const previous = positions.get(row.dataset.rosterRow!);
      const top = row.offsetTop;
      const visible = top + row.offsetHeight > viewportTop && top < viewportEnd;
      if (!visible && !previous?.visible) return [];
      const distance = previous ? previous.top - top : 8;
      if (Math.abs(distance) < 0.5 && previous?.opacity === "1") return [];
      const start = {
        transform: `translateY(${distance}px)`,
        opacity: previous?.opacity ?? 0,
      };
      return [
        {
          row,
          frames: [
            start,
            ...(hasExit
              ? [{ ...start, offset: exitTime / duration, easing: move.easing }]
              : []),
            { transform: "translateY(0)", opacity: 1 },
          ],
        },
      ];
    });
    for (const animation of this.rows.values()) animation.cancel();
    this.rows.clear();
    for (const { row, frames: keyframes } of frames) {
      const animation = animateMotion(row, keyframes, "move");
      if (!animation) continue;
      if (hasExit)
        animation.effect?.updateTiming({ duration, easing: "linear" });
      this.rows.set(row, animation);
      const release = () => {
        if (this.rows.get(row) === animation) this.rows.delete(row);
      };
      void animation.finished.then(release, release);
    }
  }

  private exitRow(position: Position) {
    const layer = this.ghosts.current;
    if (!layer) return;
    const ghost = position.row.cloneNode(true) as HTMLElement;
    ghost.classList.add("roster-row-exit");
    ghost.inert = true;
    ghost.removeAttribute("id");
    ghost
      .querySelectorAll("[id]")
      .forEach((node) => node.removeAttribute("id"));
    ghost.style.top = `${position.top}px`;
    ghost.style.height = `${position.height}px`;
    layer.append(ghost);
    const animation = animateMotion(
      ghost,
      [
        { transform: "translateX(0)", opacity: position.opacity },
        { transform: "translateX(-12px)", opacity: 0 },
      ],
      "exit",
    );
    if (!animation) {
      ghost.remove();
      return;
    }
    this.exits.add(animation);
    const release = () => {
      this.exits.delete(animation);
      ghost.remove();
      if (!this.exits.size)
        this.list.current?.style.removeProperty("min-height");
    };
    void animation.finished.then(release, release);
  }

  render() {
    const { className, children, selected } = this.props;
    return (
      <div className={`${className} roster-motion-list`} ref={this.list}>
        {selected !== undefined && (
          <span
            className="roster-selection-marker"
            ref={this.marker}
            aria-hidden="true"
            hidden
          />
        )}
        {children}
        <div
          className="roster-row-exits"
          ref={this.ghosts}
          aria-hidden="true"
        />
      </div>
    );
  }
}
