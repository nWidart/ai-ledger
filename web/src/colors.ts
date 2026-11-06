// Project colors, the same on every page and in every range: only the TOP busiest projects (all-time order from the server,
// which ignores every filter) get a hue, and no two of them share one. Each claims its hashed slot and steps to the next
// free one on a clash, so a project keeps its hue while the ranking below it shifts. Every other project is grey,
// the same grey as "Other" in the charts. Pages call setOrder once their data arrives; until then all dots are grey.
import { useSyncExternalStore } from "react";

export const TOP = 6; // the number of --proj-N hues in theme.css
const slots = new Map<string, number>(), subs = new Set<() => void>();
let version = 0, current: readonly string[] = [];

const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
};
/** Slot (0-based) per project for an all-time order, busiest first. */
export function slotsFor(order: readonly string[]): Map<string, number> {
  const out = new Map<string, number>(), used = new Set<number>();
  for (const p of order.slice(0, TOP)) {
    let i = hash(p) % TOP;
    while (used.has(i)) i = (i + 1) % TOP;
    used.add(i); out.set(p, i);
  }
  return out;
}
export function setOrder(order: readonly string[] | null | undefined) {
  const o = order ?? [];
  if (o.length === current.length && o.every((p, i) => p === current[i])) return;
  current = o.slice();
  slots.clear();
  for (const [p, i] of slotsFor(o)) slots.set(p, i);
  version++;
  subs.forEach(f => f());
}
export const hasHue = (p: string | null | undefined): boolean => !!p && slots.has(p);
/** A CSS color for the project; no name, or the long tail: "Other". */
export const color = (p: string | null | undefined): string => (p && slots.has(p) ? `var(--proj-${slots.get(p)! + 1})` : "var(--proj-other)");

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Re-renders the caller when the order changes; returns color(). */
export function useColors(): typeof color {
  useSyncExternalStore(subscribe, () => version, () => version);
  return color;
}
