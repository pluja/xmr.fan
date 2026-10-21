/** "Hello {name}" + { name: "Ana" } -> "Hello Ana". Shared by server and client code. */
export const format = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : s;

/** Reads strings that a component serialized into data-strings (see pickStrings). */
export function readStrings(el: HTMLElement) {
  const strings: Record<string, string> = JSON.parse(el.dataset.strings ?? "{}");
  return (key: string, vars?: Record<string, string | number>) => format(strings[key] ?? key, vars);
}
