import { currentSpanId, runInSpan } from "./context";
import type { Tracer } from "./tracer";

export type RunFn = (
  name: string,
  file: string,
  line: number,
  fn: () => unknown,
) => unknown;

export type WaitingFn = (blockedOn: string) => void;

declare global {
  // eslint-disable-next-line no-var
  var __saarthi_run: RunFn | undefined;
  // eslint-disable-next-line no-var
  var __saarthi_waiting: WaitingFn | undefined;
}

export function installRuntime(tracer: Tracer): void {
  globalThis.__saarthi_run = (name, file, line, fn) =>
    runInSpan(tracer, name, file, line, fn);
  globalThis.__saarthi_waiting = (blockedOn) => {
    const id = currentSpanId();
    if (id) tracer.waiting(id, blockedOn);
  };
}

export function uninstallRuntime(): void {
  globalThis.__saarthi_run = undefined;
  globalThis.__saarthi_waiting = undefined;
}
