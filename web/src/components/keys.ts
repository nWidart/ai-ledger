/** The modifier keys a key event can carry, as React's and the DOM's events both do. */
interface Mods { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }

/** True when a key comes with a modifier, so the page's own arrow, Home, End, Enter and Escape keys leave it to the browser:
 *  Alt+Left goes back in history, Ctrl+Home to the page top, Shift+Space scrolls up. Every chart and tab list that reads keys
 *  checks this first. shift: the handler gives Shift a meaning of its own (the session timeline's longer step), so only Alt,
 *  Ctrl and Meta count. */
export const modified = (ev: Mods, shift = false): boolean => ev.altKey || ev.ctrlKey || ev.metaKey || (!shift && ev.shiftKey);
