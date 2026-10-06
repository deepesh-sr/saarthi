// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Span } from "@saarthi/core";
import { TraceView } from "./TraceView";

afterEach(cleanup);

function span(partial: Partial<Span> & { id: string; name: string }): Span {
  return {
    parentId: null,
    file: "f.ts",
    line: 1,
    start: 0,
    end: 10,
    selfMs: 10,
    status: "done",
    calls: 1,
    error: null,
    blockedOn: null,
    ...partial,
  };
}

const spans: Span[] = [
  span({ id: "root", name: "handleSignup", start: 0, end: 100, selfMs: 0.5 }),
  span({ id: "hash", name: "hashPassword", parentId: "root", start: 10, end: 60, selfMs: 40 }),
  span({ id: "validate", name: "validate", parentId: "root", start: 1, end: 3, selfMs: 2 }),
  span({
    id: "boom",
    name: "boom",
    parentId: "root",
    start: 70,
    end: 72,
    selfMs: 2,
    status: "failed",
    error: { name: "Error", message: "x", caught: false },
  }),
];

function rowIds(): string[] {
  return screen
    .getAllByTestId("sidebar-row")
    .map((element) => element.getAttribute("data-span-id")!);
}

function box(id: string): HTMLElement {
  return screen
    .getAllByTestId("waterfall-box")
    .find((element) => element.getAttribute("data-span-id") === id)!;
}

function row(id: string): HTMLElement {
  return screen
    .getAllByTestId("sidebar-row")
    .find((element) => element.getAttribute("data-span-id") === id)!;
}

describe("TraceView", () => {
  it("defaults to self-time sort and ranks the lagging leaf first", () => {
    render(<TraceView spans={spans} />);
    expect(rowIds()[0]).toBe("hash");
  });

  it("sorts by total time when asked", () => {
    render(<TraceView spans={spans} />);
    fireEvent.click(screen.getByRole("button", { name: "total" }));
    expect(rowIds()[0]).toBe("root");
  });

  it("shows a bottleneck banner naming the lagging function with a percentage", () => {
    render(<TraceView spans={spans} />);
    const banner = screen.getByTestId("bottleneck");
    expect(banner.textContent).toContain("hashPassword");
    expect(banner.textContent).toContain("40%");
  });

  it("selects the matching waterfall box when a sidebar row is clicked", () => {
    render(<TraceView spans={spans} />);
    fireEvent.click(row("hash"));
    expect(row("hash").getAttribute("data-selected")).toBe("true");
    expect(box("hash").getAttribute("data-selected")).toBe("true");
  });

  it("selects the matching sidebar row when a waterfall box is clicked", () => {
    render(<TraceView spans={spans} />);
    fireEvent.click(box("validate"));
    expect(box("validate").getAttribute("data-selected")).toBe("true");
    expect(row("validate").getAttribute("data-selected")).toBe("true");
  });

  it("filters to failed spans", () => {
    render(<TraceView spans={spans} />);
    fireEvent.click(screen.getByRole("button", { name: "failed" }));
    expect(rowIds()).toEqual(["boom"]);
  });

  it("filters to slow spans by self-time threshold", () => {
    render(<TraceView spans={spans} />);
    fireEvent.click(screen.getByRole("button", { name: "slow" }));
    expect(rowIds()).toEqual(["hash"]);
  });

  it("searches rows by name", () => {
    render(<TraceView spans={spans} />);
    fireEvent.change(screen.getByPlaceholderText("search function…"), {
      target: { value: "hash" },
    });
    expect(rowIds()).toEqual(["hash"]);
  });
});
