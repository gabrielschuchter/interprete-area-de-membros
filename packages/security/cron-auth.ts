import { timingSafeEqual } from "node:crypto";

const minimumCronSecretLength = 32;

export const isAuthorizedCronRequest = (
  request: Request,
  expectedSecret: string | undefined
) => {
  if (
    !expectedSecret ||
    expectedSecret.trim().length < minimumCronSecretLength
  ) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedSecret);

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
};
