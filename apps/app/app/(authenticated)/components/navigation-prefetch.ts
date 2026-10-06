const MAX_INTENT_PREFETCHES_PER_ROUTE = 2;

let budgetRoute: string | null = null;
let prefetchedDestinations = new Set<string>();

export const canPrefetchForConnection = (connection?: {
  readonly effectiveType?: string;
  readonly saveData?: boolean;
}) =>
  !connection?.saveData &&
  connection?.effectiveType !== "slow-2g" &&
  connection?.effectiveType !== "2g";

/**
 * Bounds speculative work from the persistent sidebar. Next does not expose a
 * prefetch-complete signal, so the budget resets only after route navigation.
 */
export const reserveNavigationPrefetch = (
  route: string,
  destination: string
) => {
  const connection =
    typeof navigator === "undefined"
      ? undefined
      : (
          navigator as Navigator & {
            connection?: {
              effectiveType?: string;
              saveData?: boolean;
            };
          }
        ).connection;
  if (!canPrefetchForConnection(connection)) {
    return false;
  }

  if (budgetRoute !== route) {
    budgetRoute = route;
    prefetchedDestinations = new Set();
  }

  if (
    prefetchedDestinations.has(destination) ||
    prefetchedDestinations.size >= MAX_INTENT_PREFETCHES_PER_ROUTE
  ) {
    return false;
  }

  prefetchedDestinations.add(destination);
  return true;
};

export const resetNavigationPrefetchBudget = () => {
  budgetRoute = null;
  prefetchedDestinations = new Set();
};
