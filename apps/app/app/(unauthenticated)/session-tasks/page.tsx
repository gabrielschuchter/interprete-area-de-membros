import { getSafeInternalPath } from "@repo/auth/redirects";
import { SessionTaskContent } from "./session-task-content";

interface SessionTaskPageProperties {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SessionTaskPage = async ({ searchParams }: SessionTaskPageProperties) => {
  const params = await searchParams;
  const redirectUrl = params.redirect_url;
  const requestedPath = Array.isArray(redirectUrl)
    ? redirectUrl[0]
    : redirectUrl;
  const returnPath = getSafeInternalPath(
    requestedPath ?? "/",
    "https://interprete.invalid"
  );

  return <SessionTaskContent returnPath={returnPath} />;
};

export default SessionTaskPage;
