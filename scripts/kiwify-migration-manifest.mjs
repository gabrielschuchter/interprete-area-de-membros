import { mkdir, writeFile } from "node:fs/promises";
import { manifest } from "./kiwify-manifest-data.mjs";

const output = new URL(
  "../tmp/kiwify-migration/manifest.json",
  import.meta.url
);

await mkdir(new URL("../tmp/kiwify-migration/", import.meta.url), {
  recursive: true,
});
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      output: "tmp/kiwify-migration/manifest.json",
      inventory: manifest.inventory,
      students: manifest.students.length,
    },
    null,
    2
  )
);
