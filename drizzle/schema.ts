import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 容器配置表
 */
export const containerConfigs = mysqlTable("container_configs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  startupOrder: int("startup_order").notNull().default(0),
  startupDelay: int("startup_delay").notNull().default(0),
  monitor: int("monitor").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContainerConfig = typeof containerConfigs.$inferSelect;
export type InsertContainerConfig = typeof containerConfigs.$inferInsert;

/**
 * 日志表
 */
export const logs = mysqlTable("logs", {
  id: int("id").autoincrement().primaryKey(),
  containerName: varchar("container_name", { length: 255 }).notNull(),
  eventType: mysqlEnum("event_type", ["startup", "restart", "status_check", "error"]).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Log = typeof logs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;

/**
 * 全局设置表
 */
export const globalSettings = mysqlTable("global_settings", {
  id: int("id").autoincrement().primaryKey(),
  checkInterval: int("check_interval").notNull().default(60),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GlobalSettings = typeof globalSettings.$inferSelect;
export type InsertGlobalSettings = typeof globalSettings.$inferInsert;