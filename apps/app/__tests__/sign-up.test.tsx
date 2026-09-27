import { getSignUpErrorState } from "@repo/auth/components/sign-up";
import { expect, test } from "vitest";

test("translates an existing-account response into a useful next step", () => {
  const result = getSignUpErrorState({
    errors: [{ code: "form_identifier_exists" }],
  });

  expect(result).toEqual({
    existingAccount: true,
    message: "Este e-mail já está associado a uma conta. Entre por aqui.",
  });
});

test("keeps verification and password errors in Portuguese", () => {
  expect(
    getSignUpErrorState({
      errors: [{ message: "The verification code is incorrect" }],
    }).message
  ).toBe("O código informado está incorreto. Confira e tente novamente.");
  expect(
    getSignUpErrorState({
      errors: [{ message: "Password is too short" }],
    }).message
  ).toContain("senha mais forte");
});
