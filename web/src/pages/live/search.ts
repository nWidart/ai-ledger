// The Live keys of the query string, typed: view (the wall, view=wall; anything else is the stream) and pin (the Wall's
// pinned sessions, oldest first: pin=a,b). The keys every page shares come from validateRoot.

/** The Wall's pins at most. */
export const MAX_PINS = 2;
/** A session id as the URL may carry one: no comma, which joins the pins. */
const ID = /^[\w.:-]{1,128}$/;

/** The fields are present only when valid. A type, not an interface, so a value of it can be given to a page as it is. */
export type LiveSearch = { view?: "wall"; pin?: string };

/** The pins a pin value names, oldest first: valid ids, each once, the newest MAX_PINS. */
export const pinsOf = (pin: string | undefined): string[] =>
  [...new Set((pin ?? "").split(",").map(s => s.trim()).filter(s => ID.test(s)))].slice(-MAX_PINS);

/** Keeps the valid values of the Live keys. Never throws; any view but "wall" reads as absent, and a pin value with no
 *  valid id too. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): LiveSearch {
  const out: LiveSearch = {};
  if (raw.view === "wall") out.view = "wall";
  const pins = typeof raw.pin === "string" ? pinsOf(raw.pin) : [];
  if (pins.length) out.pin = pins.join(",");
  return out;
}
