/** Focus the page heading (#lede), and follow it while the page swaps its loading heading for the answer, until focus moves
 *  on. Waits for a page that has not rendered yet (a lazy route), and tolerates focus still sitting where it was when called
 *  (the clicked nav tab). Stops after 10 s. Scrolls the heading into view only with scroll (the skip link); a page switch has
 *  already scrolled to the top. Watches the page's <main>, not the whole document. Returns a function that stops following. */
export function focusLede(scroll = false) {
  const from = document.activeElement;
  let at = document.getElementById("lede");
  at?.focus({ preventScroll: !scroll });
  // Watch the page, not the document: the page's <main> (a page swap replaces it, so its parent's children too) and nothing wider.
  let main: Element | null = null;
  const watch = () => {
    const now = document.querySelector("main");
    if (now && now === main) return;
    main = now;
    mo.disconnect();
    if (now) { mo.observe(now, { childList: true, subtree: true }); mo.observe(now.parentElement!, { childList: true }); }
    else mo.observe(document.body, { childList: true, subtree: true }); // no page drawn yet
  };
  const mo = new MutationObserver(() => {
    const a = document.activeElement;
    if (a !== document.body && a !== from && a !== at) { mo.disconnect(); return; }
    watch();
    const now = document.getElementById("lede");
    if (now && now !== at) { at = now; now.focus({ preventScroll: !scroll }); }
  });
  watch();
  const t = setTimeout(() => mo.disconnect(), 10_000);
  return () => { mo.disconnect(); clearTimeout(t); };
}
