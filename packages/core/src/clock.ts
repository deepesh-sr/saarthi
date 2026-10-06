export function now(): number {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}

export function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}
