// What the Insights page and the session sheet share to show Claude Code's /insights judgments: the model-judged tag, the
// outcome badge's words and tone, and category names. /insights writes free-form snake_case labels; they show with spaces.
import "./facets.css";

const JUDGED_TITLE = "/insights asks a model to read each session's transcript and judge it: these are its opinions, not measurements";
/** The tag every facet figure carries, so nobody reads it as measured. */
export const Judged = () => <span className="judged" title={JUDGED_TITLE}>model-judged</span>;

/** A category name as shown: underscores turned into spaces. The raw name goes in the title. */
export const label = (name: string | null | undefined) => (name ?? "").replace(/_/g, " ");

/** Outcome names as the page words them; an outcome /insights adds later shows under its raw name. */
export const OUTCOME_LABELS: Record<string, string> = {
  fully_achieved: "Fully achieved", mostly_achieved: "Mostly achieved", partially_achieved: "Partially achieved",
  not_achieved: "Not achieved", unclear_from_transcript: "Unclear",
};
export const outcomeLabel = (o: string | null) => (o == null ? "–" : OUTCOME_LABELS[o] ?? o);
/** The badge tone of an outcome: met, part met, not met, or neither. */
export const outcomeTone = (o: string | null) =>
  o === "fully_achieved" || o === "mostly_achieved" ? "full" : o === "partially_achieved" ? "part" : o === "not_achieved" ? "not" : "other";
