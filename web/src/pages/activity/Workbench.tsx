// Overview's workbench: its tables as WAI-ARIA tabs. A tablist with a roving tab stop, where Left and Right (wrapping), Home and
// End move the focus and Enter or Space activates: manual activation, since activating fetches the Sessions list and writes the
// URL. Only the selected panel renders its content; the others stay empty and hidden, so every tab's aria-controls names a panel.
// The selected panel is the next tab stop after the tablist, as in the pattern and on Context's tabs.
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { modified } from "../../components/keys";
import { TABS, type WorkTab } from "./search";

export const TAB_LABEL: Record<WorkTab, string> = { sessions: "Sessions", projects: "Projects", tools: "Tools and MCP", loops: "Loops and tests" };
export const tabId = (t: WorkTab) => `wb-tab-${t}`;
export const panelId = (t: WorkTab) => `wb-panel-${t}`;

/** tab: the selected tab; note: a line over the panel (the days a selection shows); children: the selected tab's content. */
export function Workbench({ tab, onTab, note, children }: { tab: WorkTab; onTab: (t: WorkTab) => void; note?: ReactNode; children: ReactNode }) {
  // The tab that holds the tab stop: the selected one, until the arrow keys move it. Kept as state set while rendering,
  // so a tab chosen elsewhere (a vital, the URL) takes the stop back.
  const [stop, setStop] = useState(tab), [was, setWas] = useState(tab);
  if (was !== tab) { setWas(tab); setStop(tab); }
  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return; // Alt+Left is history: not ours
    const i = TABS.indexOf(stop), n = TABS.length;
    const next = ({ ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 } as Record<string, number>)[ev.key];
    if (next == null) return;
    ev.preventDefault();
    setStop(TABS[next]!);
    document.getElementById(tabId(TABS[next]!))?.focus();
  };
  return (
    <div className="workbench sect" id="workbench">
      <div className="tablist" role="tablist" aria-label="Activity detail" onKeyDown={onKey}>
        {TABS.map(t => <button key={t} type="button" role="tab" id={tabId(t)} aria-selected={t === tab} aria-controls={panelId(t)}
          tabIndex={t === stop ? 0 : -1} onFocus={() => setStop(t)} onClick={() => onTab(t)}>
          {TAB_LABEL[t]}</button>)}
      </div>
      {TABS.map(t => t === tab
        ? <div key={t} className="tabpanel" role="tabpanel" id={panelId(t)} aria-labelledby={tabId(t)} tabIndex={0}>{note}{children}</div>
        : <div key={t} className="tabpanel" role="tabpanel" id={panelId(t)} aria-labelledby={tabId(t)} hidden />)}
    </div>
  );
}
