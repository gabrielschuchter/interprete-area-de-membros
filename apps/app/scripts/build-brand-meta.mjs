import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");
const metaDir = path.join(publicDir, "brand", "meta");
const appDir = path.join(root, "app");

const markPath = path.join(metaDir, "interprete-mark.svg");
const wordmarkPath = path.join(metaDir, "drive-site-01-interprete.svg");
const editorialPath = path.join(metaDir, "drive-site-46-laptop.png");

const markSvg = await readFile(markPath);
const wordmarkSvg = await readFile(wordmarkPath, "utf8");

const iconBackground = { r: 241, g: 235, b: 232, alpha: 1 };
const createIcon = async (size) => {
  const renderedMark = await sharp(markSvg)
    .resize({
      width: Math.max(12, Math.round(size * 0.43)),
      height: Math.max(12, Math.round(size * 0.68)),
      fit: "contain",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (
    let index = 0;
    index < renderedMark.data.length;
    index += renderedMark.info.channels
  ) {
    if (
      renderedMark.data[index] < 20 &&
      renderedMark.data[index + 1] < 20 &&
      renderedMark.data[index + 2] < 20
    ) {
      renderedMark.data[index] = 0;
      renderedMark.data[index + 1] = 0;
      renderedMark.data[index + 2] = 0;
      renderedMark.data[index + 3] = 0;
    }
  }
  const iconMark = await sharp(renderedMark.data, {
    raw: renderedMark.info,
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: iconBackground,
    },
  })
    .composite([{ input: iconMark, gravity: "center" }])
    .flatten({ background: iconBackground })
    .png()
    .toBuffer();
};

await writeFile(path.join(appDir, "icon.png"), await createIcon(512));
await writeFile(path.join(appDir, "apple-icon.png"), await createIcon(180));

const faviconPng = await createIcon(32);
const faviconPngSize = faviconPng.length;
const ico = Buffer.alloc(6 + 16 + faviconPngSize);
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6);
ico.writeUInt8(32, 7);
ico.writeUInt8(0, 8);
ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(faviconPngSize, 14);
ico.writeUInt32LE(22, 18);
faviconPng.copy(ico, 22);
await writeFile(path.join(appDir, "favicon.ico"), ico);

const whiteWordmark = wordmarkSvg
  .replace("<g ", '<rect width="4890" height="896" fill="#410230"/><g ')
  .replaceAll("#8C1535", "#F1EBE8");
const renderedLogo = await sharp(Buffer.from(whiteWordmark))
  .resize({ width: 300, height: 70, fit: "contain" })
  .raw()
  .toBuffer({ resolveWithObject: true });
for (
  let index = 0;
  index < renderedLogo.data.length;
  index += renderedLogo.info.channels
) {
  if (
    renderedLogo.data[index] < 20 &&
    renderedLogo.data[index + 1] < 20 &&
    renderedLogo.data[index + 2] < 20
  ) {
    renderedLogo.data[index] = 65;
    renderedLogo.data[index + 1] = 2;
    renderedLogo.data[index + 2] = 48;
    renderedLogo.data[index + 3] = 255;
  }
}
const logo = await sharp(renderedLogo.data, { raw: renderedLogo.info })
  .png()
  .toBuffer();

const editorial = await sharp(editorialPath)
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();

const panel = Buffer.from(`
<svg width="500" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="630" fill="#410230" fill-opacity="0.94"/>
  <text x="70" y="365" fill="#F1EBE8" font-family="Georgia, 'Times New Roman', serif" font-size="50" font-weight="600">
    <tspan x="70" dy="0">Perguntas</tspan>
    <tspan x="70" dy="60">melhores.</tspan>
    <tspan x="70" dy="72">Decisões</tspan>
    <tspan x="70" dy="60">mais humanas.</tspan>
  </text>
  <rect x="70" y="520" width="112" height="3" fill="#D62839"/>
</svg>`);

const social = await sharp(editorial)
  .composite([
    { input: panel, left: 0, top: 0 },
    { input: logo, left: 70, top: 74 },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(path.join(metaDir, "interprete-social-v2.png"), social);
await writeFile(path.join(appDir, "opengraph-image.png"), social);
console.log(
  JSON.stringify({
    icon: "app/icon.png",
    appleIcon: "app/apple-icon.png",
    favicon: "app/favicon.ico",
    social: "public/brand/meta/interprete-social-v2.png",
    socialBytes: social.length,
  })
);
