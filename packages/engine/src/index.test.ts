import { describe, expect, it } from "vitest";

import hello from "./index.js";

describe("hello", () => {
  it("returns the engine greeting", () => {
    expect(hello()).toBe("Hello from Engine!");
  });
});
