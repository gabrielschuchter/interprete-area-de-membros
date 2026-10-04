"use client";

import { useAuth, useSession, useSignIn } from "@clerk/nextjs";
import { type FormEvent, useEffect, useState } from "react";
import { getAuthCompletionPath } from "../redirects";
import { AuthLoadingState } from "./auth-loading-state";
import {
  getAuthRedirectPath,
  getPasswordRecoveryErrorState,
  getSignInErrorState,
  isUnknownAccountError,
} from "./sign-in-errors";

type ResetStep = "code" | "password" | null;
type ResetStrategy = "email_code" | "phone_code";
type SecondFactorStrategy =
  | "email_code"
  | "email_link"
  | "phone_code"
  | "totp"
  | "backup_code"
  | null;

const secondFactorLabels: Record<
  Exclude<SecondFactorStrategy, null>,
  string
> = {
  email_code: "Código enviado por e-mail",
  email_link: "Link enviado por e-mail",
  phone_code: "Código enviado por SMS",
  totp: "Código do aplicativo autenticador",
  backup_code: "Código de recuperação da autenticação em duas etapas",
};

const getSubmitErrorState = (error: unknown, isPasswordRecovery: boolean) =>
  isPasswordRecovery
    ? getPasswordRecoveryErrorState(error)
    : getSignInErrorState(error);

const throwClerkError = (result: { error?: unknown }) => {
  if (result.error) {
    throw result.error;
  }
};

