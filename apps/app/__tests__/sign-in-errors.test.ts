import { shouldProxyClerkFrontendApi } from "@repo/auth/clerk-proxy";
import {
  getAuthRedirectPath,
  getPasswordRecoveryErrorState,
  getSignInErrorState,
} from "@repo/auth/components/sign-in-errors";
import { expect, test } from "vitest";

test("keeps invalid credentials generic and distinguishes expired sessions", () => {
  expect(
    getSignInErrorState({
      errors: [
        { code: "form_password_incorrect", message: "Password incorrect" },
      ],
    })
  ).toEqual({
    activeSession: false,
    message:
      "E-mail ou telefone e senha não correspondem. Confira os dados e tente novamente.",
  });

  expect(
    getSignInErrorState({
      errors: [{ code: "form_password_or_identifier_incorrect" }],
    })
  ).toEqual({
    activeSession: false,
    message:
      "E-mail ou telefone e senha não correspondem. Confira os dados e tente novamente.",
  });

  expect(
    getSignInErrorState({ errors: [{ code: "form_identifier_not_found" }] })
  ).toEqual({
    activeSession: false,
    message:
      "E-mail ou telefone e senha não correspondem. Confira os dados e tente novamente.",
  });

  expect(
    getSignInErrorState({ errors: [{ message: "Your session has expired" }] })
  ).toEqual({
    activeSession: false,
    message:
      "Sua sessão expirou ou não é mais válida. Entre novamente para continuar.",
  });
});

test("treats an already active session as navigation, not a credential failure", () => {
  expect(
    getSignInErrorState({
      errors: [{ code: "session_exists", message: "Session already exists" }],
    })
  ).toEqual({ activeSession: true, message: "" });
});

test("translates Clerk reset-code errors into the sign-in locale", () => {
  expect(
    getSignInErrorState({ errors: [{ message: "Incorrect code" }] })
  ).toEqual({
    activeSession: false,
    message:
      "O código informado está incorreto ou expirou. Confira e tente novamente.",
  });
});

test("keeps account-neutral messaging throughout password recovery", () => {
  expect(
    getPasswordRecoveryErrorState({
      errors: [{ code: "form_password_or_identifier_incorrect" }],
    }).message
  ).toBe(
    "Se houver uma conta com esses dados, enviaremos um código de recuperação."
  );
});

test("uses Clerk's reported minimum password length when recovery rejects a password", () => {
  expect(
    getSignInErrorState({
      errors: [{ message: "Password must be at least 15 characters" }],
    }).message
  ).toBe(
    "A senha precisa ter pelo menos 15 caracteres, conforme os requisitos da conta."
  );
});

test("does not expose arbitrary Clerk diagnostics", () => {
  expect(
    getSignInErrorState({
      errors: [
        {
          code: "internal_error",
          message: "Network request failed: secret database detail",
        },
      ],
      stack: "private stack trace",
    }).message
  ).toBe(
    "Não foi possível concluir esta etapa. Tente novamente em alguns instantes."
  );
});

test("preserves same-origin return URLs and rejects external redirects", () => {
  expect(
    getAuthRedirectPath(
      "https://members.example/sign-in?redirect_url=%2Faprender%3Ftab%3Dnext"
    )
  ).toBe("/aprender?tab=next");
  expect(
    getAuthRedirectPath(
      "https://members.example/sign-in?redirect_url=https%3A%2F%2Fevil.example"
    )
  ).toBe("/");
});

test("only enables the Clerk frontend proxy for production publishable keys", () => {
  expect(shouldProxyClerkFrontendApi("pk_live_abc")).toBe(true);
  expect(shouldProxyClerkFrontendApi("pk_test_abc")).toBe(false);
  expect(shouldProxyClerkFrontendApi(undefined)).toBe(false);
});
