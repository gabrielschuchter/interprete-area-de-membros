"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { type FormEvent, useEffect, useState } from "react";
import { getAuthRedirectPath, getSignInErrorState } from "./sign-in-errors";

type ResetStep = "code" | "password" | null;
type SecondFactorStrategy = "email_code" | "totp" | null;

// The component owns the finite-state rendering for password, reset, and MFA flows.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: authentication states are intentionally kept together for one accessible form
export const SignIn = () => {
  const { isLoaded, isSignedIn } = useAuth();
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

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.location.replace(getAuthRedirectPath(window.location.href));
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || isSignedIn || fetchStatus !== "idle" || !signIn) {
    return (
      <div aria-live="polite" className="interprete-login__loading">
        <span aria-hidden="true" />
        Carregando acesso…
      </div>
    );
  }

  const activateSession = async () => {
    const { error } = await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.assign(
          decorateUrl(getAuthRedirectPath(window.location.href))
        );
      },
    });

    if (error) {
      throw error;
    }
  };

  const submitResetCode = async () => {
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({
      code: resetCode.trim(),
    });

    if (error) {
      throw error;
    }

    if (signIn.status === "needs_new_password") {
      setPassword("");
      setResetCode("");
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
      signOutOfOtherSessions: true,
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
      identifier: identifier.trim(),
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
      const nextError = getSignInErrorState(error);

      if (nextError.activeSession) {
        window.location.replace(getAuthRedirectPath(window.location.href));
        return;
      }

      setErrorMessage(nextError.message);
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
    setPassword("");
    setResetCode("");
    setSecondFactorCode("");
    setSecondFactorStrategy(null);
    setIsSubmitting(true);

    try {
      // Password, MFA, and reset attempts share one Clerk SignInFuture.
      // Reset it before starting recovery so stale attempt state cannot be reused.
      const { error: resetError } = await signIn.reset();

      if (resetError) {
        throw resetError;
      }

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
      const nextError = getSignInErrorState(error);

      if (nextError.activeSession) {
        window.location.replace(getAuthRedirectPath(window.location.href));
        return;
      }

      setErrorMessage(nextError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToSignIn = async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { error } = await signIn.reset();

      if (error) {
        throw error;
      }

      setResetStep(null);
      setResetCode("");
      setSecondFactorStrategy(null);
      setSecondFactorCode("");
      setPassword("");
    } catch (error) {
      setErrorMessage(getSignInErrorState(error).message);
    } finally {
      setIsSubmitting(false);
    }
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
          <p className="interprete-login__field-hint">
            Os requisitos da senha são verificados com segurança pelo Clerk.
          </p>
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
