/** 04-ARCH §5.5.2: the only module that touches localStorage. Fails soft (private mode). */
export const preferences = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(`cms:${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(`cms:${key}`, value);
    } catch {
      /* storage unavailable: preference is simply not remembered */
    }
  },
};
