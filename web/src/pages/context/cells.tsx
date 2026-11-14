// Table cells the Context sections share.
import { ProjectName } from "../../components/ProjectDot";
import { SOURCE_LABELS } from "../../components/Filters";
import type { Source } from "../../api";
import { EST_TITLE } from "./context";
import { num } from "../../format";

/** A project with its dot; a session with no project reads "(no project)". With `button`, the name is a native button,
 *  the keyboard target of a row that opens the project's sheet. */
export const Proj = ({ project, button }: { project: string | null; button?: boolean }) =>
  <ProjectName project={project}>{project == null ? <span className="muted">(no project)</span>
    : button ? <button type="button" className="cellbtn" title={project}>{project}</button> : project}</ProjectName>;

/** An agent by its name, for a session's own row (a figure over every source never names one). */
export const SourceName = ({ source }: { source: Source }) => <>{SOURCE_LABELS[source]}</>;

/** An estimated token count from result bytes, always carrying its badge. */
export const Est = ({ tokens }: { tokens: number }) =>
  <>≈{num(tokens)} <span className="chip est" title={EST_TITLE}>estimate</span></>;
