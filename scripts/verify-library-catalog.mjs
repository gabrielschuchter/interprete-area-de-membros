import { readFile } from "node:fs/promises";

const catalogSource = await readFile(
  new URL("../packages/database/library-catalog.ts", import.meta.url),
  "utf8"
);
const libraryCatalog = [
  ...catalogSource.matchAll(/url:\s*"(https:\/\/[^"\\]+)"/g),
].map((match, index) => {
  const titles = [
    ...catalogSource.slice(0, match.index).matchAll(/title:\s*"([^"]+)"/g),
  ];
  return {
    title: titles.at(-1)?.[1] ?? `Curated library item ${index + 1}`,
    url: match[1],
  };
});

const concurrency = 6;
const timeoutMs = 20_000;
const results = new Array(libraryCatalog.length);
let cursor = 0;

const checkUrl = async (reference) => {
  const headers = {
    // Behave like a normal browser request. A bot-specific user agent caused
    // several official publishers to return their anti-automation 403 page.
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    accept: "text/html,application/pdf,application/json,*/*;q=0.8",
  };

  try {
    let response = await fetch(reference.url, {
      method: "HEAD",
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      response = await fetch(reference.url, {
        method: "GET",
        redirect: "follow",
        headers: { ...headers, range: "bytes=0-0" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel();
    }
    return {
      title: reference.title,
      url: reference.url,
      finalUrl: response.url,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
    };
  } catch (error) {
    return {
      title: reference.title,
      url: reference.url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const worker = async () => {
  while (cursor < libraryCatalog.length) {
    const index = cursor++;
    results[index] = await checkUrl(libraryCatalog[index]);
  }
};

await Promise.all(
  Array.from({ length: Math.min(concurrency, libraryCatalog.length) }, worker)
);

const duplicateUrls = libraryCatalog
  .map(({ url }) => url)
  .filter((url, index, all) => all.indexOf(url) !== index);
const failures = results.filter(({ ok }) => !ok);
const blocked = failures.filter(({ status }) => status === 403);
const brokenOrUnavailable = failures.filter(({ status }) => status !== 403);
console.log(
  JSON.stringify(
    {
      checked: results.length,
      uniqueUrls: new Set(libraryCatalog.map(({ url }) => url)).size,
      duplicateUrls: [...new Set(duplicateUrls)],
      redirects: results
        .filter(({ finalUrl, url }) => finalUrl && finalUrl !== url)
        .map(({ title, url, finalUrl, status }) => ({
          title,
          url,
          finalUrl,
          status,
        })),
      verified: results.length - failures.length,
      blockedByPublisherOrBotProtection: blocked,
      failures: brokenOrUnavailable,
    },
    null,
    2
  )
);
if (brokenOrUnavailable.length || duplicateUrls.length) {
  process.exitCode = 1;
}
