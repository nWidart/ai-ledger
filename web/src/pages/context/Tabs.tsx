// Context's tabs, as the WAI-ARIA tabs pattern: a tablist of tabs with a roving tab stop, arrow keys, Home and End moving the
// selection (automatic activation: the panels draw from the payload already loaded), and one tabpanel, the selected one's.
import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef<T extends string> { id: T; label: string }

export function Tabs<T extends string>({ tabs, current, onChange, label, children }: {
  tabs: readonly TabDef<T>[]; current: T; onChange: (id: T) => void; label: string; children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const onKey = (ev: KeyboardEvent) => {
    const i = tabs.findIndex(t => t.id === current), n = tabs.length;
    const next = ({ ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 } as Record<string, number>)[ev.key];
    if (next == null) return;
    ev.preventDefault();
    onChange(tabs[next]!.id);
    list.current?.querySelector<HTMLElement>(`#ctab-${tabs[next]!.id}`)?.focus();
  };
  return (
    <div className="ctx-tabs">
      <div className="tablist" role="tablist" aria-label={label} ref={list} onKeyDown={onKey}>
        {tabs.map(t => {
          const on = t.id === current;
          return <button key={t.id} type="button" role="tab" id={`ctab-${t.id}`} aria-selected={on} tabIndex={on ? 0 : -1}
            aria-controls={on ? `cpanel-${t.id}` : undefined} onClick={() => onChange(t.id)}>{t.label}</button>;
        })}
      </div>
      <div className="tabpanel" role="tabpanel" id={`cpanel-${current}`} aria-labelledby={`ctab-${current}`} tabIndex={0}>{children}</div>
    </div>
  );
}
