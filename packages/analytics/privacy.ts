const communityShareCapabilityPattern =
  /\/comunidade\/compartilhar\/[A-Za-z0-9_-]{43}(?:[/?#]|$)/i;

export const containsCommunityPostShareCapability = (
  value: unknown,
  depth = 0
): boolean => {
  if (depth > 4 || value == null) {
    return false;
  }
  if (typeof value === "string") {
    let candidate = value;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (communityShareCapabilityPattern.test(candidate)) {
        return true;
      }
      try {
        const decoded = decodeURIComponent(candidate);
        if (decoded === candidate) {
          break;
        }
        candidate = decoded;
      } catch {
        break;
      }
    }
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsCommunityPostShareCapability(item, depth + 1)
    );
  }
  if (typeof value === "object") {
    return Object.values(value).some((item) =>
      containsCommunityPostShareCapability(item, depth + 1)
    );
  }
  return false;
};
