import { render, screen } from "@testing-library/react";
import Page from "../app/page";
import { describe, expect, test } from "vitest";

describe("Landing Page", () => {
  test("renders the header", () => {
    render(<Page />);
    const part1 = screen.getByText("The Streaming Platform");
    const part2 = screen.getByText("For Everyone.");
    expect(part1).toBeInTheDocument();
    expect(part2).toBeInTheDocument();
  });

  test("renders the subtitle", () => {
    render(<Page />);
    const subtitle = screen.getByText(
      "The best way to watch your favorite movies and TV shows. Anywhere, anytime. And, yes—no subscription/sign-up is required.",
    );
    expect(subtitle).toBeInTheDocument();
  });

  test("renders the two buttons", () => {
    render(<Page />);
    const button1 = screen.getByText("Get Started");
    const button2 = screen.getByText((_content, element) => {
      return (
        element?.tagName.toLowerCase() === "a" &&
        element.getAttribute("href") === "https://github.com/nyumat/nyumatflix"
      );
    });
    expect(button1).toBeInTheDocument();
    expect(button2).toBeInTheDocument();
  });

  test("renders the preview image", () => {
    render(<Page />);
    const image = screen.getByAltText("NyumatFlix Platform");
    expect(image).toBeInTheDocument();
  });
});
