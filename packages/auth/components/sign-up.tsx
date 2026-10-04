"use client";

import { useAuth, useSession, useSignUp } from "@clerk/nextjs";
import { type FormEvent, useEffect, useState } from "react";
import { getAuthCompletionPath } from "../redirects";
import { AuthLoadingState } from "./auth-loading-state";
import {
  getAuthRedirectPath,
  isActiveClerkSessionError,
} from "./sign-in-errors";

type SignUpStep = "form" | "verification" | "requirements";
type VerificationTarget = "email_address" | "phone_number";

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
const additionalRequirementError =
  "O cadastro precisa de informações adicionais. Revise os campos e tente novamente.";
const invalidIdentifierCodes = new Set([
  "form_identifier_invalid",
  "form_param_format_invalid",
]);
const passwordPolicyCodes = new Set([
  "form_password_length_too_short",
  "form_password_not_strong_enough",
  "form_password_pwned",
  "form_password_compromised",
]);
const incorrectCodeCodes = new Set([
  "verification_code_incorrect",
  "verification_code_invalid",
  "verification_expired",
]);
const additionalRequirementPattern = /additional_signup_requirement/i;
const verificationPendingPattern = /verification_pending/i;
const invalidIdentifierMessagePattern =
  /identifier is invalid|email address is invalid|valid email/i;
const passwordPolicyMessagePattern =
  /password.*(?:too short|too weak|not strong|strong enough|must be|at least)|password.*compromised|password.*common/i;
const minimumPasswordLengthPattern =
  /(?:at least|minimum(?: length)?(?: is)?|min(?:imum)? of)\s*(\d+)\s*(?:characters?|chars?)/i;
const incorrectCodeMessagePattern =
  /verification code is incorrect|code is incorrect|invalid code/i;
const tooManyRequestsMessagePattern = /too many|rate limit|try again later/i;

const readClerkError = (error: unknown) => {
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
  const { code, message } = readClerkError(error);

  if (code === "form_identifier_exists") {
    // Keep registration responses generic to avoid confirming whether an
    // account exists. The sign-in route remains available in the page shell.
    return { message: fallbackError, existingAccount: false };
  }

  if (
    code === "additional_signup_requirement" ||
    additionalRequirementPattern.test(message)
  ) {
    return { message: additionalRequirementError, existingAccount: false };
  }

  if (
    code === "verification_pending" ||
    verificationPendingPattern.test(message)
  ) {
    return {
      message: "Digite o código de confirmação para continuar.",
      existingAccount: false,
    };
  }

  if (
    (code !== undefined && invalidIdentifierCodes.has(code)) ||
    invalidIdentifierMessagePattern.test(message)
  ) {
    return {
      message: "Informe um e-mail válido.",
      existingAccount: false,
    };
  }

  if (
    (code !== undefined && passwordPolicyCodes.has(code)) ||
    passwordPolicyMessagePattern.test(message)
  ) {
    const minimumLength = message.match(minimumPasswordLengthPattern)?.[1];

    return {
      message: minimumLength
        ? `A senha precisa ter pelo menos ${minimumLength} caracteres, conforme os requisitos da conta.`
        : "A senha não atende aos requisitos de segurança da conta. Escolha outra senha e tente novamente.",
      existingAccount: false,
    };
  }

  if (
    (code !== undefined && incorrectCodeCodes.has(code)) ||
    incorrectCodeMessagePattern.test(message)
  ) {
    return {
      message:
        "O código informado está incorreto ou expirou. Confira e tente novamente.",
      existingAccount: false,
    };
  }

  if (
    code === "too_many_requests" ||
    tooManyRequestsMessagePattern.test(message)
  ) {
    return {
      message:
        "Muitas tentativas em sequência. Espere um pouco e tente novamente.",
      existingAccount: false,
    };
  }

  return { message: fallbackError, existingAccount: false };
};

