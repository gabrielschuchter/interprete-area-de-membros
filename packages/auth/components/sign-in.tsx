"use client";

import { useSignIn } from "@clerk/nextjs";
import { type FormEvent, useState } from "react";

type ResetStep = "code" | "password" | null;
type SecondFactorStrategy = "email_code" | "totp" | null;

interface ClerkError {
  errors?: Array<{ longMessage?: string; message?: string }>;
  longMessage?: string;
  message?: string;
}

const fallbackError =
  "Não foi possível entrar. Confira seus dados e tente novamente.";
const signedOutErrorPattern = /you are signed out/i;
const incorrectPasswordPattern =
  /password is incorrect\. try again, or use another method\.?/i;
const missingAccountPattern =
  /couldn.t find your account|account could not be found/i;
const invalidIdentifierPattern =
  /identifier is invalid|email address is invalid/i;
const incorrectCodePattern =
  /verification code is incorrect|code is incorrect/i;
const genericClerkErrorPattern = /something went wrong|internal error/i;

const translateClerkError = (message: string) => {
  const translations: [RegExp, string][] = [
    [
      incorrectPasswordPattern,
      "A senha está incorreta. Tente novamente ou use outro método.",
    ],
    [missingAccountPattern, "Não encontramos uma conta com esses dados."],
    [invalidIdentifierPattern, "Informe um e-mail válido."],
    [
      incorrectCodePattern,
      "O código informado está incorreto. Confira e tente novamente.",
    ],
    [
      genericClerkErrorPattern,
      "Algo deu errado. Tente novamente em alguns instantes.",
    ],
  ];

  return (
    translations.find(([pattern]) => pattern.test(message))?.[1] ?? message
  );
};

