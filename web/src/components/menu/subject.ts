// What the context menu acts on: a subject the page marks in the DOM as data-subject="<kind>:<value>". The kinds match
// the palette's chip kinds for the same subjects, so the menu can hand them to the palette's resolver. The attribute is
// its own, apart from data-v, which the sheets use to find a row again for focus.
import type { ToolKind } from "../../api";

export type SubjectKind = "project" | "session" | ToolKind | "category";
export interface Subject { kind: SubjectKind; value: string }

const KINDS: readonly string[] = ["project", "session", "tool", "mcp", "skill", "category"];

/** The attribute that marks an element as a subject; none for an empty value (an "Other" or unnamed row). An inline
 *  mark (a project name in a row or a tile) yields to a subject around it: the row is what a right-click on it means. */
export const subjectAttrs = (kind: SubjectKind, value: string | null | undefined, inline = false): { "data-subject"?: string; "data-subject-inline"?: "" } =>
  !value ? {} : inline ? { "data-subject": `${kind}:${value}`, "data-subject-inline": "" } : { "data-subject": `${kind}:${value}` };

/** The subject a marked element stands for, or null when the mark is missing or malformed. */
export function subjectOf(el: Element): Subject | null {
  const mark = el.getAttribute("data-subject") ?? "", at = mark.indexOf(":");
  const kind = mark.slice(0, at), value = mark.slice(at + 1);
  return at > 0 && value && KINDS.includes(kind) ? { kind: kind as SubjectKind, value } : null;
}

/** The subject element nearest to target (itself included), past an inline mark inside another subject; null outside one. */
export function subjectElement(target: EventTarget | null): HTMLElement | null {
  let el = target instanceof Element ? target.closest<HTMLElement>("[data-subject]") : null;
  const outer = el?.hasAttribute("data-subject-inline") ? el.parentElement?.closest<HTMLElement>("[data-subject]") : null;
  if (outer) el = outer;
  return el && subjectOf(el) ? el : null;
}
