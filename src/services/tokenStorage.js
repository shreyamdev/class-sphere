const KEY = "classsphere_tokens";

export const tokenStorage = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  },
  set(tokens) {
    localStorage.setItem(KEY, JSON.stringify(tokens));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
