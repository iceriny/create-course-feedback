type Position = { left: number; top: number };
type Size = { width: number; height: number };
type Rect = Position & Size & { right: number; bottom: number };

export function isStageRectVisible(rect: Rect, viewport: Size) {
  return (
    rect.bottom > 0 &&
    rect.top < viewport.height &&
    rect.right > 0 &&
    rect.left < viewport.width
  );
}

export function stageOffset(from: Position, to: Position) {
  return { x: from.left - to.left, y: from.top - to.top };
}

export function hasStageMovement(x: number, y: number) {
  return Math.abs(x) + Math.abs(y) > 0.5;
}

export function peerArrivalX(
  from: Position | undefined,
  to: Position,
  previousCard: Position | undefined,
  stage: Rect,
  direction: 1 | -1,
) {
  if (from) return from.left - to.left;
  const previousOffset = previousCard ? previousCard.left - stage.left : 0;
  return previousOffset + direction * (stage.width + 12);
}

export function retiringCardBox(
  rect: Rect | undefined,
  stage: Rect,
  viewport: Size,
) {
  if (
    !rect ||
    !isStageRectVisible(rect, viewport) ||
    rect.right <= stage.left ||
    rect.left >= stage.right
  )
    return;
  const { x, y } = stageOffset(rect, stage);
  return { left: x, top: y, width: rect.width, height: rect.height };
}

export function backplateGeometry(from: Rect, to: Rect) {
  if (!from.width || !from.height || !to.width || !to.height) return;
  const movement = stageOffset(from, to);
  const widthChange = to.width - from.width;
  const heightChange = to.height - from.height;
  if (Math.abs(widthChange) + Math.abs(heightChange) < 0.5) return { movement };
  return {
    movement,
    resize: {
      scaleX: from.width / to.width,
      scaleY: from.height / to.height,
      clipRight: Math.max(0, widthChange),
      clipBottom: Math.max(0, heightChange),
    },
  };
}
