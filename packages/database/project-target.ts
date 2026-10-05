const projectReference = /^[a-z]{20}$/;

/** Non-secret runtime attestation. Never returns the connection URI or password. */
export const databaseProjectRef = (): string | null => {
  const value = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;
  if (!value) {
    return null;
  }
  try {
    const uri = new URL(value);
    let candidate: string | null | undefined = null;
    if (uri.hostname.endsWith(".pooler.supabase.com")) {
      candidate = decodeURIComponent(uri.username).split(".").at(-1);
    } else if (
      uri.hostname.startsWith("db.") &&
      uri.hostname.endsWith(".supabase.co")
    ) {
      candidate = uri.hostname.split(".")[1];
    }
    return candidate && projectReference.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
};
