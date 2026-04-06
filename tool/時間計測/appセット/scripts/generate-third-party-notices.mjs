import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const lockfile = JSON.parse(readFileSync(join(process.cwd(), "package-lock.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "assets", "manifest.json"), "utf8"));
const packages = Object.entries(lockfile.packages ?? {}).filter(([name]) => name.startsWith("node_modules/")).map(([name, meta]) => ({ name: name.replace(/^node_modules\//, ""), version: meta.version ?? "unknown", license: meta.license ?? "UNKNOWN" })).sort((a, b) => a.name.localeCompare(b.name));
const lines = ["# THIRD_PARTY_NOTICES", "", "## Media Assets", ""];
for (const tier of ["core", "optional"]) {
  lines.push(`### ${tier}`);
  for (const asset of manifest.assets.filter((entry) => entry.tier === tier)) lines.push(`- ${asset.path}: ${asset.license} (${asset.source}, ${asset.category})`);
  lines.push("");
}
lines.push("## npm Packages", "");
for (const pkg of packages) lines.push(`- ${pkg.name} ${pkg.version}: ${pkg.license}`);
writeFileSync(join(process.cwd(), "THIRD_PARTY_NOTICES.md"), `${lines.join("\n")}\n`);
console.log(`Wrote ${packages.length} package notices to THIRD_PARTY_NOTICES.md`);