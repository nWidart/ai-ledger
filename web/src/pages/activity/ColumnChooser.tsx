import { useState } from "react";
import { Popover } from "@base-ui/react/popover";

/** A column the list offers: shown, whether it shows in the window now. */
export interface ChoiceItem<K extends string> { id: K; label: string; shown: boolean }

/** The Sessions table's Columns button: a non-modal dialog named "Columns" with one native checkbox per column, in the table's
 *  order, then Reset columns. Base UI moves focus into the list on open; Escape and a click outside close it and return focus to
 *  the button. The list stays open while boxes change. The popup renders inside the button's wrapper, so the page CSS reaches it,
 *  and Base UI places it with fixed positioning inside the viewport. hidden: how many columns the user hid, for the button. */
export function ColumnChooser<K extends string>({ items, hidden, onChange, onReset }: {
  items: readonly ChoiceItem<K>[]; hidden: number; onChange: (id: K, shown: boolean) => void; onReset: () => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return <div className="cols" ref={setHost}>
    <Popover.Root>
      <Popover.Trigger className="cols-btn">Columns{hidden ? `, ${hidden} hidden` : ""}</Popover.Trigger>
      {/* Base UI waits while the container is null, so the popup mounts once the wrapper does. */}
      {host && <Popover.Portal container={host}>
        <Popover.Positioner className="cols-pos" side="bottom" align="start" sideOffset={6} collisionPadding={8} positionMethod="fixed">
          <Popover.Popup className="cols-pop" aria-label="Columns">
            {items.map(c => <label key={c.id} className="chk"><input type="checkbox" checked={c.shown} onChange={e => onChange(c.id, e.target.checked)} /> {c.label}</label>)}
            <button type="button" className="linkish" onClick={onReset}>Reset columns</button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>}
    </Popover.Root>
  </div>;
}
