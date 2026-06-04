import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const appName = "ym040923.docker-manager";
const gatewayPrefix = "/app/ym040923-docker-manager";
const packDir = path.join(root, "packaging", "fnos-native", appName);
const serverDir = path.join(packDir, "app", "server");
const uiDir = path.join(packDir, "app", "ui");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true, force: true });
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makePng(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 4;
      row[offset] = 37;
      row[offset + 1] = 99;
      row[offset + 2] = 235;
      row[offset + 3] = 255;
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeIcons() {
  const imagesDir = path.join(uiDir, "images");
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.writeFileSync(path.join(imagesDir, "icon_64.png"), makePng(64));
  fs.writeFileSync(path.join(imagesDir, "icon_256.png"), makePng(256));
  fs.writeFileSync(path.join(packDir, "ICON.PNG"), makePng(64));
  fs.writeFileSync(path.join(packDir, "ICON_256.PNG"), makePng(256));
}

console.log(`[fnOS] Building web assets with base ${gatewayPrefix}/`);
run("pnpm", ["run", "build"], {
  env: {
    ...process.env,
    VITE_BASE_PATH: `${gatewayPrefix}/`,
  },
});

resetDir(serverDir);
resetDir(uiDir);
copyDir(path.join(root, "dist", "public"), uiDir);
fs.copyFileSync(path.join(root, "dist", "index.js"), path.join(serverDir, "index.js"));
fs.copyFileSync(path.join(root, "package.json"), path.join(serverDir, "package.json"));
fs.copyFileSync(path.join(root, "pnpm-lock.yaml"), path.join(serverDir, "pnpm-lock.yaml"));

writeJson(path.join(uiDir, "config"), {
  ".url": {
    "ym040923.docker-manager.Application": {
      title: "Docker Manager",
      desc: "Docker container startup order and monitoring manager",
      icon: "images/icon_{0}.png",
      type: "iframe",
      protocol: "",
      gatewaySocket: "app.sock",
      gatewayPrefix,
      url: gatewayPrefix,
      allUsers: false,
      control: {
        accessPerm: "readonly",
      },
    },
  },
});
writeIcons();

if (process.platform === "win32") {
  console.warn("[fnOS] Windows detected: not installing production node_modules because native better-sqlite3 must be built on Linux/fnOS.");
  console.warn("[fnOS] Run `pnpm install --prod --frozen-lockfile` inside packaging/fnos-native/ym040923.docker-manager/app/server on fnOS/Linux before fnpack build.");
} else {
  console.log("[fnOS] Installing production server dependencies");
  run("pnpm", ["install", "--prod", "--frozen-lockfile"], { cwd: serverDir });
}

fs.chmodSync(path.join(packDir, "cmd", "main"), 0o755);

const fnpack = spawnSync("fnpack", ["--version"], { shell: process.platform === "win32", stdio: "ignore" });
if (fnpack.status === 0) {
  run("fnpack", ["build"], { cwd: packDir });
} else {
  console.warn("[fnOS] fnpack was not found. Package tree is prepared, but .fpk was not built.");
}

console.log(`[fnOS] Prepared package directory: ${packDir}`);
