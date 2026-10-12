import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveDevelopmentAuthUserId } from "./development-auth-config";

const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const getDevelopmentAuthSession = async () => {
  const userId = resolveDevelopmentAuthUserId({
    enabled: process.env.GESTAO_DEV_AUTH,
    publicEnabled: process.env.NEXT_PUBLIC_GESTAO_DEV_AUTH,
    nodeEnv: process.env.NODE_ENV,
    userId: process.env.GESTAO_DEV_AUTH_USER_ID,
  });

  if (!userId) {
    return null;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  let hostname = "";
  try {
    hostname = host ? new URL(`http://${host}`).hostname.toLowerCase() : "";
  } catch {
    hostname = "";
  }
  if (!loopbackHostnames.has(hostname)) {
    throw new Error(
      "GESTAO_DEV_AUTH accepts requests only from a loopback host."
    );
  }

  return {
    userId,
    isAuthenticated: true,
    redirectToSignIn: () => redirect("/sign-in"),
    redirectToSignUp: () => redirect("/sign-up"),
  };
};
