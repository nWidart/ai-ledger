// Measure now on the Project page: the app runs `claude -p "/context"` in the project's latest folder and ingests what it wrote,
// then the Context block refetches its payload to show the new snapshot. The request names only the project: the app picks the
// folder and the model from the store.
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const MEASURE_URL = "/api/context/measure";
export interface MeasureResult { session_id: string; project: string; cwd: string; model: string | null }

/** POSTs the project to measure. A failure throws the app's own message ({"error": …}), else the HTTP status. */
export async function measureContext(project: string): Promise<MeasureResult> {
  const res = await fetch(MEASURE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project }) });
  let body: unknown;
  try { body = await res.json(); } catch { body = undefined; }
  if (!res.ok) {
    const msg = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as MeasureResult;
}

/** Measure now for a project. It stays pending until the context payload has refetched, so the block shows the new snapshot
 *  as the button comes back. measure() does nothing while a run goes (the button stays focusable then, aria-disabled). */
export function useMeasure(project: string) {
  const client = useQueryClient();
  const m = useMutation<MeasureResult, Error, void>({
    mutationKey: ["measure", project],
    // No signal: a run goes to its end.
    mutationFn: () => measureContext(project),
    onSuccess: () => client.invalidateQueries({ queryKey: ["context"] }),
  });
  return {
    measure: () => { if (!m.isPending) m.mutate(); },
    busy: m.isPending,
    error: m.error ? m.error.message : null,
  };
}
