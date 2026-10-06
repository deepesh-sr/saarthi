let cached: boolean | undefined;

function isEnabled(): boolean {
  if (cached === undefined) {
    const value = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.SAARTHI_DEBUG;
    cached = value === "1" || value === "true";
  }
  return cached;
}

export function debug(scope: string, ...args: unknown[]): void {
  if (!isEnabled()) return;
  console.log(`[saarthi:${scope}]`, ...args);
}
