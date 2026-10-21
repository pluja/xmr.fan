import type { Locale } from "./ui";

type Others = Exclude<Locale, "en">;

/** A module's strings: English is the source; every other language must have every key. */
export type Strings<T extends Record<string, string>> = { en: T } & { [L in Others]: Record<keyof T, string> };

export const defineStrings = <T extends Record<string, string>>(s: Strings<T>) => s;
