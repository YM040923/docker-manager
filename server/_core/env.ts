export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",  // optional, defaults to SQLite
  sqlitePath: process.env.SQLITE_PATH ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  isFnosNative: process.env.FNOS_NATIVE === "1",
  fnosGatewayPrefix: process.env.FNOS_GATEWAY_PREFIX ?? "",
  fnosSocketPath: process.env.FNOS_SOCKET_PATH ?? "",
  staticDir: process.env.STATIC_DIR ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  adminUsername: process.env.ADMIN_USERNAME ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
};
