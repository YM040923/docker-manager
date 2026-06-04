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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
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
  const scale = size / 256;
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 4;
      const cx = x / scale;
      const cy = y / scale;
      let r = 17;
      let g = 24;
      let b = 39;

      const inPanel = cx >= 34 && cx <= 222 && cy >= 50 && cy <= 206;
      if (inPanel) {
        r = 15;
        g = 118;
        b = 178;
      }

      const tile =
        ((cx >= 66 && cx <= 98) || (cx >= 112 && cx <= 144) || (cx >= 158 && cx <= 190)) &&
        ((cy >= 86 && cy <= 118) || (cy >= 132 && cy <= 164));
      if (tile) {
        r = 236;
        g = 253;
        b = 255;
      }

      const rail = cx >= 60 && cx <= 196 && cy >= 176 && cy <= 188;
      const dot1 = (cx - 82) ** 2 + (cy - 190) ** 2 <= 9 ** 2;
      const dot2 = (cx - 174) ** 2 + (cy - 190) ** 2 <= 9 ** 2;
      if (rail || dot1 || dot2) {
        r = 10;
        g = 32;
        b = 52;
      }

      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
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
  fs.writeFileSync(path.join(imagesDir, "icon.png"), makePng(256));
  fs.writeFileSync(path.join(imagesDir, "icon_64.png"), makePng(64));
  fs.writeFileSync(path.join(imagesDir, "icon_256.png"), makePng(256));
  fs.writeFileSync(path.join(packDir, "ICON.PNG"), makePng(64));
  fs.writeFileSync(path.join(packDir, "ICON_256.PNG"), makePng(256));
}

function chmodExecutableFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      chmodExecutableFiles(file);
    } else if (entry.isFile()) {
      fs.chmodSync(file, 0o755);
    }
  }
}

function writeServerPackageJson() {
  const rootPackage = readJson(path.join(root, "package.json"));
  const runtimeDeps = [
    "@trpc/server",
    "axios",
    "better-sqlite3",
    "cookie",
    "dockerode",
    "dotenv",
    "drizzle-orm",
    "express",
    "jose",
    "nanoid",
    "superjson",
    "zod",
  ];
  const dependencies = {};
  for (const name of runtimeDeps) {
    if (!rootPackage.dependencies?.[name]) {
      throw new Error(`Missing runtime dependency in root package.json: ${name}`);
    }
    dependencies[name] = rootPackage.dependencies[name];
  }

  writeJson(path.join(serverDir, "package.json"), {
    name: `${rootPackage.name}-fnos-server`,
    version: rootPackage.version,
    type: "module",
    private: true,
    scripts: {
      start: "NODE_ENV=production node index.js",
    },
    dependencies,
    pnpm: {
      onlyBuiltDependencies: ["better-sqlite3"],
      ...(rootPackage.pnpm?.overrides ? { overrides: rootPackage.pnpm.overrides } : {}),
    },
  });
}

function resolveFnpack() {
  const candidates = [
    process.env.FNPACK,
    process.env.FNOS_FNPACK,
    "fnpack",
    path.join(root, "tools", "fnpack", process.platform === "win32" ? "fnpack.exe" : "fnpack"),
    path.join(root, "tools", "fnpack", "fnpack"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--help"], {
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
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
writeServerPackageJson();
fs.copyFileSync(path.join(root, "pnpm-lock.yaml"), path.join(serverDir, "pnpm-lock.yaml"));
const patchesDir = path.join(root, "patches");
if (fs.existsSync(patchesDir)) {
  copyDir(patchesDir, path.join(serverDir, "patches"));
}

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
  console.warn("[fnOS] Run `pnpm install --prod --no-frozen-lockfile --config.node-linker=hoisted` inside packaging/fnos-native/ym040923.docker-manager/app/server on fnOS/Linux before fnpack build.");
} else {
  console.log("[fnOS] Installing production server dependencies");
  run("pnpm", ["install", "--prod", "--no-frozen-lockfile", "--config.node-linker=hoisted"], { cwd: serverDir });
}

chmodExecutableFiles(path.join(packDir, "cmd"));

const fnpack = resolveFnpack();
if (fnpack) {
  run(fnpack, ["build"], { cwd: packDir });
} else {
  console.warn("[fnOS] fnpack was not found. Package tree is prepared, but .fpk was not built.");
  console.warn("[fnOS] On fnOS/Linux, run `bash scripts/build-fnos-native.sh` to download fnpack and build the .fpk.");
}

console.log(`[fnOS] Prepared package directory: ${packDir}`);
