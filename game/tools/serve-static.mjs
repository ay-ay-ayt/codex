import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const port = Number(process.env.PORT ?? 8080);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".hdr", "image/vnd.radiance"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".bin", "application/octet-stream"],
  [".gltf", "model/gltf+json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
]);

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "");
    const filePath = resolve(projectRoot, relativePath);

    if (!filePath.startsWith(projectRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const file = await readFile(filePath);
    const contentType = contentTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`Serving ${projectRoot} at http://127.0.0.1:${port}`);
  console.log(`Current shell directory: ${cwd()}`);
});
