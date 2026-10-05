const GREEN_PROJECT_REF = "qffqhilydtnrggbcnogh";
const DATABASE_PATH_PREFIX = /^\//;

export const parseGreenSessionPoolerUrl = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("SUPABASE_GREEN_DIRECT_URL is missing.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SUPABASE_GREEN_DIRECT_URL is not a valid PostgreSQL URI.");
  }

  let username;
  let database;
  try {
    username = decodeURIComponent(url.username);
    database = decodeURIComponent(
      url.pathname.replace(DATABASE_PATH_PREFIX, "")
    );
  } catch {
    throw new Error("The green PostgreSQL URI has invalid encoding.");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    username !== `postgres.${GREEN_PROJECT_REF}` ||
    !url.hostname.endsWith(".pooler.supabase.com") ||
    url.hostname.includes("wkclodjbrynerfgufmyb") ||
    url.port !== "5432" ||
    database !== "postgres" ||
    !url.password
  ) {
    throw new Error(
      "Green guard failed; expected the destination project's Supavisor session pooler on port 5432."
    );
  }

  return url;
};
