import assert from "node:assert/strict";
import test from "node:test";
import { validateGestaoSeedEnvironment } from "../../packages/database/gestao-seed-guard.mjs";

const errorContains = (text) => (error) =>
  error instanceof Error && error.message.includes(text);

const makeEnvironment = (overrides = {}) => ({
  nodeEnv: "development",
  seedDevelopmentData: "true",
  profile: "functional",
  databaseUrls: [
    {
      name: "DATABASE_URL",
      value:
        "postgresql://127.0.0.1:55433/interprete_gestao_qa_20261012?sslmode=verify-full",
    },
  ],
  ...overrides,
});

test("requires development mode and the explicit seed flag", () => {
  assert.throws(
    () =>
      validateGestaoSeedEnvironment(makeEnvironment({ nodeEnv: "production" })),
    errorContains("NODE_ENV=development")
  );
  assert.throws(
    () =>
      validateGestaoSeedEnvironment(
        makeEnvironment({ seedDevelopmentData: "false" })
      ),
    errorContains("SEED_DEVELOPMENT_DATA=true")
  );
});

test("requires an explicit profile and a configured local database", () => {
  assert.throws(
    () => validateGestaoSeedEnvironment(makeEnvironment({ profile: "" })),
    errorContains("GESTAO_SEED_PROFILE")
  );
  assert.throws(
    () => validateGestaoSeedEnvironment(makeEnvironment({ databaseUrls: [] })),
    errorContains("isolated local QA database")
  );
});

test("accepts only the functional profile's loopback QA database", () => {
  const result = validateGestaoSeedEnvironment(makeEnvironment());
  assert.equal(result.databaseName, "interprete_gestao_qa_20261012");
  assert.equal(result.profile, "functional");
  assert.throws(
    () => validateGestaoSeedEnvironment(makeEnvironment({ profile: "visual" })),
    errorContains("interprete_gestao_visual_qa_20261012")
  );
});

test("accepts the isolated visual QA database and prefers the runtime URL", () => {
  const result = validateGestaoSeedEnvironment(
    makeEnvironment({
      profile: "visual",
      databaseUrls: [
        {
          name: "DATABASE_URL",
          value:
            "postgresql://127.0.0.1:55433/interprete_gestao_visual_qa_20261012?sslmode=verify-full",
        },
        {
          name: "DIRECT_URL",
          value:
            "postgresql://127.0.0.1:55433/interprete_gestao_visual_qa_20261012?sslmode=verify-full",
        },
      ],
    })
  );
  assert.equal(result.profile, "visual");
  assert.equal(result.databaseName, "interprete_gestao_visual_qa_20261012");
  assert.ok(result.connectionString.includes("sslmode=verify-full"));
});

test("rejects remote hosts, alternate ports, mismatched URLs, and disabled TLS", () => {
  const withUrl = (value) =>
    makeEnvironment({
      databaseUrls: [{ name: "DATABASE_URL", value }],
    });
  assert.throws(
    () =>
      validateGestaoSeedEnvironment(
        withUrl(
          "postgresql://db.example.test:55433/interprete_gestao_qa_20261012"
        )
      ),
    errorContains("isolated loopback QA server")
  );
  assert.throws(
    () =>
      validateGestaoSeedEnvironment(
        withUrl("postgresql://127.0.0.1:5432/interprete_gestao_qa_20261012")
      ),
    errorContains("port 55433")
  );
  assert.throws(
    () =>
      validateGestaoSeedEnvironment(
        withUrl(
          "postgresql://127.0.0.1:55433/interprete_gestao_qa_20261012?sslmode=disable"
        )
      ),
    errorContains("cannot disable TLS")
  );
  assert.throws(
    () =>
      validateGestaoSeedEnvironment(
        makeEnvironment({
          databaseUrls: [
            {
              name: "DATABASE_URL",
              value:
                "postgresql://127.0.0.1:55433/interprete_gestao_qa_20261012",
            },
            {
              name: "DIRECT_URL",
              value:
                "postgresql://127.0.0.1:55433/interprete_gestao_visual_qa_20261012",
            },
          ],
        })
      ),
    errorContains("same local QA database")
  );
});
