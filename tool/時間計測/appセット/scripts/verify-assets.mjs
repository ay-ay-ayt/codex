import { readFileSync, accessSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "assets", "manifest.json"), "utf8"));
for (const asset of manifest.assets) {
  accessSync(join(process.cwd(), "public", asset.path));
}
console.log(`Verified ${manifest.assets.length} assets.`);
