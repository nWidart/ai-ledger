import type { ComponentProps } from "react";
import { compiler, RuleType, type MarkdownToJSX } from "markdown-to-jsx/react";

/** The only places a link may lead: the web and mail. Any other href (a script, data, a path in the app) is dropped. */
const SAFE = /^(?:https?|mailto):/i;
const safe = (href: string | null | undefined) => (href != null && SAFE.test(href.trim()) ? href.trim() : undefined);
const OUT = { target: "_blank", rel: "noreferrer noopener" } as const;

/** A link that opens apart from the page; one whose href was dropped keeps its text, as text. */
function A({ href, children, title }: ComponentProps<"a">) {
  return href ? <a href={href} title={title} {...OUT}>{children}</a> : <span>{children}</span>;
}

const OPTIONS: MarkdownToJSX.Options = {
  disableParsingRawHTML: true, // raw HTML in a transcript shows as the text it is
  forceBlock: true,
  wrapper: null,
  sanitizer: value => safe(value) ?? null,
  overrides: {
    a: { component: A },
    // A footnote's body comes in a div of its own, whose id would repeat across the rows that share the page: none.
    div: { component: (props: ComponentProps<"div">) => <div {...props} id={undefined} /> },
  },
  renderRule(next, node, renderChildren, state) {
    // A heading with no id, as many rows share the page, two levels down, so a reply's # is no heading of the page's.
    if (node.type === RuleType.heading) {
      const H = `h${Math.min(6, node.level + 2)}` as "h3";
      return <H key={state.key}>{renderChildren(node.children, state)}</H>;
    }
    // A link renders its text knowing it is inside one, so an image there adds no link of its own.
    if (node.type === RuleType.link) {
      return <A key={state.key} href={safe(node.target)} title={node.title}>{renderChildren(node.children, { ...state, inAnchor: true })}</A>;
    }
    // An image is a link to it, or its name inside a link: the page asks no host for anything a transcript names.
    if (node.type === RuleType.image) {
      const name = node.alt || node.target || "image";
      return state.inAnchor ? <span key={state.key}>{name}</span> : <A key={state.key} href={safe(node.target)} title={node.title}>{name}</A>;
    }
    // A footnote reference is its mark as text: a link to the footnote would lead to one of any row's.
    if (node.type === RuleType.footnoteReference) return <sup key={state.key}>{node.text}</sup>;
    return next();
  },
};

/** A prompt's or a reply's text as Markdown: GitHub's flavour, tables included, with no raw HTML, no image loaded and
 *  links that open apart from the page. */
export function Markdown({ text }: { text: string }) {
  return <div className="body">{compiler(text, OPTIONS)}</div>;
}
