/* Tailwind class sets shared by the dark-panel tools. Components in this folder use them, and so can
   plain elements (inputs, links) that don't need a component. */

/** A dark input well. data-state="ok" | "error" or aria-invalid color the border. fieldFrame has no padding, for wrappers. */
export const fieldFrame =
  "block w-full rounded-none border-2 border-graphite bg-well text-base text-cream placeholder:text-line focus:border-orange focus:outline-none aria-invalid:border-bad data-[state=error]:border-bad data-[state=ok]:border-good";
export const field = `${fieldFrame} px-4 py-3`;

export const fieldLabel = "text-sm text-ash";
export const message = "text-sm text-bad empty:hidden";
export const link = "cursor-pointer whitespace-nowrap text-sm text-orange underline underline-offset-3";
/** Small uppercase pixel label, for slips. */
export const label = "font-pixel text-xs uppercase tracking-[0.14em] text-slip-ink";
export const chip = "inline-flex items-center gap-1.5 px-2.5 py-1 font-pixel text-[0.6875rem] uppercase tracking-wider";
/** Chip colors; pick one with chip. */
export const tone = {
  neutral: "bg-graphite text-cream",
  accent: "bg-[#4a2a18] text-orange",
  good: "bg-[#1f3a2a] text-good",
  bad: "bg-[#3a1f1f] text-bad",
} as const;
/** A code well with an orange edge. */
export const code = "block border-l-4 border-orange bg-well px-5 py-4 font-mono text-[0.8125rem] leading-[1.7] text-ash break-all";

const buttonBase = "relative inline-flex cursor-pointer items-center justify-center font-pixel no-underline disabled:cursor-not-allowed disabled:opacity-40";
export const button = {
  primary: `${buttonBase} gap-3 bg-orange px-6 py-3.5 text-base text-ink shadow-[6px_6px_0_var(--color-ember)] not-disabled:hover:bg-peach not-disabled:active:translate-x-[3px] not-disabled:active:translate-y-[3px] not-disabled:active:shadow-[3px_3px_0_var(--color-ember)]`,
  ghost: `${buttonBase} gap-2.5 border-2 border-line px-4 py-3 text-sm text-cream not-disabled:hover:border-orange not-disabled:hover:text-orange`,
} as const;

/** Put on a <details> to make it a step that folds on small screens; see Step.astro. */
export const fold = "group/fold";

/** Joins class sets so later classes win over conflicting earlier ones (px-3 over px-4, w-40 over w-full). */
export { twMerge as cx } from "tailwind-merge";
