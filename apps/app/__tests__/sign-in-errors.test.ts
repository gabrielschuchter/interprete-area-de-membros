import { shouldProxyClerkFrontendApi } from "@repo/auth/clerk-proxy";
import {
  getAuthRedirectPath,
  getSignInErrorState,
} from "@repo/auth/components/sign-in-errors";
import { expect, test } from "vitest";

test("only labels a Clerk password rejection as an incorrect password", () => {
  expect(
    getSignInErrorState({
      errors: [
        { code: "form_password_incorrect", message: "Password incorrect" },
      ],
    })
  ).toEqual({
    activeSession: false,
    message: "A senha está incorreta. Tente novamente.",
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
    message: "O código informado está incorreto. Confira e tente novamente.",
  });
});

test("uses Clerk's reported minimum password length when recovery rejects a password", () => {
  expect(
    getSignInErrorState({
      errors: [{ message: "Password must be at least 15 characters" }],
    }).message
  ).toBe("A senha precisa ter pelo menos 15 caracteres.");
});

test("does not infer a password error from unrelated Clerk failures", () => {
  expect(
    getSignInErrorState({ errors: [{ message: "Network request failed" }] })
      .message
  ).toBe("Network request failed");
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
