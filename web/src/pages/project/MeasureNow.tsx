// Measure now in the Context block: what a run does, the button, and the run's failure. The figures stay while it runs and after
// it fails; on success the block refetches and draws the new snapshot.
import { useMeasure } from "./measure";

export function MeasureNow({ project }: { project: string }) {
  const { measure, busy, error } = useMeasure(project);
  return (
    <div className="cg-measure">
      <button type="button" className="btn" onClick={measure} aria-disabled={busy || undefined} aria-busy={busy || undefined} aria-describedby="cgMeasureNote">
        {busy ? "Measuring…" : "Measure now"}
      </button>
      <p className="muted" id="cgMeasureNote">Runs <code>claude -p "/context"</code> in the project's latest folder. Starts its MCP servers and hooks like a new session; calls no model.</p>
      {error && <p className="cg-error" role="alert">Could not measure: {error}</p>}
    </div>
  );
}
