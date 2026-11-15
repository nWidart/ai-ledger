// The Live key of the query string, typed: view (the wall, view=wall; anything else is the stream). The keys every page shares
// come from validateRoot.

/** The field is present only when valid. A type, not an interface, so a value of it can be given to a page as it is. */
export type LiveSearch = { view?: "wall" };

/** Keeps the valid values of the Live keys. Never throws; any value but "wall" reads as absent. */
export function validateSearch(raw: Readonly<Record<string, unknown>>): LiveSearch {
  const out: LiveSearch = {};
  if (raw.view === "wall") out.view = "wall";
  return out;
}
