import { spawn } from "node:child_process";
import { resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";

const supportedSystemCaVersions = [
  { major: 22, minor: 19 },
  { major: 23, minor: 8 },
  { major: 24, minor: 6 },
];

export function supportsSystemCa(nodeVersion, platform = process.platform) {
  const [major, minor] = nodeVersion.split(".").map(Number);

  if (major > 24) {
    return true;
  }

  return supportedSystemCaVersions.some(
    (supported) =>
      supported.major === major &&
      minor >=
        (major === 23 && platform !== "win32" && platform !== "darwin"
          ? 9
          : supported.minor)
  );
}

export function getNextRuntimeConfiguration({
  args,
  cwd,
  env,
  nodeVersion,
  platform,
}) {
  if (!supportsSystemCa(nodeVersion, platform)) {
    throw new Error(
      "O runtime local do Interprete precisa de Node.js 22.19+, 24.6+ ou uma versão mais nova para validar a CA do sistema."
    );
  }

  return {
    command: process.execPath,
    args: [
      "--use-system-ca",
      (platform === "win32" ? win32.resolve : resolve)(
        cwd,
        "node_modules/next/dist/bin/next"
      ),
      ...args,
    ],
    env: { ...env, NODE_USE_SYSTEM_CA: "1" },
  };
}

function main() {
  const [mode, ...args] = process.argv.slice(2);

  if (mode !== "dev" && mode !== "start") {
    console.error(
      "Uso: node scripts/run-next-with-system-ca.mjs <dev|start> [opções do Next]"
    );
    process.exitCode = 2;
    return;
  }

  let configuration;

  try {
    configuration = getNextRuntimeConfiguration({
      args: [mode, ...args],
      cwd: process.cwd(),
      env: process.env,
      nodeVersion: process.versions.node,
      platform: process.platform,
    });
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Não foi possível iniciar o Next.js local."
    );
    process.exitCode = 1;
    return;
  }

  const child = spawn(configuration.command, configuration.args, {
    env: configuration.env,
    stdio: "inherit",
  });

  child.on("error", () => {
    console.error("Não foi possível iniciar o runtime Node.js do Next.js.");
    process.exitCode = 1;
  });

  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
