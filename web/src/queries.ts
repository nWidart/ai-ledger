// One queryOptions() per endpoint: its key, URL and payload type in one place. Keys are [resource, ...parts] and the View
// is one part (Query hashes object keys whatever their order), built from its four fields only so an object with extra
// fields keys the same. The Live queries and the infinite sessions list are added by the phases that use them.
import { queryOptions } from "@tanstack/react-query";
import {
  contextUrl, dayUrl, errorMarksUrl, errorUrl, errorsUrl, getJson, insightsUrl, limitsUrl, limitWindowUrl, paletteUrl, promptUrl,
  sessionUrl, sessionsUrl, statusUrl, toolUrl, usageUrl,
  type ContextPayload, type Day, type DayView, type ErrorDetail, type ErrorsPayload, type InsightsPayload, type LimitHistoryRow,
  type LimitsPayload, type LimitWindowCurve, type PalettePayload, type SessionDetail, type SessionsPage, type Status, type ToolKind,
  type ToolPayload, type UsagePayload, type View,
} from "./api";
import type { Marks } from "./pages/errors/model";

const view = (v: View): View => ({ project: v.project, range: v.range, automated: v.automated, source: v.source });
const get = <T,>(url: string, init?: RequestInit) => ({ signal }: { signal: AbortSignal }) => getJson<T>(url, { ...init, signal });

export const queries = {
  status: queryOptions({
    queryKey: ["status"],
    queryFn: get<Status>(statusUrl, { priority: "low" }), // a background poll never delays the page's own requests
    staleTime: 0,
    refetchInterval: q => (q.state.data?.ingesting ? 3_000 : 60_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  }),
  usage: (v: View, session = "") => queryOptions({ queryKey: ["usage", view(v), session], queryFn: get<UsagePayload>(usageUrl(v, session)) }),
  day: (v: View, day: Day) => queryOptions({ queryKey: ["day", view(v), day], queryFn: get<DayView>(dayUrl(v, day)) }),
  sessions: (v: View, opts: Parameters<typeof sessionsUrl>[1] = {}) =>
    queryOptions({ queryKey: ["sessions", view(v), opts], queryFn: get<SessionsPage>(sessionsUrl(v, opts)) }),
  session: (id: string) => queryOptions({ queryKey: ["session", id], queryFn: get<SessionDetail>(sessionUrl(id)) }),
  prompt: (id: string) => queryOptions({ queryKey: ["prompt", id], queryFn: get<{ text: string }>(promptUrl(id)) }),
  tool: (kind: ToolKind, name: string, v: View) =>
    queryOptions({ queryKey: ["tool", kind, name, view(v)], queryFn: get<ToolPayload>(toolUrl(kind, name, v)) }),
  palette: (v: View) => queryOptions({ queryKey: ["palette", view(v)], queryFn: get<PalettePayload>(paletteUrl(v)) }),
  // The limits page ignores `automated`, so a toggle of it does not refetch.
  limits: (v: View) =>
    queryOptions({ queryKey: ["limits", { project: v.project, range: v.range, source: v.source }], queryFn: get<LimitsPayload>(limitsUrl(v)) }),
  limitWindow: (h: Pick<LimitHistoryRow, "provider" | "limit_id" | "scope" | "start">) =>
    queryOptions({
      queryKey: ["limits", "window", { provider: h.provider, limit_id: h.limit_id, scope: h.scope, start: h.start }],
      queryFn: get<LimitWindowCurve>(limitWindowUrl(h)),
    }),
  insights: (v: View) => queryOptions({ queryKey: ["insights", view(v)], queryFn: get<InsightsPayload>(insightsUrl(v)) }),
  context: (v: View) => queryOptions({ queryKey: ["context", view(v)], queryFn: get<ContextPayload>(contextUrl(v)) }),
  errors: queryOptions({ queryKey: ["errors"], queryFn: get<ErrorsPayload>(errorsUrl) }),
  errorMarks: queryOptions({ queryKey: ["errors", "marks"], queryFn: get<Marks>(errorMarksUrl) }),
  // A failed call's text does not change, so a sheet reopened later needs no refetch even after an ingest.
  errorDetail: (id: string) => queryOptions({ queryKey: ["errors", "detail", id], queryFn: get<ErrorDetail>(errorUrl(id)), staleTime: Infinity }),
};

/** What an ingest or Refresh invalidates: status is the watcher's own input, Live follows its own notices, and a failed
 *  call's full text never changes. */
export const isData = ({ queryKey: k }: { queryKey: readonly unknown[] }) =>
  k[0] !== "status" && k[0] !== "live" && !(k[0] === "errors" && k[1] === "detail");
