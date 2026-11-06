import { describe, expect, test } from "vitest";
import { scaledCoverSize } from "./community-cover-file";

describe("community cover upload sizing", () => {
  test("keeps small originals untouched", () => {
    expect(scaledCoverSize(1200, 675)).toEqual({ height: 675, width: 1200 });
  });

  test("limits the longest edge without cropping or distorting", () => {
    expect(scaledCoverSize(5120, 2880)).toEqual({ height: 1440, width: 2560 });
    expect(scaledCoverSize(2000, 6000)).toEqual({ height: 2560, width: 853 });
  });
});
