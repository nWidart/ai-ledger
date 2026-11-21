import type { ComponentProps, ReactNode } from "react";
import { DOCS, docsUrl, type DocsKey } from "../docs";

/** Where a docs link goes, in words: "Cost page documentation", "How cost is estimated documentation". */
const destination = (key: DocsKey): string =>
  key === "home" ? "AI Ledger documentation" : key.startsWith("pages/") ? `${DOCS[key].title} page documentation` : `${DOCS[key].title} documentation`;

type Props = Omit<ComponentProps<"a">, "href" | "target" | "rel" | "children" | "aria-label" | "aria-labelledby"> & {
  docs: DocsKey;
  /** The visible text. The accessible name starts with it, so speech input can say it. */
  children: ReactNode;
};

/** A link to a documentation page, opened in a new tab. A plain anchor, not a router Link: it starts no intent preload,
 *  and the first request to the docs site is the navigation the user starts. noreferrer implies noopener. The name adds
 *  where it goes and that it opens a new tab, in a visually hidden suffix: "Docs, Cost page documentation, opens in a
 *  new tab". */
export function DocsLink({ docs, children, ...rest }: Props) {
  return (
    <a {...rest} href={docsUrl(docs)} target="_blank" rel="noreferrer">
      {children}<span className="sr">, {destination(docs)}, opens in a new tab</span>
    </a>
  );
}
