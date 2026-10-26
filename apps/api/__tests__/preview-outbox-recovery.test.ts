import { afterEach, expect, test, vi } from "vitest";
import { recoverPreviewOutbox } from "../lib/preview-outbox-recovery";

const previewSecret = "p".repeat(44);
const oidcToken = "test-platform-oidc-token";
const configuration = {
  enabled: true,
  environment: "production",
  namespace: undefined,
  secret: previewSecret,
};
const request = (token: string | undefined = oidcToken) =>
  new Request("https://canonical.example.test/cron/outbox", {
    headers: {
      authorization: "Bearer canonical-secret-never-forwarded",
      ...(token && { "x-vercel-oidc-token": token }),
    },
  });

afterEach(() => vi.useRealTimers());

test.each([
  { enabled: false },
  { environment: "preview" },
  { environment: "development" },
  { environment: undefined },
  { namespace: "preview" },
])("does not recover Preview outside the canonical enabled Production caller: %j", async (override) => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    await recoverPreviewOutbox(
      request(),
      { ...configuration, ...override },
      0,
      fetcher
    )
  ).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});

test("uses only the fixed Preview endpoint and its own exact bearer with platform OIDC", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 200 }));
  expect(
    await recoverPreviewOutbox(request(), configuration, 0, fetcher)
  ).toEqual({ status: "succeeded" });
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe(
    "https://interprete-area-de-membro-git-afba70-gabrielschuchters-projects.vercel.app/cron/outbox"
  );
  expect(options).toMatchObject({
    method: "POST",
    redirect: "error",
    cache: "no-store",
  });
  const headers = new Headers(options?.headers);
  expect(headers.get("authorization")).toBe(`Bearer ${previewSecret}`);
  expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe(oidcToken);
  expect(headers.has("x-vercel-oidc-token")).toBe(false);
  expect(options?.signal).toBeInstanceOf(AbortSignal);
});

test.each([
  undefined,
  "short",
])("does not fetch with an absent or short Preview secret", async (secret) => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    await recoverPreviewOutbox(
      request(),
      { ...configuration, secret },
      0,
      fetcher
    )
  ).toEqual({ status: "failed", reason: "configuration" });
  expect(fetcher).not.toHaveBeenCalled();
});

test("does not fetch without the platform OIDC token", async () => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    await recoverPreviewOutbox(request(""), configuration, 0, fetcher)
  ).toEqual({ status: "failed", reason: "oidc" });
  expect(fetcher).not.toHaveBeenCalled();
});

test("reserves the function response budget after a slow canonical batch", async () => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    await recoverPreviewOutbox(request(), configuration, 45_000, fetcher)
  ).toEqual({ status: "skipped", reason: "budget" });
  expect(fetcher).not.toHaveBeenCalled();
});

test.each([
  302, 401, 403, 500,
])("reports HTTP %i without reading the Preview response body", async (status) => {
  const response = new Response("private-response-never-read", { status });
  const json = vi.spyOn(response, "json");
  const text = vi.spyOn(response, "text");
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
  expect(
    await recoverPreviewOutbox(request(), configuration, 0, fetcher)
  ).toEqual({ status: "failed", reason: "http", httpStatus: status });
  expect(json).not.toHaveBeenCalled();
  expect(text).not.toHaveBeenCalled();
});

test("bounds a stalled hop and reports its failure without throwing", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    (_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new Error("private failure detail")),
          { once: true }
        );
      })
  );
  const started = Date.now();
  expect(
    await recoverPreviewOutbox(request(), configuration, 0, fetcher)
  ).toEqual({ status: "failed", reason: "transport" });
  expect(Date.now() - started).toBeLessThan(10_000);
}, 12_000);

test("sanitizes network errors and never propagates them to the canonical result", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("private transport detail"));
  expect(
    await recoverPreviewOutbox(request(), configuration, 0, fetcher)
  ).toEqual({ status: "failed", reason: "transport" });
});
