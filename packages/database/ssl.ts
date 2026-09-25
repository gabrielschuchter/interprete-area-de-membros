import { readFileSync } from "node:fs";
import path from "node:path";

// Public Supabase Root 2021 CA. Bundled as a final fallback because arbitrary
// certificate files are not guaranteed to be present in Vercel function output.
const bundledSupabaseRootCa = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

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
    path.resolve(
      process.cwd(),
      "../../packages/database/certs/supabase-prod-ca-2021.crt"
    ),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8").trim();
    } catch {
      // Try the next known location.
    }
  }

  return bundledSupabaseRootCa;
};

const ca = readCertificate();

export const normalizeRuntimeDatabaseUrl = (value: string) => {
  const url = new URL(value);

  // node-postgres replaces the explicit `ssl` config whenever these options
  // exist in the connection string. Remove them so the verified Supabase CA
  // from databaseSsl remains authoritative in serverless and migration jobs.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(key);
  }

  return url.toString();
};

export const databaseSsl = {
  rejectUnauthorized: true,
  ca,
};
