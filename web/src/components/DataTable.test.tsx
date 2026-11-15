import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChartTable, DataTable, ScrollRegion } from "./DataTable";
import { renderApp } from "../testing";

describe("ScrollRegion and DataTable", () => {
  it("makes a scrolling wrapper a focusable, named region", async () => {
    renderApp(<ScrollRegion label="Tools"><p>wide</p></ScrollRegion>);
    const region = screen.getByRole("region", { name: "Tools" });
    expect(region.tabIndex).toBe(0);
    await userEvent.tab();
    expect(document.activeElement).toBe(region);
  });

  it("names the table and its region, with header scopes", () => {
    renderApp(<DataTable name="Cost by project" region="scroll tall"><thead><tr><th scope="col">Project</th><th scope="col">Cost</th></tr></thead>
      <tbody><tr><th scope="row">foo</th><td>$1</td></tr></tbody></DataTable>);
    const region = screen.getByRole("region", { name: "Cost by project" });
    expect(region.className).toBe("scroll tall");
    const table = within(region).getByRole("table", { name: "Cost by project" });
    expect(within(table).getAllByRole("columnheader").map(h => h.getAttribute("scope"))).toEqual(["col", "col"]);
    expect(within(table).getByRole("rowheader", { name: "foo" }).getAttribute("scope")).toBe("row");
  });
});

describe("ChartTable", () => {
  it("is closed, renders nothing while closed, and opens and closes from its button", async () => {
    renderApp(<ChartTable><DataTable name="Chart data"><tbody><tr><td>1</td></tr></tbody></DataTable></ChartTable>);
    const btn = screen.getByRole("button", { name: "Show data table" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("table")).toBeNull();
    await userEvent.click(btn);
    expect(screen.getByRole("button", { name: "Hide data table" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("table", { name: "Chart data" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Hide data table" }));
    expect(screen.queryByRole("table")).toBeNull();
  });
});
