import { Component, createRef, type ReactNode } from "react";
import { animateMotion, prefersReducedMotion } from "./engine";

type Props = { lesson: string; children: ReactNode };

// Keep one reading surface as a welcome panel, summary or form takes its place.
// Only the current lesson owns live inputs and subscribes to the course store.
export default class LessonSurface extends Component<Props> {
  private surface = createRef<HTMLDivElement>();
  private motion?: Animation;

  getSnapshotBeforeUpdate(previous: Props) {
    if (previous.lesson === this.props.lesson || prefersReducedMotion())
      return null;
    return this.surface.current!.getBoundingClientRect().height;
  }

  componentDidUpdate(previous: Props, _state: unknown, height: number | null) {
    if (previous.lesson === this.props.lesson) return;
    this.motion?.cancel();
    const surface = this.surface.current!;
    const next = surface.offsetHeight;
    if (height === null || Math.abs(next - height) < 1) return;
    const motion = animateMotion(
      surface,
      [
        { height: `${height}px` },
        {
          height: CSS.supports("interpolate-size", "allow-keywords")
            ? "auto"
            : `${next}px`,
        },
      ],
      "enter",
      "lesson",
    );
    if (!motion) return;
    this.motion = motion;
    surface.dataset.resizing = "";
    const release = () => {
      if (this.motion === motion) delete surface.dataset.resizing;
    };
    void motion.finished.then(release, release);
  }

  componentWillUnmount() {
    this.motion?.cancel();
  }
  render() {
    return (
      <div className="lesson-surface" ref={this.surface}>
        {this.props.children}
      </div>
    );
  }
}
