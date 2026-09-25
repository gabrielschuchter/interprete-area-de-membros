import "server-only";

import { auth, currentUser } from "@repo/auth/server";
import { cache } from "react";

type AuthResult = Awaited<ReturnType<typeof auth>>;
type CurrentUserResult = Awaited<ReturnType<typeof currentUser>>;

export const getAuth = cache(async (): Promise<AuthResult> => auth());
export const getCurrentUser = cache(
  async (): Promise<CurrentUserResult> => currentUser()
);
