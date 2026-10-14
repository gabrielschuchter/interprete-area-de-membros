import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const qaDatabases = {
  functional: "interprete_gestao_qa_20261012",
  visual: "interprete_gestao_visual_qa_20261012",
};

const isLoopbackHost = (hostname) =>
  hostname === "localhost" || hostname === "127.0.0.1";

async function assertPortAvailable(hostname, port) {
  await new Promise((resolvePort, rejectPort) => {
    const socket = createConnection({ host: hostname, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPort(new Error(`Não foi possível verificar com segurança a porta QA ${port}.`));
    }, 1500);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      rejectPort(
        new Error(
          `A porta QA ${port} já está em uso. Preserve o processo existente e escolha outra porta/distDir isolados.`,
        ),
      );
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      socket.destroy();
      if (error.code === "ECONNREFUSED") {
        resolvePort();
        return;
      }
      rejectPort(new Error(`Não foi possível verificar com segurança a porta QA ${port}.`, { cause: error }));
    });
  });
}

export function createGestaoLocalRuntime({
  origin = "http://127.0.0.1:3002",
  distDir = ".next-local-a2",
  caPath,
  outputDirectory,
}) {
  assert.equal(process.platform, "win32", "Gestão QA runtime currently targets Windows");
  const base = new URL(origin);
  assert.equal(base.protocol, "http:");
  assert(isLoopbackHost(base.hostname), "QA must bind to a loopback address");
  assert.equal(base.port, "3002", "The application preview owns port 3000");
  assert.match(distDir, /^\.next-local-[a-z0-9-]+$/);
  assert(caPath, "The verified local database CA path is required");
  assert(outputDirectory, "A per-run output directory is required");

  const appRoot = resolve("apps/app");
  let child;
  let actorKey;

  const stop = async () => {
    if (!child) {
      return;
    }

    const current = child;
    child = undefined;
    actorKey = undefined;
    if (current.exitCode !== null || current.signalCode !== null) {
      return;
    }

    await new Promise((resolveStop, rejectStop) => {
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(current.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" },
      );
      killer.once("error", rejectStop);
      killer.once("exit", (code) => {
        if (code !== 0 && current.exitCode === null) {
          rejectStop(
            new Error(`Não foi possível encerrar o runtime QA próprio (${current.pid}).`),
          );
          return;
        }
        resolveStop();
      });
    });
  };

  const start = async (actor, profile, logPath) => {
    assert.match(actor, /^(?:admin|teacher_[12]|student_\d{2})$/);
    assert(Object.hasOwn(qaDatabases, profile), "Select an explicit local QA profile");
    assert(logPath, "A per-actor QA log path is required");

    const nextActorKey = `${profile}:${actor}`;
    if (child && actorKey === nextActorKey) {
      return child;
    }
    await stop();
    await assertPortAvailable(base.hostname, Number(base.port));
    await mkdir(outputDirectory, { recursive: true });
    await mkdir(dirname(logPath), { recursive: true });

    const logFd = openSync(logPath, "a");
    try {
      child = spawn(
        process.execPath,
        [
          "scripts/run-next-with-system-ca.mjs",
          "dev",
          "--webpack",
          "--hostname",
          "127.0.0.1",
          "-p",
          base.port,
        ],
        {
          cwd: appRoot,
          windowsHide: true,
          detached: false,
          stdio: ["ignore", logFd, logFd],
          env: {
            ...process.env,
            INTERPRETE_LOCAL_DIST_DIR: distDir,
            NODE_ENV: "development",
            NODE_OPTIONS: "--use-system-ca",
            SKIP_ENV_VALIDATION: "true",
            DATABASE_URL: `postgresql://postgres@127.0.0.1:55433/${qaDatabases[profile]}?connection_limit=2`,
            DIRECT_URL: `postgresql://postgres@127.0.0.1:55433/${qaDatabases[profile]}?connection_limit=2`,
            DATABASE_CA_CERT_PATH: caPath,
            GESTAO_DEV_AUTH: "true",
            NEXT_PUBLIC_GESTAO_DEV_AUTH: "true",
            GESTAO_DEV_AUTH_USER_ID: `gestao_qa_${profile}_${actor}`,
            GESTAO_V2_ENABLED: "true",
            NEXT_PUBLIC_APP_URL: origin,
            NEXT_PUBLIC_API_URL: "http://localhost:3001",
          },
        },
      );
    } finally {
      closeSync(logFd);
    }

    actorKey = nextActorKey;
    const owned = child;
    owned.once("error", () => {
      if (child === owned) {
        child = undefined;
        actorKey = undefined;
      }
    });

    const deadline = Date.now() + 60_000;
    try {
      while (Date.now() < deadline) {
        assert.equal(owned.exitCode, null, "Owned QA runtime exited during startup");
        try {
          const response = await fetch(`${origin}/health`, {
            signal: AbortSignal.timeout(1000),
          });
          if (response.ok && (await response.json()).checks?.database === "ok") {
            return owned;
          }
        } catch {
          // Poll only the runtime this harness started.
        }
        await delay(500);
      }
      throw new Error("Owned QA runtime did not become ready within 60 seconds");
    } catch (error) {
      await stop();
      throw error;
    }
  };

  return { start, stop };
}
