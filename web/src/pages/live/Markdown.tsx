import { compiler, RuleType, type MarkdownToJSX } from "markdown-to-jsx/react";

/** The only places a link may lead: the web and mail. Any other href (a script, data, a path in the app) is dropped. */
const SAFE = /^(?:https?|mailto):/i;
const OUT = { target: "_blank", rel: "noreferrer noopener" } as const;

const OPTIONS: MarkdownToJSX.Options = {
  disableParsingRawHTML: true, // raw HTML in a transcript shows as the text it is
  forceBlock: true,
  wrapper: null,
  sanitizer: value => (SAFE.test(value.trim()) ? value : null),
  overrides: { a: { props: OUT } },
  renderRule(next, node, renderChildren, state) {
    // A heading with no id: many rows share the page, and their headings would share ids.
    if (node.type === RuleType.heading) { const H = `h${node.level}` as const; return <H key={state.key}>{renderChildren(node.children, state)}</H>; }
    // A link the sanitizer dropped keeps its text, as text.
    if (node.type === RuleType.link && node.target == null) return <span key={state.key}>{renderChildren(node.children, state)}</span>;
    // An image is a link to it: the page asks no host for anything a transcript names.
    if (node.type === RuleType.image) {
      const name = node.alt || node.target || "image";
      return node.target == null ? <span key={state.key}>{name}</span> : <a key={state.key} href={node.target} title={node.title} {...OUT}>{name}</a>;
    }
    return next();
  },
};

/** A prompt's or a reply's text as Markdown: GitHub's flavour, tables included, with no raw HTML, no image loaded and
 *  links that open apart from the page. */
export function Markdown({ text }: { text: string }) {
  return <div className="body">{compiler(text, OPTIONS)}</div>;
}
