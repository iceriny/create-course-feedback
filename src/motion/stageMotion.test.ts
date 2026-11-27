import { describe, expect, it, vi } from "vitest";
import { createStageMotionSignal } from "./stageMotion";

describe("编辑舞台运动调度", () => {
  it("动画和交叠的导航滚动全部结束后才唤醒视口挂载", () => {
    const stage = createStageMotionSignal();
    const flush = vi.fn();
    stage.subscribe(flush);

    stage.setMovement("page");
    const endFirstScroll = stage.beginNavigationScroll();
    const endSecondScroll = stage.beginNavigationScroll();
    endFirstScroll();
    endFirstScroll();
    stage.setMovement(undefined);

    expect(stage.isBusy()).toBe(true);
    expect(flush).not.toHaveBeenCalled();

    endSecondScroll();

    expect(stage.isBusy()).toBe(false);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("每个舞台只唤醒一次共享调度器，单一卡片卸载后仍可调度其余卡片", () => {
    const stage = createStageMotionSignal();
    const flush = vi.fn();
    const removeFirst = stage.subscribe(flush);
    const removeSecond = stage.subscribe(flush);

    stage.beginNavigationScroll()();
    expect(flush).toHaveBeenCalledTimes(1);

    removeFirst();
    stage.beginNavigationScroll()();
    expect(flush).toHaveBeenCalledTimes(2);

    removeSecond();
    stage.beginNavigationScroll()();
    expect(flush).toHaveBeenCalledTimes(2);
  });
});
