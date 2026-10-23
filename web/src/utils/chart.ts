const MAX_BAR_HEIGHT_PX = 120
const MIN_BAR_HEIGHT_PX = 4

/** Altura (px) da coluna de um percentual 0–100, com um mínimo visível. */
export function barHeight(percentual: number): number {
  return Math.max((percentual / 100) * MAX_BAR_HEIGHT_PX, MIN_BAR_HEIGHT_PX)
}

export { MAX_BAR_HEIGHT_PX }
