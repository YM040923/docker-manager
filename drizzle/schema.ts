import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: text("createdAt").notNull().default(new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().default(new Date().toISOString()),
  lastSignedIn: text("lastSignedIn").notNull().default(new Date().toISOString()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const containerConfigs = sqliteTable("container_configs", {
  id: int("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startupOrder: int("startup_order").notNull().default(0),
  startupDelay: int("startup_delay").notNull().default(0),
  monitor: int("monitor").notNull().default(1),
  createdAt: text("createdAt").notNull().default(new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().default(new Date().toISOString()),
});

export type ContainerConfig = typeof containerConfigs.$inferSelect;
export type InsertContainerConfig = typeof containerConfigs.$inferInsert;

export const logs = sqliteTable("logs", {
  id: int("id").primaryKey({ autoIncrement: true }),
  containerName: text("container_name").notNull(),
  eventType: text("event_type", { enum: ["startup", "restart", "status_check", "error"] }).notNull(),
  message: text("message").notNull(),
  createdAt: text("createdAt").notNull().default(new Date().toISOString()),
});

export type Log = typeof logs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;

export const globalSettings = sqliteTable("global_settings", {
  id: int("id").primaryKey({ autoIncrement: true }),
  checkInterval: int("check_interval").notNull().default(60),
  updatedAt: text("updatedAt").notNull().default(new Date().toISOString()),
});

export type GlobalSettings = typeof globalSettings.$inferSelect;
export type InsertGlobalSettings = typeof globalSettings.$inferInsert;
