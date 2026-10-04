import {
  getPasswordRecoveryErrorState,
  getSignInErrorState,
  isActiveClerkSessionError,
} from "@repo/auth/components/sign-in-errors";
import {
  getAuthCompletionPath,
  getAuthRedirectPath,
  getSafeInternalPath,
  getSessionTaskPath,
  getSignInPath,
} from "@repo/auth/redirects";
import { expect, test } from "vitest";

test("preserves a same-origin destination and its query after auth", () => {
  expect(
    getAuthRedirectPath(
      "https://app.example/sign-in?redirect_url=https%3A%2F%2Fapp.example%2Faprender%3Fcontinue%3D42"
    )
  ).toBe("/aprender?continue=42");
});

test("rejects external and authentication-loop destinations", () => {
  expect(
    getAuthRedirectPath(
      "https://app.example/sign-in?redirect_url=https%3A%2F%2Fevil.example%2Fsteal"
    )
  ).toBe("/");
  expect(
    getSafeInternalPath("//evil.example/path", "https://app.example")
  ).toBe("/");
  expect(
    getSafeInternalPath(
      "/session-tasks?redirect_url=%2F",
      "https://app.example"
    )
  ).toBe("/");
  expect(
    getSafeInternalPath("/sign-in?redirect_url=%2F", "https://app.example")
  ).toBe("/");
});

test("sends pending sessions to a task route that retains the safe destination", () => {
  const taskPath = getAuthCompletionPath(
    "https://app.example/sign-in?redirect_url=%2Fadmin%2Fmembers%3Fpage%3D2",
    "setup-mfa"
  );

  expect(taskPath).toBe(
    "/session-tasks?redirect_url=%2Fadmin%2Fmembers%3Fpage%3D2"
  );
  expect(getSessionTaskPath("/")).toBe("/session-tasks?redirect_url=%2F");
  expect(getSignInPath("/aprender?tab=recentes")).toBe(
    "/sign-in?redirect_url=%2Faprender%3Ftab%3Drecentes"
  );
  expect(getSignInPath("https://evil.example/path")).toBe(
    "/sign-in?redirect_url=%2F"
  );
});

test("uses the same sign-in error for unknown accounts and wrong passwords", () => {
  const unknownAccount = getSignInErrorState({
    errors: [{ code: "form_identifier_not_found" }],
  });
  const wrongPassword = getSignInErrorState({
    errors: [{ code: "form_password_incorrect" }],
  });

  expect(unknownAccount).toEqual(wrongPassword);
  expect(unknownAccount.message).toBe(
    "E-mail ou telefone e senha não correspondem. Confira os dados e tente novamente."
  );
});

test("keeps recovery account-neutral and separates session errors from credentials", () => {
  expect(
    getPasswordRecoveryErrorState({
      errors: [{ code: "form_identifier_not_found" }],
    }).message
  ).toBe(
    "Se houver uma conta com esses dados, enviaremos um código de recuperação."
  );
  expect(
    isActiveClerkSessionError({ errors: [{ code: "session_exists" }] })
  ).toBe(true);
  expect(
    getSignInErrorState({ errors: [{ code: "session_invalid" }] }).message
  ).toContain("Sua sessão expirou");
});

test("never displays unrecognized Clerk messages or internal details", () => {
  const result = getSignInErrorState({
    errors: [
      {
        code: "internal_error",
        message: "database cluster db.internal failed with token abc123",
      },
    ],
    stack: "private implementation stack",
  });

  expect(result.message).not.toContain("db.internal");
  expect(result.message).not.toContain("abc123");
  expect(result.message).not.toContain("private implementation stack");
});
