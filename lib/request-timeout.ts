/** Bound read operations, including auth calls waiting on a browser session lock. */
export async function withTimeout<T>(request: PromiseLike<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
