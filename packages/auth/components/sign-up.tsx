"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import { type FormEvent, useState } from "react";

type SignUpStep = "form" | "verification";

interface ClerkErrorItem {
  code?: string;
  longMessage?: string;
  message?: string;
}

interface ClerkError {
  errors?: ClerkErrorItem[];
  longMessage?: string;
  message?: string;
}

const fallbackError =
  "Não foi possível criar sua conta. Confira os dados e tente novamente.";
const existingAccountError =
  "Este e-mail já está associado a uma conta. Entre por aqui.";
const emailAlreadyExistsPattern =
  /already (?:exists|registered|connected)|identifier.*already|email.*(?:already|in use|taken|exists)/i;
const invalidIdentifierPattern =
  /identifier is invalid|email address is invalid|valid email/i;
const weakPasswordPattern =
  /password.*(?:too short|too weak|must be|at least)|password.*compromised|password.*common/i;
const incorrectCodePattern =
  /verification code is incorrect|code is incorrect|invalid code/i;
const rateLimitPattern = /too many|rate limit|try again later/i;
const additionalRequirementPattern = /additional_signup_requirement/i;
const verificationPendingPattern = /verification_pending/i;
const portugueseMessagePattern = /^[\u00C0-\u024F\s.,!?;:'"()\-/]+$/;

const getClerkMessage = (error: unknown) => {
  const clerkError = (
    typeof error === "object" && error !== null ? error : {}
  ) as ClerkError;
  const firstError = clerkError.errors?.[0];

  return {
    code: firstError?.code,
    message:
      firstError?.longMessage ??
      firstError?.message ??
      clerkError.longMessage ??
      clerkError.message ??
      "",
  };
};

export const getSignUpErrorState = (error: unknown) => {
  const { code, message } = getClerkMessage(error);

  if (
    code === "form_identifier_exists" ||
    emailAlreadyExistsPattern.test(message)
  ) {
    return { message: existingAccountError, existingAccount: true };
  }

  if (additionalRequirementPattern.test(message)) {
    return {
      message:
        "Ainda falta uma confirmação para concluir o cadastro. Tente novamente.",
      existingAccount: false,
    };
  }

  if (verificationPendingPattern.test(message)) {
    return {
      message: "Digite o código que enviamos para continuar.",
      existingAccount: false,
    };
  }

  if (invalidIdentifierPattern.test(message)) {
    return {
      message: "Informe um e-mail válido.",
      existingAccount: false,
    };
  }

  if (weakPasswordPattern.test(message)) {
    return {
      message:
        "Escolha uma senha mais forte e que você ainda não tenha usado em outro lugar.",
      existingAccount: false,
    };
  }

  if (incorrectCodePattern.test(message)) {
    return {
      message: "O código informado está incorreto. Confira e tente novamente.",
      existingAccount: false,
    };
  }

  if (rateLimitPattern.test(message)) {
    return {
      message:
        "Muitas tentativas em sequência. Espere um pouco e tente novamente.",
      existingAccount: false,
    };
  }

  if (message && portugueseMessagePattern.test(message)) {
    return { message, existingAccount: false };
  }

  return { message: fallbackError, existingAccount: false };
};

const getRedirectPath = () => {
  if (typeof window === "undefined") {
    return "/";
  }

  const redirectUrl = new URLSearchParams(window.location.search).get(
    "redirect_url"
  );

  if (!redirectUrl) {
    return "/";
  }

  try {
    const parsedUrl = new URL(redirectUrl, window.location.origin);

    if (parsedUrl.origin !== window.location.origin) {
      return "/";
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return "/";
  }
};

// The component owns the finite-state rendering for password creation and
// email verification. Clerk remains the identity provider; the member record
// is created by the authenticated application guard after the session starts.
export const SignUp = () => {
  const { isLoaded, setActive, signUp } = useSignUp();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<SignUpStep>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasExistingAccount, setHasExistingAccount] = useState(false);

  if (!(isLoaded && signUp && setActive)) {
    return (
      <div aria-live="polite" className="interprete-login__loading">
        <span aria-hidden="true" />
        Carregando cadastro…
      </div>
    );
  }

  const activateSession = async (sessionId: string | null) => {
    if (!sessionId) {
      throw new Error("Não foi possível iniciar a sessão depois do cadastro.");
    }

    await setActive({ session: sessionId });
    window.location.assign(getRedirectPath());
  };

  const handleCreateAccount = async () => {
    const normalizedIdentifier = identifier.trim();

    if (password.length < 8) {
      throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    }

    const result = await signUp.create({
      emailAddress: normalizedIdentifier,
      password,
    });

    if (result.status === "complete") {
      await activateSession(result.createdSessionId);
      return;
    }

    if (result.unverifiedFields.includes("email_address")) {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verification");
      return;
    }

    throw new Error("additional_signup_requirement");
  };

  const handleVerifyEmail = async () => {
    const result = await signUp.attemptEmailAddressVerification({
      code: verificationCode.trim(),
    });

    if (result.status === "complete") {
      await activateSession(result.createdSessionId);
      return;
    }

    throw new Error("verification_pending");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setHasExistingAccount(false);
    setIsSubmitting(true);

    try {
      if (step === "verification") {
        await handleVerifyEmail();
      } else {
        await handleCreateAccount();
      }
    } catch (error) {
      const nextError = getSignUpErrorState(error);
      setErrorMessage(nextError.message);
      setHasExistingAccount(nextError.existingAccount);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (error) {
      const nextError = getSignUpErrorState(error);
      setErrorMessage(nextError.message);
      setHasExistingAccount(nextError.existingAccount);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToForm = () => {
    if (isSubmitting) {
      return;
    }

    setStep("form");
    setVerificationCode("");
    setErrorMessage("");
    setHasExistingAccount(false);
  };

  const isVerificationStep = step === "verification";
  let primaryLabel = "Criar conta";
  if (isSubmitting) {
    primaryLabel = "Aguarde…";
  } else if (isVerificationStep) {
    primaryLabel = "Confirmar e entrar";
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="interprete-login__form"
      onSubmit={handleSubmit}
    >
      {isVerificationStep ? (
        <button
          className="interprete-login__back"
          disabled={isSubmitting}
          onClick={handleBackToForm}
          type="button"
        >
          ← Voltar para criar conta
        </button>
      ) : null}

      <div className="interprete-login__field">
        <label htmlFor="interprete-sign-up-email">E-mail</label>
        <div className="interprete-login__input-wrap interprete-login__input-wrap--email">
          <input
            autoComplete="email"
            className="interprete-login__input"
            disabled={isSubmitting || isVerificationStep}
            id="interprete-sign-up-email"
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="seu@email.com"
            required
            type="email"
            value={identifier}
          />
        </div>
      </div>

      {isVerificationStep ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-sign-up-code">Código de confirmação</label>
          <input
            autoComplete="one-time-code"
            className="interprete-login__input"
            disabled={isSubmitting}
            id="interprete-sign-up-code"
            inputMode="numeric"
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="Digite o código enviado por e-mail"
            required
            value={verificationCode}
          />
          <p className="interprete-login__field-hint">
            Enviamos um código para confirmar este e-mail.
          </p>
        </div>
      ) : (
        <div className="interprete-login__field">
          <label htmlFor="interprete-sign-up-password">Senha</label>
          <div className="interprete-login__input-wrap interprete-login__input-wrap--password">
            <input
              autoComplete="new-password"
              className="interprete-login__input"
              disabled={isSubmitting}
              id="interprete-sign-up-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Crie uma senha"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="interprete-login__password-toggle"
              disabled={isSubmitting}
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              <span aria-hidden="true">{showPassword ? "◉" : "◌"}</span>
            </button>
          </div>
          <p className="interprete-login__field-hint">
            Use pelo menos 8 caracteres.
          </p>
        </div>
      )}

      <div data-cl-size="flexible" data-cl-theme="light" id="clerk-captcha" />

      {errorMessage ? (
        <div
          aria-live="assertive"
          className="interprete-login__error"
          role="alert"
        >
          <p>{errorMessage}</p>
          {hasExistingAccount ? (
            <a href="/sign-in">Entrar na minha conta</a>
          ) : null}
        </div>
      ) : null}

      <button
        className="interprete-login__submit"
        disabled={isSubmitting}
        type="submit"
      >
        <span>{primaryLabel}</span>
        <span aria-hidden="true">→</span>
      </button>

      {isVerificationStep ? (
        <button
          className="interprete-login__forgot"
          disabled={isSubmitting}
          onClick={handleResendCode}
          type="button"
        >
          Reenviar código
        </button>
      ) : null}
    </form>
  );
};
