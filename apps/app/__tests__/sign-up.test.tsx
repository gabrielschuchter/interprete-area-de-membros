import { getSignUpErrorState } from "@repo/auth/components/sign-up";
import { expect, test } from "vitest";

test("does not reveal whether an account already exists", () => {
  const result = getSignUpErrorState({
    errors: [{ code: "form_identifier_exists" }],
  });

  expect(result).toEqual({
    existingAccount: false,
    message:
      "Não foi possível criar sua conta. Confira os dados e tente novamente.",
  });
});

test("maps verification and the active Clerk password policy", () => {
  expect(
    getSignUpErrorState({
      errors: [{ code: "verification_code_incorrect" }],
    }).message
  ).toBe(
    "O código informado está incorreto ou expirou. Confira e tente novamente."
  );

  expect(
    getSignUpErrorState({
      errors: [
        {
          code: "form_password_length_too_short",
          message: "Password must be at least 15 characters",
        },
      ],
    }).message
  ).toBe(
    "A senha precisa ter pelo menos 15 caracteres, conforme os requisitos da conta."
  );

  expect(
    getSignUpErrorState({
      errors: [{ code: "form_password_not_strong_enough" }],
    }).message
  ).toBe(
    "A senha não atende aos requisitos de segurança da conta. Escolha outra senha e tente novamente."
  );
});

test("does not surface arbitrary Clerk messages or stack details", () => {
  expect(
    getSignUpErrorState({
      errors: [
        {
          code: "internal_error",
          message: "private database diagnostic secret-value",
        },
      ],
      stack: "private implementation stack",
    }).message
  ).toBe(
    "Não foi possível criar sua conta. Confira os dados e tente novamente."
  );
});
