/**
 * Waits for `promise`, but no longer than `ms`: past that it resolves to `undefined` and
 * leaves the promise running on its own. A rejection inside the limit still rejects.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}
