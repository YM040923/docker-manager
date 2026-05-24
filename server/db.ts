import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { InsertUser, users, InsertContainerConfig, InsertLog, containerConfigs, globalSettings, logs } from "../drizzle/schema";
import { ENV } from './_core/env';
import path from "path";
import fs from "fs";

const DB_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "docker-manager.db");

let _db: ReturnType<typeof drizzle> | null = null;

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function getDb() {
  if (!_db) {
    try {
      ensureDataDir();
      const sqlite = new Database(DB_PATH);
      sqlite.pragma("journal_mode = WAL");
      _db = drizzle(sqlite);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      throw error;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);

  const now = new Date().toISOString();
  const values = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role: user.openId === ENV.ownerOpenId ? 'admin' as const : (user.role ?? 'user' as const),
    lastSignedIn: now,
    createdAt: existing[0]?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing.length > 0) {
    await db.update(users).set(values).where(eq(users.openId, user.openId));
  } else {
    await db.insert(users).values(values);
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getContainerConfigs() {
  const db = await getDb();
  return db.select().from(containerConfigs).orderBy(containerConfigs.startupOrder);
}

export async function createContainerConfig(data: InsertContainerConfig) {
  const db = await getDb();
  await db.insert(containerConfigs).values(data as any);
}

export async function updateContainerConfig(id: number, data: Partial<InsertContainerConfig>) {
  const db = await getDb();
  await db.update(containerConfigs).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(containerConfigs.id, id));
}

export async function deleteContainerConfig(id: number) {
  const db = await getDb();
  await db.delete(containerConfigs).where(eq(containerConfigs.id, id));
}

export async function reorderContainerConfigs(items: Array<{ id: number; startupOrder: number }>) {
  const db = await getDb();
  await Promise.all(
    items.map(item =>
      db.update(containerConfigs)
        .set({ startupOrder: item.startupOrder, updatedAt: new Date().toISOString() } as any)
        .where(eq(containerConfigs.id, item.id))
    )
  );
}

export async function getGlobalSettings() {
  const db = await getDb();
  const result = await db.select().from(globalSettings).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateGlobalSettings(data: { checkInterval?: number }) {
  const db = await getDb();
  const existing = await getGlobalSettings();
  if (existing) {
    await db.update(globalSettings).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(globalSettings.id, existing.id));
  } else {
    await db.insert(globalSettings).values({ checkInterval: data.checkInterval ?? 60, updatedAt: new Date().toISOString() } as any);
  }
}

export async function addLog(data: InsertLog) {
  const db = await getDb();
  await db.insert(logs).values(data as any);
}

export async function getLogs(limit: number = 100) {
  const db = await getDb();
  return db.select().from(logs).orderBy(desc(logs.createdAt)).limit(limit);
}
