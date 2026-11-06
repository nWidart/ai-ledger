import type { ReactNode } from "react";
import { useColors } from "../colors";

/** The project's color dot (grey for "Other" and the long tail). */
export function ProjectDot({ project }: { project: string | null | undefined }) {
  const color = useColors();
  return <i className="pdot" style={{ background: color(project) }} aria-hidden="true" />;
}

/** A project name with its dot, cut with an ellipsis when it does not fit. */
export function ProjectName({ project, children }: { project: string | null | undefined; children?: ReactNode }) {
  return <span className="pname"><ProjectDot project={project} />{children ?? <span>{project}</span>}</span>;
}