const getErrorMessage = (error: unknown) => {
  const clerkError = (
    typeof error === "object" && error !== null ? error : {}
  ) as ClerkError;
  const message =
    clerkError.errors?.[0]?.longMessage ??
    clerkError.errors?.[0]?.message ??
    clerkError.longMessage ??
    clerkError.message;

  if (!message || signedOutErrorPattern.test(message)) {
    return fallbackError;
  }

  return translateClerkError(message);
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

// The component owns the finite-state rendering for password, reset, and MFA flows.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: authentication states are intentionally kept together for one accessible form
export const SignIn = () => {
  const { fetchStatus, signIn } = useSignIn();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetStep, setResetStep] = useState<ResetStep>(null);
  const [secondFactorCode, setSecondFactorCode] = useState("");
  const [secondFactorStrategy, setSecondFactorStrategy] =
    useState<SecondFactorStrategy>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (fetchStatus !== "idle" || !signIn) {
    return (
      <div aria-live="polite" className="interprete-login__loading">
        <span aria-hidden="true" />
        Carregando acesso…
      </div>
    );
  }

  const activateSession = async () => {
    const { error } = await signIn.finalize();

    if (error) {
      throw error;
    }

    window.location.assign(getRedirectPath());
  };

  const submitResetCode = async () => {
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({
      code: resetCode.trim(),
    });

    if (error) {
      throw error;
    }

    if (signIn.status === "needs_new_password") {
      setResetStep("password");
      return;
    }

    if (signIn.status === "complete") {
      await activateSession();
      return;
    }

    throw new Error("O código ainda não pode ser utilizado.");
  };

  const submitNewPassword = async () => {
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password,
    });

    if (error) {
      throw error;
    }

    if (signIn.status === "complete") {
      await activateSession();
      return;
    }

    throw new Error("A nova senha ainda não pôde ser definida.");
  };

  const submitSecondFactor = async () => {
    if (!secondFactorStrategy) {
      throw new Error("Selecione uma forma de confirmação para continuar.");
    }

    const result =
      secondFactorStrategy === "email_code"
        ? await signIn.mfa.verifyEmailCode({ code: secondFactorCode.trim() })
        : await signIn.mfa.verifyTOTP({ code: secondFactorCode.trim() });

    if (result.error) {
      throw result.error;
    }

    if (signIn.status === "complete") {
      await activateSession();
      return;
    }

    throw new Error(
      "Não foi possível confirmar a segunda etapa. Confira o código e tente novamente."
    );
  };

  const submitPassword = async () => {
    const { error } = await signIn.password({
      emailAddress: identifier.trim(),
      password,
    });

    if (error) {
      throw error;
    }

    if (signIn.status === "complete") {
      await activateSession();
      return;
    }

    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      const emailCodeFactor = signIn.supportedSecondFactors?.find(
        (factor) => factor.strategy === "email_code"
      );

      if (emailCodeFactor) {
        const secondFactorResult = await signIn.mfa.sendEmailCode();

        if (secondFactorResult.error) {
          throw secondFactorResult.error;
        }
        setSecondFactorStrategy("email_code");
        return;
      }

      const totpFactor = signIn.supportedSecondFactors?.find(
        (factor) => factor.strategy === "totp"
      );

      if (totpFactor) {
        setSecondFactorStrategy("totp");
        return;
      }

      throw new Error(
        "Sua conta exige uma segunda etapa de segurança que não está disponível nesta tela."
      );
    }

    throw new Error("Não foi possível concluir o acesso.");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (resetStep === "code") {
        await submitResetCode();
        return;
      }

      if (resetStep === "password") {
        await submitNewPassword();
        return;
      }

      if (secondFactorStrategy) {
        await submitSecondFactor();
        return;
      }

      await submitPassword();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (isSubmitting) {
      return;
    }

    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier) {
      setErrorMessage("Informe seu e-mail para recuperar a senha.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { error } = await signIn.create({
        identifier: normalizedIdentifier,
      });

      if (error) {
        throw error;
      }

      const resetResult = await signIn.resetPasswordEmailCode.sendCode();

      if (resetResult.error) {
        throw resetResult.error;
      }

      setResetStep("code");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToSignIn = () => {
    if (isSubmitting) {
      return;
    }

    setResetStep(null);
    setResetCode("");
    setSecondFactorStrategy(null);
    setSecondFactorCode("");
    setPassword("");
    setErrorMessage("");
  };

  const isResetFlow = resetStep !== null;
  let primaryLabel = "Entrar";
  if (isSubmitting) {
    primaryLabel = "Aguarde…";
  } else if (resetStep === "code") {
    primaryLabel = "Confirmar código";
  } else if (resetStep === "password") {
    primaryLabel = "Definir senha";
  } else if (secondFactorStrategy) {
    primaryLabel = "Confirmar acesso";
  }

  const isSecondFactorFlow = secondFactorStrategy !== null;
  const isVerificationFlow = isResetFlow || isSecondFactorFlow;

  return (
    <form
      aria-busy={isSubmitting}
      className="interprete-login__form"
      onSubmit={handleSubmit}
    >
      {isVerificationFlow ? (
        <button
          className="interprete-login__back"
          disabled={isSubmitting}
          onClick={handleBackToSignIn}
          type="button"
        >
          ← Voltar para entrar
        </button>
      ) : null}

      <div className="interprete-login__field">
        <label htmlFor="interprete-login-email">E-mail</label>
        <div className="interprete-login__input-wrap interprete-login__input-wrap--email">
          <input
            autoComplete="email"
            className="interprete-login__input"
            disabled={isSubmitting || isVerificationFlow}
            id="interprete-login-email"
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="seu@email.com"
            required
            type="email"
            value={identifier}
          />
        </div>
      </div>

      {resetStep === "code" ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-login-reset-code">Código recebido</label>
          <input
            autoComplete="one-time-code"
            className="interprete-login__input"
            disabled={isSubmitting}
            id="interprete-login-reset-code"
            inputMode="numeric"
            onChange={(event) => setResetCode(event.target.value)}
            placeholder="Digite o código enviado por e-mail"
            required
            value={resetCode}
          />
        </div>
      ) : null}

      {isSecondFactorFlow ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-login-second-factor">
            {secondFactorStrategy === "email_code"
              ? "Código enviado por e-mail"
              : "Código do aplicativo autenticador"}
          </label>
          <input
            autoComplete="one-time-code"
            className="interprete-login__input"
            disabled={isSubmitting}
            id="interprete-login-second-factor"
            inputMode="numeric"
            onChange={(event) => setSecondFactorCode(event.target.value)}
            placeholder="Digite o código de segurança"
            required
            value={secondFactorCode}
          />
        </div>
      ) : null}

      {resetStep === "password" ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-login-new-password">Nova senha</label>
          <input
            autoComplete="new-password"
            className="interprete-login__input"
            disabled={isSubmitting}
            id="interprete-login-new-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua nova senha"
            required
            type="password"
            value={password}
          />
        </div>
      ) : null}

      {isVerificationFlow ? null : (
        <div className="interprete-login__field">
          <label htmlFor="interprete-login-password">Senha</label>
          <div className="interprete-login__input-wrap interprete-login__input-wrap--password">
            <input
              autoComplete="current-password"
              className="interprete-login__input"
              disabled={isSubmitting}
              id="interprete-login-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
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
        </div>
      )}

      {errorMessage ? (
        <p
          aria-live="assertive"
          className="interprete-login__error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        className="interprete-login__submit"
        disabled={isSubmitting}
        type="submit"
      >
        <span>{primaryLabel}</span>
        <span aria-hidden="true">→</span>
      </button>

      {isVerificationFlow ? null : (
        <>
          <div aria-hidden="true" className="interprete-login__divider">
            <span />
            <b>ou</b>
            <span />
          </div>
          <button
            className="interprete-login__forgot"
            disabled={isSubmitting}
            onClick={handlePasswordReset}
            type="button"
          >
            Esqueci minha senha
          </button>
        </>
      )}
    </form>
  );
};
