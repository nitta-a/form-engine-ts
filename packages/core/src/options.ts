import type { FieldOption } from "./types";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: { value: number }): number {
  state.value = (state.value + 0x6d2b79f5) | 0;
  let result = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
  result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
  return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
}

/** Returns a stable order while preserving the original positions of pinned options. */
export function shuffleOptions(options: readonly FieldOption[], seed: string): readonly FieldOption[] {
  const movable = options.filter((option) => option.pinned !== true);
  const state = { value: hashSeed(seed) };
  for (let index = movable.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(state) * (index + 1));
    const current = movable[index];
    movable[index] = movable[swapIndex] as FieldOption;
    movable[swapIndex] = current as FieldOption;
  }
  let movableIndex = 0;
  return options.map((option) => (option.pinned === true ? option : (movable[movableIndex++] as FieldOption)));
}
