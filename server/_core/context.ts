import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { AUTH_COOKIE_NAME } from "@shared/const";
import { jwtVerify } from "jose";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach(pair => {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  });
  return cookies;
}

function createContextUser(params: {
  id: number;
  openId: string;
  name: string;
  role: "user" | "admin";
  loginMethod: string;
}): User {
  const now = new Date().toISOString();
  return {
    id: params.id,
    openId: params.openId,
    name: params.name,
    role: params.role,
    email: null,
    loginMethod: params.loginMethod,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function getHeader(req: CreateExpressContextOptions["req"], name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function authenticateFnosGateway(req: CreateExpressContextOptions["req"]): User | null {
  const isAdmin = getHeader(req, "x-trim-isadmin") === "true";
  if (!isAdmin) return null;

  const uid = getHeader(req, "x-trim-userid") || "0";
  const username = getHeader(req, "x-trim-username") || "fnos-admin";
  return createContextUser({
    id: Number(uid) || 0,
    openId: `fnos:${uid}`,
    name: username,
    role: "admin",
    loginMethod: "fnos-gateway",
  });
}

export async function authenticateRequest(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  if (ENV.isFnosNative) {
    return authenticateFnosGateway(req);
  }

  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = parseCookies(cookieHeader);
    const token = cookies[AUTH_COOKIE_NAME];
    if (!token) return null;

    const secretKey = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secretKey);

    if (!payload.username || payload.role !== 'admin') return null;

    return createContextUser({
      id: 0,
      openId: `local:${payload.username}`,
      name: payload.username as string,
      role: 'admin',
      loginMethod: 'local',
    });
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user = await authenticateRequest(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
