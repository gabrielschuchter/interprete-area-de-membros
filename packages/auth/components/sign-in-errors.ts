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

const activeSessionCodes = new Set([
  "session_exists",
  "session_already_exists",
  "already_signed_in",
]);

const incorrectPasswordPattern =
  /password is incorrect|incorrect password|password.*incorrect/i;
const missingAccountPattern =
  /couldn.t find your account|account could not be found/i;
const invalidIdentifierPattern =
  /identifier is invalid|email address is invalid/i;
const incorrectCodePattern =
  /verification code is incorrect|code is incorrect|incorrect (?:verification )?code/i;
const genericClerkErrorPattern = /something went wrong|internal error/i;
const activeSessionPattern =
  /already (?:signed|logged|authenticated) in|session already exists|currently signed in/i;
const expiredSessionPattern =
  /session (?:has )?(?:expired|is invalid)|session token.*(?:expired|invalid)|you are signed out/i;
const passwordRequirementPattern =
  /password.*(?:too short|too weak|not strong|must be|at least|minimum|compromised|common)/i;
const minimumPasswordLengthPattern =
  /(?:at least|minimum(?: length)?(?: is)?|min(?:imum)? of)\s*(\d+)\s*(?:characters?|chars?)/i;
const signedOutPattern = /you are signed out/i;

export const isActiveClerkSessionError = (error: unknown) => {
  const clerkError = (
    typeof error === "object" && error !== null ? error : {}
  ) as ClerkError;
  const firstError = clerkError.errors?.[0];
  const message =
    firstError?.longMessage ??
    firstError?.message ??
    clerkError.longMessage ??
    clerkError.message ??
    "";

  return (
    (firstError?.code !== undefined &&
      activeSessionCodes.has(firstError.code)) ||
    activeSessionPattern.test(message)
  );
};

export const getAuthRedirectPath = (currentHref: string) => {
  try {
    const currentUrl = new URL(currentHref);
    const redirectUrl = currentUrl.searchParams.get("redirect_url");

    if (!redirectUrl) {
      return "/";
    }

    const targetUrl = new URL(redirectUrl, currentUrl.origin);

    if (targetUrl.origin !== currentUrl.origin) {
      return "/";
    }

    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  } catch {
    return "/";
  }
};

export const getSignInErrorState = (error: unknown) => {
  const clerkError = (
    typeof error === "object" && error !== null ? error : {}
  ) as ClerkError;
  const firstError = clerkError.errors?.[0];
  const message =
    firstError?.longMessage ??
    firstError?.message ??
    clerkError.longMessage ??
    clerkError.message ??
    "";

  if (isActiveClerkSessionError(error)) {
    return { activeSession: true, message: "" };
  }

  if (expiredSessionPattern.test(message)) {
    return {
      activeSession: false,
      message:
        "Sua sessão expirou ou não é mais válida. Entre novamente para continuar.",
    };
  }

  const translations: [RegExp, string][] = [
    [incorrectPasswordPattern, "A senha está incorreta. Tente novamente."],
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
  const translated = translations.find(([pattern]) =>
    pattern.test(message)
  )?.[1];
  const minimumLength = message.match(minimumPasswordLengthPattern)?.[1];
  let passwordMessage: string | undefined;

  if (minimumLength) {
    passwordMessage = `A senha precisa ter pelo menos ${minimumLength} caracteres.`;
  } else if (passwordRequirementPattern.test(message)) {
    passwordMessage =
      "A senha não atende aos requisitos de segurança da conta. Escolha outra senha e tente novamente.";
  }

  let fallbackMessage = message;

  if (!fallbackMessage || signedOutPattern.test(fallbackMessage)) {
    fallbackMessage =
      "Não foi possível validar o acesso. Tente novamente ou atualize a página.";
  }

  return {
    activeSession: false,
    message: translated ?? passwordMessage ?? fallbackMessage,
  };
};
