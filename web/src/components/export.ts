// Table export: CSV and tab-separated text from the rows a table shows, a file download and a clipboard copy.

/** One cell: text, a number, or null for an empty cell. */
export type Cell = string | number | null;

const pad = (n: number) => String(n).padStart(2, "0");
/** Today's local date as YYYY-MM-DD, for file names. */
export const dayStamp = (d = new Date()): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A text cell with a leading quote when a spreadsheet would read it as a formula (numbers are never guarded). */
const guard = (s: string): string => (/^[=+\-@]/.test(s) ? `'${s}` : s);
/** A cell's plain text: empty for null or a non-finite number, numbers without separators, text guarded against formulas. */
const text = (v: Cell): string => (v == null || (typeof v === "number" && !Number.isFinite(v)) ? "" : typeof v === "number" ? String(v) : guard(v));

/** RFC 4180 CSV of headers and rows: CRLF line ends, quotes around cells with commas, quotes, or line breaks. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const cell = (v: Cell) => {
    const s = text(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(r => r.map(cell).join(",") + "\r\n").join("");
}

/** Tab-separated text of headers and rows, for a spreadsheet paste: LF line ends, tabs and line breaks in a cell become spaces. */
export function toTsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map(r => r.map(v => text(v).replace(/[\t\r\n]/g, " ")).join("\t") + "\n").join("");
}

/** Saves text as a file named name, through a temporary object URL and link. */
export function download(name: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Puts text on the clipboard; false when the clipboard is missing or refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
