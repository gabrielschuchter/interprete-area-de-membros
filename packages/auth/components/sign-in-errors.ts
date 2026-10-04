export { getAuthRedirectPath } from "../redirects";

interface ClerkErrorItem {
  code?: string;
  longMessage?: string;
  message?: string;
}

interface ClerkError {
  errors?: ClerkErrorItem[];
}

const activeSessionCodes = new Set([
  "session_exists",
  "session_already_exists",
  "already_signed_in",
]);

const accountNotFoundCodes = new Set([
  "form_identifier_not_found",
  "form_password_or_identifier_incorrect",
]);

const invalidCredentialCodes = new Set([
  "form_password_incorrect",
  "form_identifier_not_found",
  "form_password_or_identifier_incorrect",
]);

const genericCredentialError =
  "E-mail ou telefone e senha não correspondem. Confira os dados e tente novamente.";
const genericError =
  "Não foi possível concluir esta etapa. Tente novamente em alguns instantes.";
const incorrectCodeError =
  "O código informado está incorreto ou expirou. Confira e tente novamente.";
const activeSessionMessagePattern =
  /already (?:signed|logged|authenticated) in|session already exists|currently signed in/i;
const accountNotFoundMessagePattern =
  /couldn.t find your account|account could not be found|identifier.*not found/i;
const minimumPasswordLengthPattern =
  /(?:at least|minimum(?: length)?(?: is)?|min(?:imum)? of)\s*(\d+)\s*(?:characters?|chars?)/i;
const passwordPolicyMessagePattern =
  /password.*(?:too short|too weak|not strong|must be|at least|minimum|compromised|common)/i;
const expiredSessionMessagePattern =
  /session (?:has )?(?:expired|is invalid)|session token.*(?:expired|invalid)|you are signed out/i;
const invalidCredentialMessagePattern =
  /password is incorrect|incorrect password|password.*incorrect|couldn.t find your account|account could not be found|identifier.*not found/i;
const incorrectCodeMessagePattern =
  /verification code is incorrect|code is incorrect|incorrect (?:verification )?code|invalid code/i;
const invalidIdentifierMessagePattern =
  /identifier is invalid|email address is invalid|valid email/i;
const tooManyRequestsMessagePattern = /too many|rate limit|try again later/i;

const readClerkError = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return { code: undefined, message: "" };
  }

  const clerkError = error as ClerkError;
  const firstError = clerkError.errors?.[0];

  return {
    code: firstError?.code,
    // Clerk's text is used only to classify known states. It is never surfaced
    // verbatim, since it can contain internal details or change by locale.
    message: firstError?.longMessage ?? firstError?.message ?? "",
  };
};

export const isActiveClerkSessionError = (error: unknown) => {
  const { code, message } = readClerkError(error);

  return (
    (code !== undefined && activeSessionCodes.has(code)) ||
    activeSessionMessagePattern.test(message)
  );
};

export const isUnknownAccountError = (error: unknown) => {
  const { code, message } = readClerkError(error);

  return (
    (code !== undefined && accountNotFoundCodes.has(code)) ||
    accountNotFoundMessagePattern.test(message)
  );
};

const getPasswordPolicyMessage = (message: string) => {
  const minimumLength = message.match(minimumPasswordLengthPattern)?.[1];

  if (minimumLength) {
    return `A senha precisa ter pelo menos ${minimumLength} caracteres, conforme os requisitos da conta.`;
  }

  if (passwordPolicyMessagePattern.test(message)) {
    return "A senha não atende aos requisitos de segurança da conta. Escolha outra senha e tente novamente.";
  }

  return undefined;
};

export const getSignInErrorState = (error: unknown) => {
  const { code, message } = readClerkError(error);

  if (isActiveClerkSessionError(error)) {
    return { activeSession: true, message: "" };
  }

  if (
    code === "session_expired" ||
    code === "session_invalid" ||
    expiredSessionMessagePattern.test(message)
  ) {
    return {
      activeSession: false,
      message:
        "Sua sessão expirou ou não é mais válida. Entre novamente para continuar.",
    };
  }

  if (
    (code !== undefined && invalidCredentialCodes.has(code)) ||
    invalidCredentialMessagePattern.test(message)
  ) {
    return { activeSession: false, message: genericCredentialError };
  }

  if (
    code === "verification_code_incorrect" ||
    code === "verification_code_invalid" ||
    incorrectCodeMessagePattern.test(message)
  ) {
    return { activeSession: false, message: incorrectCodeError };
  }

  const passwordPolicyMessage = getPasswordPolicyMessage(message);
  if (passwordPolicyMessage) {
    return { activeSession: false, message: passwordPolicyMessage };
  }

  if (
    code === "form_identifier_invalid" ||
    code === "form_param_format_invalid" ||
    invalidIdentifierMessagePattern.test(message)
  ) {
    return {
      activeSession: false,
      message: "Informe um e-mail ou telefone válido.",
    };
  }

  if (
    code === "too_many_requests" ||
    tooManyRequestsMessagePattern.test(message)
  ) {
    return {
      activeSession: false,
      message:
        "Muitas tentativas em sequência. Espere um pouco e tente novamente.",
    };
  }

  return { activeSession: false, message: genericError };
};

export const getPasswordRecoveryErrorState = (error: unknown) => {
  if (isUnknownAccountError(error)) {
    return {
      activeSession: false,
      message:
        "Se houver uma conta com esses dados, enviaremos um código de recuperação.",
      accountMayNotExist: true,
    };
  }

  return {
    ...getSignInErrorState(error),
    accountMayNotExist: false,
  };
};
