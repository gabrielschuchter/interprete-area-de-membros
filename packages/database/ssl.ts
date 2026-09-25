import { readFileSync } from "node:fs";
import path from "node:path";

const readCertificate = () => {
  if (process.env.DATABASE_CA_CERT?.trim()) {
    return process.env.DATABASE_CA_CERT.trim();
  }

  const candidates = [
    process.env.DATABASE_CA_CERT_PATH,
    path.resolve(
      process.cwd(),
      "packages/database/certs/supabase-prod-ca-2021.crt"
    ),
    path.resolve(process.cwd(), "certs/supabase-prod-ca-2021.crt"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8").trim();
    } catch {
      // Try the next known location.
    }
  }

  return undefined;
};

const ca = readCertificate();

export const databaseSsl = {
  rejectUnauthorized: true,
  ...(ca ? { ca } : {}),
};
