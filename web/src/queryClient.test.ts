import { describe, expect, it } from "vitest";
import { makeQueryClient } from "./queryClient";

describe("makeQueryClient", () => {
  it("sets the query and mutation defaults", () => {
    const defaults = makeQueryClient().getDefaultOptions();
    expect(defaults.queries).toMatchObject({
      staleTime: Infinity,
      gcTime: 5 * 60_000,
      retry: false,
      networkMode: "always",
      refetchOnReconnect: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false, networkMode: "always" });
  });
});
