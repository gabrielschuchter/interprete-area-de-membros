const QA_HOSTS = new Set(["127.0.0.1", "[::1]"]);
const QA_PORT = "55433";
const pathLeadingSlashPattern = /^\//u;
const PROFILE_DATABASE = Object.freeze({
  functional: "interprete_gestao_qa_20261012",
  visual: "interprete_gestao_visual_qa_20261012",
});

const parseDatabaseUrl = (name, value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${name} must use PostgreSQL.`);
  }
  if (!QA_HOSTS.has(url.hostname)) {
    throw new Error(`${name} must target the isolated loopback QA server.`);
  }
  if (url.port !== QA_PORT) {
    throw new Error(`${name} must target the isolated QA port ${QA_PORT}.`);
  }
  if (url.searchParams.get("sslmode")?.toLowerCase() === "disable") {
    throw new Error(`${name} cannot disable TLS verification.`);
  }

  const databaseName = decodeURIComponent(
    url.pathname.replace(pathLeadingSlashPattern, "")
  );
  if (!databaseName) {
    throw new Error(`${name} must select an explicit QA database.`);
  }

  return { databaseName, hostname: url.hostname, port: url.port };
};

export const validateGestaoSeedEnvironment = ({
  nodeEnv,
  seedDevelopmentData,
  profile,
  databaseUrls,
}) => {
  if (nodeEnv !== "development") {
    throw new Error("Gestão QA seeds require NODE_ENV=development.");
  }
  if (seedDevelopmentData !== "true") {
    throw new Error(
      "Set SEED_DEVELOPMENT_DATA=true to run the Gestão QA seed."
    );
  }
  if (!Object.hasOwn(PROFILE_DATABASE, profile)) {
    throw new Error("Set GESTAO_SEED_PROFILE to exactly functional or visual.");
  }

  const configuredUrls = (databaseUrls ?? []).filter(
    (entry) => typeof entry?.value === "string" && entry.value.length > 0
  );
  if (configuredUrls.length === 0) {
    throw new Error(
      "Configure DATABASE_URL or DIRECT_URL for the isolated local QA database."
    );
  }

  const targets = configuredUrls.map(({ name, value }) =>
    parseDatabaseUrl(name, value)
  );
  const target = targets[0];
  if (
    targets.some(
      (candidate) =>
        candidate.hostname !== target.hostname ||
        candidate.port !== target.port ||
        candidate.databaseName !== target.databaseName
    )
  ) {
    throw new Error(
      "All configured database URLs must target the same local QA database."
    );
  }

  const expectedDatabase = PROFILE_DATABASE[profile];
  if (target.databaseName !== expectedDatabase) {
    throw new Error(
      `The ${profile} profile requires local database ${expectedDatabase}.`
    );
  }

  const connection =
    configuredUrls.find(({ name }) => name === "DATABASE_URL") ??
    configuredUrls.find(({ name }) => name === "DIRECT_URL") ??
    configuredUrls[0];

  return {
    connectionString: connection.value,
    databaseName: target.databaseName,
    profile,
  };
};
