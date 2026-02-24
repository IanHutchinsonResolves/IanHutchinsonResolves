export const BOARD_SIZE = 5;
export const FREE_SPACE_INDEX = 12;

export function normalizeEarnedIndices(indices: number[]): number[] {
  const unique = Array.from(new Set(indices));
  unique.sort((a, b) => a - b);
  return unique;
}

export function getRowIndices(row: number): number[] {
  const start = row * BOARD_SIZE;
  return Array.from({ length: BOARD_SIZE }, (_, i) => start + i);
}

export function computeCompletedRows(earnedIndices: number[]): number[] {
  const earnedSet = new Set(earnedIndices);
  const completed: number[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rowIndices = getRowIndices(row);
    const isComplete = rowIndices.every((idx) => earnedSet.has(idx));
    if (isComplete) {
      completed.push(row);
    }
  }
  return completed;
}

export function isBoardComplete(earnedIndices: number[]): boolean {
  return earnedIndices.length >= BOARD_SIZE * BOARD_SIZE;
}
