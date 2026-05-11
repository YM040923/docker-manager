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

export async function authenticateRequest(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = parseCookies(cookieHeader);
    const token = cookies[AUTH_COOKIE_NAME];
    if (!token) return null;

    const secretKey = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secretKey);

    if (!payload.username || payload.role !== 'admin') return null;

    return {
      id: 0,
      openId: `local:${payload.username}`,
      name: payload.username as string,
      role: 'admin',
      email: null,
      loginMethod: 'local',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
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
