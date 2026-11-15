import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { makeTestClient, renderApp } from "./testing";

const seen: unknown[] = [];
const Probe = ({ n = 0 }: { n?: number }) => { const c = useQueryClient(); useEffect(() => { seen.push(c); }); return <p>{n}</p>; };

describe("makeTestClient", () => {
  it("turns garbage collection off and keeps the app's other defaults", () => {
    const q = makeTestClient().getDefaultOptions().queries;
    expect(q).toMatchObject({ gcTime: Infinity, staleTime: Infinity, retry: false, networkMode: "always" });
  });
});

describe("renderApp", () => {
  it("gives the component the returned client, and rerender keeps it", () => {
    const { client, rerender } = renderApp(<Probe />);
    seen.length = 0;
    rerender(<Probe n={1} />);
    expect(seen).toEqual([client]);
    expect(seen[0]).toBe(client);
  });

  it("gives each call its own client", () => {
    const a = renderApp(<Probe />).client, b = renderApp(<Probe />).client;
    expect(a).not.toBe(b);
  });
});
