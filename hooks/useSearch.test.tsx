import { renderHook } from "@testing-library/react";
// import { act } from "react-dom/test-utils";

import useSearch from "./useSearch";

jest.mock("axios"); // Mock the entire axios module

describe("useSearch", () => {
  it("should return search nothing when search is empty", async () => {
    const { result } = renderHook(() => useSearch({ search: "" }));
    console.log(result.current, "result");
    expect(result.current.searchData).toEqual([]);
  });
});
