import { BOARD_SIZE, FREE_SPACE_INDEX } from "./board";

export type SeasonSquare = {
  index: number;
  businessId: string | null;
};

export function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildSeasonSquares(businessIds: string[]): SeasonSquare[] {
  const expected = BOARD_SIZE * BOARD_SIZE - 1;
  if (businessIds.length < expected) {
    throw new Error("Not enough businesses to fill the board");
  }
  const shuffled = shuffle(businessIds).slice(0, expected);
  const squares: SeasonSquare[] = [];
  let businessCursor = 0;
  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
    if (index === FREE_SPACE_INDEX) {
      squares.push({ index, businessId: null });
    } else {
      squares.push({ index, businessId: shuffled[businessCursor] });
      businessCursor += 1;
    }
  }
  return squares;
}
