import type { Tracer } from "./tracer";

export type EnterFn = (name: string, file: string, line: number) => string;
export type ExitFn = (id: string, error?: unknown) => void;
export type WaitingFn = (id: string, blockedOn: string) => void;

declare global {
  // eslint-disable-next-line no-var
  var __saarthi_enter: EnterFn | undefined;
  // eslint-disable-next-line no-var
  var __saarthi_exit: ExitFn | undefined;
  // eslint-disable-next-line no-var
  var __saarthi_waiting: WaitingFn | undefined;
}

export function installRuntime(tracer: Tracer): void {
  globalThis.__saarthi_enter = (name, file, line) => tracer.enter(name, file, line);
  globalThis.__saarthi_exit = (id, error) => tracer.exit(id, error);
  globalThis.__saarthi_waiting = (id, blockedOn) => tracer.waiting(id, blockedOn);
}

export function uninstallRuntime(): void {
  globalThis.__saarthi_enter = undefined;
  globalThis.__saarthi_exit = undefined;
  globalThis.__saarthi_waiting = undefined;
}
