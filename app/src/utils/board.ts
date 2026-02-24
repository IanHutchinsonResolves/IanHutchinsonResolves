export const BOARD_SIZE = 5;
export const FREE_SPACE_INDEX = 12;

export function getRowIndices(row: number) {
  const start = row * BOARD_SIZE;
  return Array.from({ length: BOARD_SIZE }, (_, i) => start + i);
}

export function computeCompletedRows(earnedIndices: number[]) {
  const earned = new Set(earnedIndices);
  const rows: number[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const indices = getRowIndices(row);
    if (indices.every((idx) => earned.has(idx))) {
      rows.push(row);
    }
  }
  return rows;
}
