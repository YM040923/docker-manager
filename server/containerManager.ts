import { addLog, getContainerConfigs, getGlobalSettings, getDb } from "./db";
import { getAllContainers, getContainerStatus, restartContainer, startContainer } from "./docker";

let sequencingInProgress = false;
let monitoring = false;
let monitorTimer: ReturnType<typeof setTimeout> | null = null;
let lastLogCleanup = 0;

const MAX_RETRIES = 20;
const RETRY_DELAY_MS = 5000;
const LOG_CLEANUP_INTERVAL_MS = 3_600_000;
const MAX_LOG_ROWS = 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pruneOldLogs() {
  const now = Date.now();
  if (now - lastLogCleanup < LOG_CLEANUP_INTERVAL_MS) return;
  lastLogCleanup = now;

  try {
    const db = await getDb();
    if (!db) return;
    const client = db.$client;
    const result = client.prepare(
      "SELECT id FROM logs ORDER BY id DESC LIMIT 1 OFFSET ?"
    ).get(MAX_LOG_ROWS) as { id: number } | undefined;

    if (result) {
      client.prepare("DELETE FROM logs WHERE id <= ?").run(result.id);
    }
  } catch (error) {
    console.warn("[Container Manager] Failed to prune old logs:", error);
  }
}

export async function checkDockerHealth(): Promise<boolean> {
  try {
    await getAllContainers();
    return true;
  } catch {
    return false;
  }
}

async function ensureContainerRunning(
  containerName: string,
  action: "start" | "restart",
  eventType: "startup" | "restart"
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const status = await getContainerStatus(containerName);
    if (status === "running") {
      console.log(`[Container Manager] ${containerName} is running`);
      return true;
    }

    console.log(
      `[Container Manager] ${containerName} is ${status}, ${action} attempt ${attempt}/${MAX_RETRIES}`
    );

    try {
      const success = action === "start"
        ? await startContainer(containerName)
        : await restartContainer(containerName);

      if (success && await getContainerStatus(containerName) === "running") {
        await addLog({
          containerName,
          eventType,
          message: action === "start" ? "容器启动成功" : "容器重启成功",
        });
        return true;
      }

      await addLog({
        containerName,
        eventType: "error",
        message: `${action === "start" ? "容器启动失败" : "容器重启失败"}，将在 ${RETRY_DELAY_MS / 1000}s 后重试`,
      });
    } catch (error) {
      await addLog({
        containerName,
        eventType: "error",
        message: `${action === "start" ? "启动异常" : "重启异常"}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  await addLog({
    containerName,
    eventType: "error",
    message: `${action === "start" ? "启动失败" : "重启失败"}，已达到最大重试次数 ${MAX_RETRIES}`,
  });
  return false;
}

export async function startContainerSequence() {
  if (sequencingInProgress) {
    console.log("[Container Manager] Start sequence already in progress, skipping");
    return;
  }

  sequencingInProgress = true;
  console.log("[Container Manager] Starting container sequence");

  try {
    const configs = await getContainerConfigs();

    for (const config of configs) {
      const success = await ensureContainerRunning(config.name, "start", "startup");
      if (success && config.startupDelay > 0) {
        await sleep(config.startupDelay * 1000);
      }
    }

    console.log("[Container Manager] Container sequence completed");
  } catch (error) {
    console.error("[Container Manager] Fatal error in container sequence:", error);
  } finally {
    sequencingInProgress = false;
  }
}

async function runMonitorCycle() {
  try {
    const configs = await getContainerConfigs();
    const settings = await getGlobalSettings();
    const checkInterval = settings?.checkInterval || 60;

    for (const config of configs) {
      if (!monitoring) break;
      if (config.monitor !== 1) continue;
      await ensureContainerRunning(config.name, "restart", "restart");
    }

    await pruneOldLogs();

    if (monitoring) {
      monitorTimer = setTimeout(runMonitorCycle, checkInterval * 1000);
    }
  } catch (error) {
    console.error("[Container Manager] Error in monitor cycle:", error);
    if (monitoring) {
      monitorTimer = setTimeout(runMonitorCycle, 60_000);
    }
  }
}

export function startMonitoring() {
  if (monitoring) {
    console.log("[Container Manager] Monitoring already running");
    return;
  }

  monitoring = true;
  console.log("[Container Manager] Starting container monitoring");
  runMonitorCycle();
}

export function stopMonitoring() {
  if (monitorTimer) {
    clearTimeout(monitorTimer);
    monitorTimer = null;
  }
  monitoring = false;
  console.log("[Container Manager] Monitoring stopped");
}

export function isMonitoring(): boolean {
  return monitoring;
}

export function isSequenceRunning(): boolean {
  return sequencingInProgress;
}
