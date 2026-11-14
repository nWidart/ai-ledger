/** Focus the page heading (#lede), and follow it while the page swaps its loading heading for the answer, until focus moves
 *  on. Waits for a page that has not rendered yet (a lazy route), and tolerates focus still sitting where it was when called
 *  (the clicked nav tab). Stops after 10 s. Scrolls the heading into view only with scroll (the skip link); a page switch has
 *  already scrolled to the top. Returns a function that stops following. */
export function focusLede(scroll = false) {
  const from = document.activeElement;
  let at = document.getElementById("lede");
  at?.focus({ preventScroll: !scroll });
  const mo = new MutationObserver(() => {
    const a = document.activeElement;
    if (a !== document.body && a !== from && a !== at) { mo.disconnect(); return; }
    const now = document.getElementById("lede");
    if (now && now !== at) { at = now; now.focus({ preventScroll: !scroll }); }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  const t = setTimeout(() => mo.disconnect(), 10_000);
  return () => { mo.disconnect(); clearTimeout(t); };
}
