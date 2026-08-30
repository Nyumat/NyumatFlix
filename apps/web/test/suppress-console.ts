import { vi, type MockInstance } from "vitest";

type ConsoleLevel = "log" | "warn" | "error";

export const suppressConsole = (...levels: ConsoleLevel[]): (() => void) => {
  const spies: MockInstance[] = levels.map((level) =>
    vi.spyOn(console, level).mockImplementation(() => undefined),
  );

  return () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };
};
