import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "assets", "manifest.json"), "utf8"));
const grouped = new Map();
for (const asset of manifest.assets) {
  const bucket = grouped.get(asset.tier) ?? { count: 0, bytes: 0 };
  bucket.count += 1;
  bucket.bytes += statSync(join(process.cwd(), "public", asset.path)).size;
  grouped.set(asset.tier, bucket);
}
for (const [tier, info] of grouped) console.log(`${tier}: ${info.count} assets, ${(info.bytes / 1024 / 1024).toFixed(2)} MB`);