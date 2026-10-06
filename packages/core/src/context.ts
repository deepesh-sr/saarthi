import { AsyncLocalStorage } from "node:async_hooks";
import { debug } from "./debug";
import type { Tracer } from "./tracer";

const storage = new AsyncLocalStorage<string>();

export function currentSpanId(): string | undefined {
  return storage.getStore();
}

export function runInSpan<T>(
  tracer: Tracer,
  name: string,
  file: string,
  line: number,
  fn: () => T,
): T {
  const parentId = storage.getStore() ?? null;
  const id = tracer.enter(name, file, line, parentId);
  debug("core", "span:run", { id, name, parentId });

  return storage.run(id, () => {
    let result: T;
    try {
      result = fn();
    } catch (error) {
      debug("core", "span:throw", { id, name });
      tracer.exit(id, error);
      throw error;
    }

    if (isPromiseLike(result)) {
      return result.then(
        (value) => {
          tracer.exit(id);
          return value;
        },
        (error) => {
          tracer.exit(id, error);
          throw error;
        },
      ) as T;
    }

    tracer.exit(id);
    return result;
  });
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
