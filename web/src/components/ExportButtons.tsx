import { useEffect, useState } from "react";
import { copyText, download, toCsv, toTsv, type Cell } from "./export";

/** What a file name says it holds, for the buttons' spoken names (the space before it is outside the hidden span, which some engines trim): "ai-ledger-cost-projects-2026-11-14.csv" is "cost projects". */
const whatOf = (name: string) => name.replace(/^ai-ledger-/, "").replace(/(-\d{4}-\d{2}-\d{2})?\.csv$/, "").replace(/-/g, " ") || name;

/** Download CSV and Copy buttons for a table's rows as shown; Copy puts the tab-separated form on the clipboard. */
export function ExportButtons({ name, headers, rows }: { name: string; headers: string[]; rows: Cell[][] }) {
  const [state, setState] = useState<"" | "copied" | "failed">("");
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(""), 2000);
    return () => clearTimeout(t);
  }, [state]);
  const what = whatOf(name);
  const copy = async () => setState(await copyText(toTsv(headers, rows)) ? "copied" : "failed");
  return <>
    <button type="button" className="linkish" onClick={() => download(name, toCsv(headers, rows))}>Download CSV{" "}<span className="sr">{what}</span></button>
    <button type="button" className="linkish" onClick={copy}>{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}{" "}<span className="sr">{what}</span></button>
    <span className="sr" aria-live="polite">{state === "copied" ? "Copied to clipboard." : state === "failed" ? "Could not copy to clipboard." : ""}</span>
  </>;
}
