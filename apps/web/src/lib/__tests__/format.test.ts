import { describe, expect, it } from "vitest";
import { formatBytes, formatCount } from "../format";

describe("formatCount", () => {
  it("uses Indian digit grouping (docs/CONTEXT.md §13)", () => {
    expect(formatCount(1204)).toBe("1,204");
    expect(formatCount(182040)).toBe("1,82,040");
  });
});

describe("formatBytes", () => {
  it("picks the right unit", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(21 * 1024 ** 3)).toBe("21 GB");
  });
});
