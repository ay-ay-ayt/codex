import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const host = process.env.ELECTRON_DEV_HOST || "127.0.0.1";
const preferredPort = Number(process.env.ELECTRON_DEV_PORT || 5173);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

async function findAvailablePort(startPort, maxChecks = 20) {
  for (let offset = 0; offset < maxChecks; offset += 1) {
    const port = startPort + offset;
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error(`Could not find an available port from ${startPort} to ${startPort + maxChecks - 1}`);
}

async function waitForServer(rendererUrl, port, maxAttempts = 120) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve(true);
      });

      socket.on("error", () => {
        resolve(false);
      });
    });

    if (ready) {
      return;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for Vite at ${rendererUrl}`);
}

function killProcess(child) {
  if (child && !child.killed) {
    child.kill();
  }
}

function spawnVite(port) {
  if (process.platform === "win32") {
    return spawn(
      "cmd.exe",
      ["/d", "/s", "/c", `npm.cmd run dev -- --host ${host} --port ${port}`],
      {
        cwd: rootDir,
        stdio: "inherit"
      }
    );
  }

  return spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port)], {
    cwd: rootDir,
    stdio: "inherit"
  });
}

function spawnElectron(rendererUrl) {
  const electronBinary = process.platform === "win32"
    ? path.join(rootDir, "node_modules", "electron", "dist", "electron.exe")
    : path.join(rootDir, "node_modules", ".bin", "electron");

  if (process.platform === "win32") {
    const child = spawn(electronBinary, ["."], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: rendererUrl
      }
    });

    child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    return child;
  }

  return spawn(electronBinary, ["."], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl
    }
  });
}

const port = await findAvailablePort(preferredPort);
const rendererUrl = process.env.ELECTRON_RENDERER_URL || `http://${host}:${port}`;
const viteProcess = spawnVite(port);
let electronProcess = null;

const shutdown = () => {
  killProcess(electronProcess);
  killProcess(viteProcess);
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

viteProcess.on("exit", (code) => {
  if (electronProcess?.exitCode == null) {
    killProcess(electronProcess);
  }

  process.exit(code ?? 0);
});

try {
  await waitForServer(rendererUrl, port);

  electronProcess = spawnElectron(rendererUrl);
  electronProcess.on("exit", (code) => {
    killProcess(viteProcess);
    process.exit(code ?? 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  killProcess(viteProcess);
  process.exit(1);
}
