"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { type FormEvent, useState } from "react";

type ResetStep = "code" | "password" | null;

interface ClerkError {
  errors?: Array<{ longMessage?: string; message?: string }>;
  longMessage?: string;
  message?: string;
}

const fallbackError =
  "Não foi possível entrar. Confira seus dados e tente novamente.";
const signedOutErrorPattern = /you are signed out/i;

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

  return message;
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

export const SignIn = () => {
  const { isLoaded, setActive, signIn } = useSignIn();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetStep, setResetStep] = useState<ResetStep>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!(isLoaded && signIn && setActive)) {
    return (
      <div aria-live="polite" className="interprete-login__loading">
        <span aria-hidden="true" />
        Carregando acesso…
      </div>
    );
  }

  const activateSession = async (sessionId: string | null) => {
    if (!sessionId) {
      throw new Error("A autenticação não retornou uma sessão válida.");
    }

    await setActive({ session: sessionId });
    window.location.assign(getRedirectPath());
  };

  const submitResetCode = async () => {
    const result = await signIn.attemptFirstFactor({
      strategy: "reset_password_email_code",
      code: resetCode.trim(),
    });

    if (result.status === "needs_new_password") {
      setResetStep("password");
      return;
    }

    if (result.status === "complete") {
      await activateSession(result.createdSessionId);
      return;
    }

    throw new Error("O código ainda não pode ser utilizado.");
  };

  const submitNewPassword = async () => {
    const result = await signIn.resetPassword({ password });

    if (result.status === "complete") {
      await activateSession(result.createdSessionId);
      return;
    }

    throw new Error("A nova senha ainda não pôde ser definida.");
  };

  const submitPassword = async () => {
    const result = await signIn.create({
      identifier: identifier.trim(),
      password,
      strategy: "password",
    });

    if (result.status === "complete") {
      await activateSession(result.createdSessionId);
      return;
    }

    if (result.status === "needs_second_factor") {
      throw new Error(
        "Esta conta exige uma segunda etapa de segurança. Use o fluxo de autenticação disponível para concluir o acesso."
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
      await signIn.create({
        identifier: normalizedIdentifier,
        strategy: "reset_password_email_code",
      });
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
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="interprete-login__form"
      onSubmit={handleSubmit}
    >
      {isResetFlow ? (
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
            disabled={isSubmitting || isResetFlow}
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

      {isResetFlow ? null : (
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

      {isResetFlow ? null : (
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
