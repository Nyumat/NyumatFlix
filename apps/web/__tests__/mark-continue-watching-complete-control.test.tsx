import { MarkContinueWatchingCompleteControl } from "@/components/home/mark-continue-watching-complete-control";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

describe("MarkContinueWatchingCompleteControl", () => {
  test("opens a confirmation popover and calls onConfirm on Yes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <MarkContinueWatchingCompleteControl
        title="Dune"
        onConfirm={onConfirm}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Mark Dune as complete" }),
    );

    expect(screen.getByText("Mark as complete?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Mark as complete?")).not.toBeInTheDocument();
  });

  test("closes without confirming when No is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <MarkContinueWatchingCompleteControl
        title="Dune"
        onConfirm={onConfirm}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Mark Dune as complete" }),
    );
    await user.click(screen.getByRole("button", { name: "No" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText("Mark as complete?")).not.toBeInTheDocument();
  });

  test("disables Yes and No while pending", async () => {
    const user = userEvent.setup();

    render(
      <MarkContinueWatchingCompleteControl
        title="Dune"
        isPending
        onConfirm={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Mark Dune as complete" }),
    );

    expect(screen.getByRole("button", { name: "Yes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No" })).toBeDisabled();
  });

  test("stops pointerdown from reaching a parent handler", () => {
    const onParentPointerDown = vi.fn();

    render(
      <div onPointerDown={onParentPointerDown}>
        <MarkContinueWatchingCompleteControl title="Dune" onConfirm={vi.fn()} />
      </div>,
    );

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Mark Dune as complete" }),
    );

    expect(onParentPointerDown).not.toHaveBeenCalled();
  });
});
