import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { SignJWT } from "jose";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext, authenticateRequest } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeContainerManager } from "../init";
import { ENV } from "./env";
import { AUTH_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Simple in-memory rate limiter for login
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_LIMIT = 5;      // max attempts
const LOGIN_RATE_WINDOW = 60000; // per minute

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_WINDOW });
    return true;
  }
  if (entry.count >= LOGIN_RATE_LIMIT) return false;
  entry.count++;
  return true;
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

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (ENV.isProduction && (!ENV.adminUsername || !ENV.adminPassword)) {
    console.error('[Server] ADMIN_USERNAME and ADMIN_PASSWORD must be set in production');
    process.exit(1);
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // === 本地账号密码认证 ===
  app.post("/api/login", express.json(), async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkLoginRateLimit(ip)) {
      res.status(429).json({ success: false, message: "登录尝试过于频繁，请稍后再试" });
      return;
    }
    const { username, password } = req.body || {};
    if (username !== ENV.adminUsername || password !== ENV.adminPassword) {
      res.status(401).json({ success: false, message: "用户名或密码错误" });
      return;
    }

    const user = {
      username: ENV.adminUsername,
      role: "admin",
      loginTime: Date.now(),
    };

    const secretKey = new TextEncoder().encode(ENV.cookieSecret);
    const token = await new SignJWT(user as any)
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
    res.json({ authenticated: !!user, username: user?.name || null });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "13000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // 生产环境下自动初始化容器管理
  if (process.env.NODE_ENV === 'production') {
    initializeContainerManager().catch(err => {
      console.error('[Server] Container manager initialization failed:', err);
    });
  }
}

startServer().catch(console.error);
