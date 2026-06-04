import "dotenv/config";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { SignJWT } from "jose";
import { AUTH_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { initializeContainerManager } from "../init";
import { createContext, authenticateRequest } from "./context";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { serveStatic, setupVite } from "./vite";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 60_000;

async function runMigrations() {
  await getDb();
  console.log("[Migration] SQLite schema verified");
}

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_WINDOW });
    return true;
  }
  if (entry.count >= LOGIN_RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

function stripGatewayPrefix(app: express.Express) {
  const prefix = ENV.fnosGatewayPrefix.replace(/\/+$/, "");
  if (!prefix) return;

  app.use((req, _res, next) => {
    if (req.url === prefix) {
      req.url = "/";
    } else if (req.url.startsWith(`${prefix}/`)) {
      req.url = req.url.slice(prefix.length);
    }
    next();
  });
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 13000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function validateProductionConfig() {
  if (!ENV.isProduction || ENV.isFnosNative) return;

  let fatal = false;
  if (!ENV.adminUsername || !ENV.adminPassword) {
    console.error("[Server] ADMIN_USERNAME and ADMIN_PASSWORD must be set in production");
    fatal = true;
  }
  if (
    !ENV.cookieSecret ||
    ENV.cookieSecret === "your_jwt_secret_key_here_change_me" ||
    ENV.cookieSecret === "CHANGE_ME_TO_RANDOM_STRING"
  ) {
    console.error("[Server] JWT_SECRET must be set to a random string");
    fatal = true;
  }
  if (fatal) process.exit(1);
}

async function listen(server: ReturnType<typeof createServer>) {
  if (ENV.fnosSocketPath) {
    fs.mkdirSync(path.dirname(ENV.fnosSocketPath), { recursive: true });
    if (fs.existsSync(ENV.fnosSocketPath)) fs.unlinkSync(ENV.fnosSocketPath);

    server.listen(ENV.fnosSocketPath, () => {
      fs.chmodSync(ENV.fnosSocketPath, 0o660);
      console.log(`Server running on unix socket ${ENV.fnosSocketPath}`);
    });
    return;
  }

  const preferredPort = parseInt(process.env.PORT || "13000", 10);
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

async function startServer() {
  validateProductionConfig();

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  stripGatewayPrefix(app);
  registerStorageProxy(app);
  if (!ENV.isFnosNative) registerOAuthRoutes(app);

  app.post("/api/login", express.json(), async (req, res) => {
    if (ENV.isFnosNative) {
      res.status(404).json({ success: false, message: "Login is handled by fnOS gateway" });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkLoginRateLimit(ip)) {
      res.status(429).json({ success: false, message: "登录尝试过于频繁，请稍后再试" });
      return;
    }

    const { username, password } = req.body || {};
    if (username !== ENV.adminUsername || password !== ENV.adminPassword) {
      res.status(401).json({ success: false, message: "用户名或密码错误" });
      return;
    }

    const secretKey = new TextEncoder().encode(ENV.cookieSecret);
    const token = await new SignJWT({
      username: ENV.adminUsername,
      role: "admin",
      loginTime: Date.now(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("365d")
      .sign(secretKey);

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: ENV.isProduction,
      maxAge: ONE_YEAR_MS,
    });

    res.json({ success: true, username: ENV.adminUsername });
  });

  app.post("/api/logout", (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });

  app.get("/api/auth/check", async (req, res) => {
    const user = await authenticateRequest(req);
    res.json({
      authenticated: !!user,
      username: user?.name || null,
      mode: ENV.isFnosNative ? "fnos" : "local",
    });
  });

  await runMigrations();

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  await listen(server);

  if (process.env.NODE_ENV === "production") {
    initializeContainerManager().catch(err => {
      console.error("[Server] Container manager initialization failed:", err);
    });
  }
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
