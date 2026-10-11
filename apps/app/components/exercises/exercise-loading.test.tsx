import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExerciseLoading } from "./exercise-loading";

afterEach(cleanup);

test("reserves the fixed mobile headers while session and result load", () => {
  const session = render(<ExerciseLoading variant="session" />);
  expect(screen.getByRole("main").className).toContain("pt-[140px]");
  session.unmount();

  render(<ExerciseLoading variant="result" />);
  expect(screen.getByRole("main").className).toContain("pt-[68px]");
});