// Clerk remains the identity provider. The app creates the member/profile only
// after a finalized session and a successful server-side authentication guard.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: signup is a finite multi-step Clerk state machine with a single accessible form
export const SignUp = () => {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isSessionLoaded, session } = useSession();
  const { fetchStatus, signUp } = useSignUp();
  const isLoaded = isAuthLoaded && isSessionLoaded;
  const currentTaskKey = session?.currentTask?.key;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationTarget, setVerificationTarget] =
    useState<VerificationTarget>("email_address");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [step, setStep] = useState<SignUpStep>("form");
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

  if (!isLoaded || isSignedIn || fetchStatus !== "idle" || !signUp) {
    return <AuthLoadingState loadingLabel="Carregando cadastro…" />;
  }

  const activateSession = async () => {
    const { error } = await signUp.finalize({
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

  const continueSignUp = async () => {
    if (signUp.status === "complete") {
      await activateSession();
      return;
    }

    if (signUp.unverifiedFields.includes("email_address")) {
      const result = await signUp.verifications.sendEmailCode();
      if (result.error) {
        throw result.error;
      }

      setVerificationTarget("email_address");
      setStep("verification");
      return;
    }

    if (signUp.unverifiedFields.includes("phone_number")) {
      const result = await signUp.verifications.sendPhoneCode();
      if (result.error) {
        throw result.error;
      }

      setVerificationTarget("phone_number");
      setStep("verification");
      return;
    }

    if (signUp.status === "missing_requirements") {
      setStep("requirements");
      return;
    }

    throw new Error("additional_signup_requirement");
  };

  const handleCreateAccount = async () => {
    const { error } = await signUp.password({
      emailAddress: identifier.trim(),
      password,
    });

    if (error) {
      throw error;
    }

    await continueSignUp();
  };

  const handleVerifyContact = async () => {
    const result =
      verificationTarget === "email_address"
        ? await signUp.verifications.verifyEmailCode({
            code: verificationCode.trim(),
          })
        : await signUp.verifications.verifyPhoneCode({
            code: verificationCode.trim(),
          });

    if (result.error) {
      throw result.error;
    }

    setVerificationCode("");
    await continueSignUp();
  };

  const handleUpdateRequirements = async () => {
    const missingFields = new Set(signUp.missingFields);
    const update: {
      emailAddress?: string;
      firstName?: string;
      lastName?: string;
      legalAccepted?: boolean;
      phoneNumber?: string;
    } = {};

    if (
      missingFields.has("email_address") ||
      missingFields.has("email_address_or_phone_number")
    ) {
      update.emailAddress = identifier.trim();
    }
    if (missingFields.has("first_name")) {
      update.firstName = firstName.trim();
    }
    if (missingFields.has("last_name")) {
      update.lastName = lastName.trim();
    }
    if (missingFields.has("phone_number")) {
      update.phoneNumber = phoneNumber.trim();
    }
    if (missingFields.has("legal_accepted")) {
      update.legalAccepted = legalAccepted;
    }

    const { error } = await signUp.update(update);
    if (error) {
      throw error;
    }

    await continueSignUp();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (step === "verification") {
        await handleVerifyContact();
      } else if (step === "requirements") {
        await handleUpdateRequirements();
      } else {
        await handleCreateAccount();
      }
    } catch (error) {
      if (isActiveClerkSessionError(error)) {
        window.location.replace(getAuthRedirectPath(window.location.href));
        return;
      }

      setErrorMessage(getSignUpErrorState(error).message);
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
      const result =
        verificationTarget === "email_address"
          ? await signUp.verifications.sendEmailCode()
          : await signUp.verifications.sendPhoneCode();

      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      if (isActiveClerkSessionError(error)) {
        window.location.replace(getAuthRedirectPath(window.location.href));
        return;
      }

      setErrorMessage(getSignUpErrorState(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToForm = async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { error } = await signUp.reset();
      if (error) {
        throw error;
      }

      setStep("form");
      setVerificationCode("");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getSignUpErrorState(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const missingFields = new Set(signUp.missingFields);
  const knownMissingFields = new Set([
    "email_address",
    "email_address_or_phone_number",
    "first_name",
    "last_name",
    "phone_number",
    "legal_accepted",
  ]);
  const hasUnsupportedMissingField = [...missingFields].some(
    (field) => !knownMissingFields.has(field)
  );

  let primaryLabel = "Criar conta";
  if (isSubmitting) {
    primaryLabel = "Aguarde…";
  } else if (step === "verification") {
    primaryLabel = "Confirmar e continuar";
  } else if (step === "requirements") {
    primaryLabel = "Continuar cadastro";
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="interprete-login__form"
      onSubmit={handleSubmit}
    >
      {step !== "form" ? (
        <button
          className="interprete-login__back"
          disabled={isSubmitting}
          onClick={handleBackToForm}
          type="button"
        >
          ← Voltar para criar conta
        </button>
      ) : null}

      {step === "form" ||
      (step === "requirements" &&
        (missingFields.has("email_address") ||
          missingFields.has("email_address_or_phone_number"))) ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-sign-up-email">E-mail</label>
          <div className="interprete-login__input-wrap interprete-login__input-wrap--email">
            <input
              autoComplete="email"
              className="interprete-login__input"
              disabled={isSubmitting}
              id="interprete-sign-up-email"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="seu@email.com"
              required
              type="email"
              value={identifier}
            />
          </div>
        </div>
      ) : null}

      {step === "form" ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-sign-up-password">Senha</label>
          <div className="interprete-login__input-wrap interprete-login__input-wrap--password">
            <input
              autoComplete="new-password"
              className="interprete-login__input"
              disabled={isSubmitting}
              id="interprete-sign-up-password"
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
            Os requisitos da senha são verificados com segurança pelo Clerk.
          </p>
        </div>
      ) : null}

      {step === "verification" ? (
        <div className="interprete-login__field">
          <label htmlFor="interprete-sign-up-code">
            {verificationTarget === "email_address"
              ? "Código de confirmação do e-mail"
              : "Código de confirmação do telefone"}
          </label>
          <input
            autoComplete="one-time-code"
            className="interprete-login__input"
            disabled={isSubmitting}
            id="interprete-sign-up-code"
            inputMode="numeric"
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="Digite o código de confirmação"
            required
            value={verificationCode}
          />
          <p className="interprete-login__field-hint">
            Enviamos um código para confirmar este contato.
          </p>
        </div>
      ) : null}

      {step === "requirements" ? (
        <>
          {missingFields.has("first_name") ? (
            <div className="interprete-login__field">
              <label htmlFor="interprete-sign-up-first-name">Nome</label>
              <input
                autoComplete="given-name"
                className="interprete-login__input"
                disabled={isSubmitting}
                id="interprete-sign-up-first-name"
                onChange={(event) => setFirstName(event.target.value)}
                required
                value={firstName}
              />
            </div>
          ) : null}
          {missingFields.has("last_name") ? (
            <div className="interprete-login__field">
              <label htmlFor="interprete-sign-up-last-name">Sobrenome</label>
              <input
                autoComplete="family-name"
                className="interprete-login__input"
                disabled={isSubmitting}
                id="interprete-sign-up-last-name"
                onChange={(event) => setLastName(event.target.value)}
                required
                value={lastName}
              />
            </div>
          ) : null}
          {missingFields.has("phone_number") ? (
            <div className="interprete-login__field">
              <label htmlFor="interprete-sign-up-phone">Telefone</label>
              <input
                autoComplete="tel"
                className="interprete-login__input"
                disabled={isSubmitting}
                id="interprete-sign-up-phone"
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+55 11 99999-9999"
                required
                type="tel"
                value={phoneNumber}
              />
            </div>
          ) : null}
          {missingFields.has("legal_accepted") ? (
            <label className="interprete-login__field-hint flex items-start gap-2">
              <input
                checked={legalAccepted}
                disabled={isSubmitting}
                onChange={(event) => setLegalAccepted(event.target.checked)}
                required
                type="checkbox"
              />
              <span>
                Li e aceito os <a href="/termos-de-uso">Termos de uso</a> e o
                aviso de <a href="/privacidade">Privacidade</a>.
              </span>
            </label>
          ) : null}
          {hasUnsupportedMissingField ? (
            <div className="interprete-login__error" role="alert">
              <p>
                Esta conta exige uma informação adicional que não está
                disponível neste formulário. Fale com o suporte para continuar.
              </p>
              <a href="/suporte">Falar com o time</a>
            </div>
          ) : null}
        </>
      ) : null}

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

      <button
        className="interprete-login__submit"
        disabled={
          isSubmitting ||
          (step === "requirements" && hasUnsupportedMissingField)
        }
        type="submit"
      >
        <span>{primaryLabel}</span>
        <span aria-hidden="true">→</span>
      </button>

      {step === "verification" ? (
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
