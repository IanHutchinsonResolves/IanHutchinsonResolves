import { computeCompletedRows, isBoardComplete, FREE_SPACE_INDEX } from "../src/lib/board";

describe("board completion", () => {
  it("detects completed rows", () => {
    const earned = [0, 1, 2, 3, 4, FREE_SPACE_INDEX];
    const rows = computeCompletedRows(earned);
    expect(rows).toEqual([0]);
  });

  it("detects full board", () => {
    const earned = Array.from({ length: 25 }, (_, i) => i);
    expect(isBoardComplete(earned)).toBe(true);
  });
});
