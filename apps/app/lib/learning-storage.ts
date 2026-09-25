import "server-only";

const TRAILING_SLASH = /\/$/;

const storageConfig = () => ({
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  secretKey:
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "learning-assets",
});

const encodePath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const createLearningAssetSignedUrl = async (
  storagePath: string,
  expiresIn = 60
) => {
  const { supabaseUrl, secretKey, bucket } = storageConfig();

  if (!(supabaseUrl && secretKey)) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl.replace(TRAILING_SLASH, "")}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        apikey: secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { signedURL?: string };
  if (!payload.signedURL) {
    return null;
  }

  return payload.signedURL.startsWith("http")
    ? payload.signedURL
    : `${supabaseUrl.replace(TRAILING_SLASH, "")}/storage/v1${payload.signedURL}`;
};
