import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const bannerPath = path.join(process.cwd(), "public", "movie-banner.webp");

const input = await readFile(bannerPath);
const image = sharp(input);
const metadata = await image.metadata();

if (!metadata.width || !metadata.height) {
  throw new Error("could not read movie-banner.webp dimensions");
}

const optimized = await image
  .webp({
    quality: 72,
    effort: 6,
    smartSubsample: true,
  })
  .toBuffer();

await writeFile(bannerPath, optimized);

const beforeKb = Math.round(input.byteLength / 1024);
const afterKb = Math.round(optimized.byteLength / 1024);

console.log(
  `movie-banner.webp recompressed at ${metadata.width}x${metadata.height}: ${beforeKb}KB -> ${afterKb}KB`,
);
