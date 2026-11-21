import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChartTable, DataTable } from "./DataTable";
import { renderApp } from "../testing";

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