// The component owns the finite-state rendering for password, reset, and MFA flows.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: authentication states are intentionally kept together for one accessible form
export const SignIn = () => {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isSessionLoaded, session } = useSession();
  const { fetchStatus, signIn } = useSignIn();
  const isLoaded = isAuthLoaded && isSessionLoaded;
  const currentTaskKey = session?.currentTask?.key;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetStep, setResetStep] = useState<ResetStep>(null);
  const [resetStrategy, setResetStrategy] =
    useState<ResetStrategy>("email_code");
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [secondFactorCode, setSecondFactorCode] = useState("");
  const [secondFactorStrategy, setSecondFactorStrategy] =
    useState<SecondFactorStrategy>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.location.replace(
        getAuthCompletionPath(window.location.href, currentTaskKey)
      );
    }
  }, [currentTaskKey, isLoaded, isSignedIn]);

  if (!isLoaded || isSignedIn || fetchStatus !== "idle" || !signIn) {
    return <AuthLoadingState loadingLabel="Carregando acesso…" />;
  }

  const activateSession = async () => {
    const { error } = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        window.location.assign(
          decorateUrl(
            getAuthCompletionPath(
              window.location.href,
              session?.currentTask?.key
            )
          )
        );
      },
    });

    if (error) {
      throw error;
    }
  };

  const prepareSecondFactor = async () => {
    const factors = signIn.supportedSecondFactors ?? [];
    const priority: Exclude<SecondFactorStrategy, null>[] = [
      "email_code",
      "phone_code",
      "email_link",
      "totp",
      "backup_code",
    ];
    const selectedStrategy = priority.find((strategy) =>
      factors.some((factor) => factor.strategy === strategy)
    );

    if (!selectedStrategy) {
      throw new Error("second_factor_unavailable");
    }

    if (selectedStrategy === "email_code") {
      const result = await signIn.mfa.sendEmailCode();
      if (result.error) {
        throw result.error;
      }
    } else if (selectedStrategy === "phone_code") {
      const result = await signIn.mfa.sendPhoneCode();
      if (result.error) {
        throw result.error;
      }
    } else if (selectedStrategy === "email_link") {
      const verificationUrl = new URL("/sign-in", window.location.origin);
      verificationUrl.searchParams.set(
        "redirect_url",
        getAuthRedirectPath(window.location.href)
      );
      const result = await signIn.emailLink.sendLink({
        verificationUrl: verificationUrl.toString(),
      });
      if (result.error) {
        throw result.error;
      }
    }

    setSecondFactorCode("");
    setSecondFactorStrategy(selectedStrategy);
  };

  const submitResetCode = async () => {
    const result =
      resetStrategy === "email_code"
        ? await signIn.resetPasswordEmailCode.verifyCode({
            code: resetCode.trim(),
          })
        : await signIn.resetPasswordPhoneCode.verifyCode({
            code: resetCode.trim(),
          });

    if (result.error) {
      throw result.error;
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

    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      await prepareSecondFactor();
      return;
    }

    throw new Error("O código ainda não pode ser utilizado.");
  };

  const submitNewPassword = async () => {
    const result =
      resetStrategy === "email_code"
        ? await signIn.resetPasswordEmailCode.submitPassword({
            password,
            signOutOfOtherSessions: true,
          })
        : await signIn.resetPasswordPhoneCode.submitPassword({
            password,
            signOutOfOtherSessions: true,
          });

    if (result.error) {
      throw result.error;
    }

    if (signIn.status === "complete") {
      await activateSession();
      return;
    }

    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      await prepareSecondFactor();
      return;
    }

    throw new Error("A nova senha ainda não pôde ser definida.");
  };

  const submitSecondFactor = async () => {
    if (!secondFactorStrategy) {
      throw new Error("Selecione uma forma de confirmação para continuar.");
    }

    const code = secondFactorCode.trim();
    if (secondFactorStrategy === "email_link") {
      throwClerkError(await signIn.emailLink.waitForVerification());
    } else if (secondFactorStrategy === "email_code") {
      throwClerkError(await signIn.mfa.verifyEmailCode({ code }));
    } else if (secondFactorStrategy === "phone_code") {
      throwClerkError(await signIn.mfa.verifyPhoneCode({ code }));
    } else if (secondFactorStrategy === "backup_code") {
      throwClerkError(await signIn.mfa.verifyBackupCode({ code }));
    } else {
      throwClerkError(await signIn.mfa.verifyTOTP({ code }));
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
      await prepareSecondFactor();
      return;
    }

    throw new Error("Não foi possível concluir o acesso.");
  };

  const submitCurrentStep = async () => {
    if (secondFactorStrategy) {
      await submitSecondFactor();
      return;
    }

    if (resetStep === "code") {
      await submitResetCode();
      return;
    }

    if (resetStep === "password") {
      await submitNewPassword();
      return;
    }

    await submitPassword();
  };

  const showSignInError = (error: unknown, isPasswordRecovery = false) => {
    const nextError = getSubmitErrorState(error, isPasswordRecovery);

    if (nextError.activeSession) {
      if (isSignedIn) {
        window.location.replace(getAuthRedirectPath(window.location.href));
      } else {
        setErrorMessage(
          "Não conseguimos confirmar o estado da sua sessão. Atualize a página e tente novamente."
        );
      }
      return;
    }

    setErrorMessage(nextError.message);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await submitCurrentStep();
    } catch (error) {
      showSignInError(error, resetStep !== null && !secondFactorStrategy);
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginPasswordRecovery = async (normalizedIdentifier: string) => {
    // Password, MFA, and reset attempts share one Clerk SignInFuture.
    // Reset it before starting recovery so stale attempt state cannot be reused.
    const { error: resetError } = await signIn.reset();
    if (resetError) {
      throw resetError;
    }

    const strategy: ResetStrategy = normalizedIdentifier.includes("@")
      ? "email_code"
      : "phone_code";
    setResetStrategy(strategy);

    const { error } = await signIn.create({ identifier: normalizedIdentifier });
    if (error && !isUnknownAccountError(error)) {
      throw error;
    }

    if (!error) {
      const resetResult =
        strategy === "email_code"
          ? await signIn.resetPasswordEmailCode.sendCode()
          : await signIn.resetPasswordPhoneCode.sendCode();

      if (resetResult.error && !isUnknownAccountError(resetResult.error)) {
        throw resetResult.error;
      }
    }

    setResetStep("code");
    setRecoveryNotice(
      "Se houver uma conta com esses dados, enviaremos um código de recuperação."
    );
  };

  const handlePasswordReset = async () => {
    if (isSubmitting) {
      return;
    }

    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier) {
      setErrorMessage("Informe seu e-mail ou telefone para recuperar a senha.");
      return;
    }

    setErrorMessage("");
    setPassword("");
    setResetCode("");
    setRecoveryNotice("");
    setSecondFactorCode("");
    setSecondFactorStrategy(null);
    setIsSubmitting(true);

    try {
      await beginPasswordRecovery(normalizedIdentifier);
    } catch (error) {
      showSignInError(error, true);
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
      setRecoveryNotice("");
      setSecondFactorStrategy(null);
      setSecondFactorCode("");
      setPassword("");
      setResetStrategy("email_code");
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
  } else if (secondFactorStrategy === "email_link") {
    primaryLabel = "Já confirmei o link";
  } else if (secondFactorStrategy) {
    primaryLabel = "Confirmar acesso";
  } else if (resetStep === "code") {
    primaryLabel = "Confirmar código";
  } else if (resetStep === "password") {
    primaryLabel = "Definir senha";
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
        <label htmlFor="interprete-login-email">E-mail ou telefone</label>
        <div className="interprete-login__input-wrap interprete-login__input-wrap--email">
          <input
            autoComplete="username"
            className="interprete-login__input"
            disabled={isSubmitting || isVerificationFlow}
            id="interprete-login-email"
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="seu@email.com ou +55 11 99999-9999"
            required
            type="text"
            value={identifier}
          />
        </div>
      </div>

      {resetStep === "code" && !isSecondFactorFlow ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-login-reset-code">Código recebido</label>
          <input
            autoComplete="one-time-code"
            className="interprete-login__input"
            disabled={isSubmitting}
            id="interprete-login-reset-code"
            inputMode="numeric"
            onChange={(event) => setResetCode(event.target.value)}
            placeholder="Digite o código de recuperação"
            required
            value={resetCode}
          />
        </div>
      ) : null}

      {isSecondFactorFlow ? (
        <div className="interprete-login__field">
          {secondFactorStrategy === "email_link" ? (
            <output aria-live="polite" className="interprete-login__field-hint">
              Enviamos um link de segurança para seu e-mail. Abra-o neste mesmo
              navegador e depois confirme abaixo.
            </output>
          ) : (
            <>
              <label htmlFor="interprete-login-second-factor">
                {secondFactorLabels[secondFactorStrategy]}
              </label>
              <input
                autoComplete="one-time-code"
                className="interprete-login__input"
                disabled={isSubmitting}
                id="interprete-login-second-factor"
                inputMode={
                  secondFactorStrategy === "backup_code" ? "text" : "numeric"
                }
                onChange={(event) => setSecondFactorCode(event.target.value)}
                placeholder={
                  secondFactorStrategy === "backup_code"
                    ? "Digite um código de backup"
                    : "Digite o código de segurança"
                }
                required
                value={secondFactorCode}
              />
            </>
          )}
        </div>
      ) : null}

      {resetStep === "password" && !isSecondFactorFlow ? (
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

      <div data-cl-size="flexible" data-cl-theme="light" id="clerk-captcha" />

      {errorMessage ? (
        <p
          aria-live="assertive"
          className="interprete-login__error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {recoveryNotice ? (
        <output aria-live="polite" className="interprete-login__field-hint">
          {recoveryNotice}
        </output>
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
