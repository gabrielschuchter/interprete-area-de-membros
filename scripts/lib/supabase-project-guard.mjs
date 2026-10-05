export const isSupabaseProjectConnection = (value, projectRef) => {
  if (!(typeof value === "string" && value && projectRef)) {
    return false;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const normalizedRef = projectRef.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === `${normalizedRef}.supabase.co` ||
    hostname === `db.${normalizedRef}.supabase.co`
  ) {
    return true;
  }

  let username = url.username;
  try {
    username = decodeURIComponent(username);
  } catch {
    // Keep the encoded value; it cannot match the plain project ref below.
  }

  return username.toLowerCase().endsWith(`.${normalizedRef}`);
};

export const assertNotSupabaseProject = ({
  databaseUrl,
  operation,
  projectRef,
  supabaseUrl,
}) => {
  if (
    isSupabaseProjectConnection(databaseUrl, projectRef) ||
    isSupabaseProjectConnection(supabaseUrl, projectRef)
  ) {
    throw new Error(
      `${operation} is disabled for Supabase project ${projectRef}; restore the audited database snapshot and keep large recordings external.`
    );
  }
};
