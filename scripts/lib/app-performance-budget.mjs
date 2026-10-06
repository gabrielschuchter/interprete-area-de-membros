export const findPerformanceBudgetViolations = (measurements, budgets) => {
  const violations = [];
  const measuredRoutes = new Set(measurements.map(({ route }) => route));

  for (const expectedRoute of budgets.criticalRoutes) {
    if (!measuredRoutes.has(expectedRoute.route)) {
      violations.push(
        `Missing performance measurement for ${expectedRoute.route}.`
      );
    }
  }

  for (const measurement of measurements) {
    const routeBudget = budgets.criticalRoutes.find(
      ({ route }) => route === measurement.route
    );
    if (!routeBudget) {
      continue;
    }
    if (measurement.gzipBytes > routeBudget.maxGzipBytes) {
      violations.push(
        `${measurement.route} initial JavaScript is ${measurement.gzipBytes} bytes gzip; budget is ${routeBudget.maxGzipBytes}.`
      );
    }
  }

  return violations;
};
