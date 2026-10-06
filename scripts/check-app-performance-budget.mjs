import { readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { findPerformanceBudgetViolations } from "./lib/app-performance-budget.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leadingSlashesPattern = /^[/\\]+/u;
const appRoot = join(repositoryRoot, "apps", "app");
const outputDirectory = resolve(
  appRoot,
  process.env.INTERPRETE_NEXT_DIST_DIR ?? ".next"
);
const budget = JSON.parse(
  await readFile(join(appRoot, "performance-budget.json"), "utf8")
);

const measureRoute = async (surface) => {
  const manifestPath = join(
    outputDirectory,
    "server",
    "app",
    ...surface.manifestSegments,
    "page_client-reference-manifest.js"
  );
  const source = await readFile(manifestPath, "utf8");
  const assignmentStart = source.indexOf(
    " = ",
    source.indexOf("globalThis.__RSC_MANIFEST[")
  );
  const assignmentEnd = source.lastIndexOf(";");
  if (assignmentStart < 0 || assignmentEnd <= assignmentStart) {
    throw new Error(
      `Unable to parse the Next.js client manifest for ${surface.route}.`
    );
  }

  const routeManifest = JSON.parse(
    source.slice(assignmentStart + 3, assignmentEnd)
  );
  const entry = Object.entries(routeManifest?.entryJSFiles ?? {}).find(
    ([entryPath]) => entryPath.endsWith(surface.entrySuffix)
  );
  if (!entry) {
    throw new Error(
      `No initial JavaScript entry was found for ${surface.route}.`
    );
  }

  const files = [...new Set(entry[1].filter((path) => path.endsWith(".js")))];
  const gzipBytes = await Promise.all(
    files.map(async (file) => {
      const normalized = file
        .replaceAll("/", sep)
        .replace(leadingSlashesPattern, "");
      const chunk = await readFile(join(outputDirectory, normalized));
      return gzipSync(chunk, { level: 9 }).byteLength;
    })
  );

  return {
    route: surface.route,
    gzipBytes: gzipBytes.reduce((total, bytes) => total + bytes, 0),
    chunks: files.length,
  };
};

const measurements = await Promise.all(budget.criticalRoutes.map(measureRoute));
for (const measurement of measurements) {
  const routeBudget = budget.criticalRoutes.find(
    ({ route }) => route === measurement.route
  );
  console.log(
    `[performance] ${measurement.route}: ${(measurement.gzipBytes / 1024).toFixed(1)} KiB gzip across ${measurement.chunks} chunks (budget ${(routeBudget.maxGzipBytes / 1024).toFixed(1)} KiB)`
  );
}

const violations = findPerformanceBudgetViolations(measurements, budget);
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`[performance] ${violation}`);
  }
  process.exitCode = 1;
}
