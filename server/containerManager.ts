import { getContainerConfigs, getGlobalSettings, addLog } from './db';
import { getContainerStatus, startContainer, restartContainer } from './docker';

let sequencingInProgress = false;
let monitoring = false;
let monitorTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_RETRIES = 20;
const RETRY_DELAY_MS = 5000;

async function ensureContainerRunning(
  containerName: string,
  action: 'start' | 'restart',
  eventType: 'startup' | 'restart'
): Promise<boolean> {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    const status = await getContainerStatus(containerName);

    if (status === 'running') {
      console.log(`[Container Manager] ${containerName} is already running, skipping ${action}`);
      return true;
    }

    console.log(`[Container Manager] ${containerName} not running (${status}), attempting ${action}... (attempt ${retries + 1}/${MAX_RETRIES})`);

    try {
      const fn = action === 'start' ? startContainer : restartContainer;
      const success = await fn(containerName);

      if (success) {
        // Verify it actually came up
        const verifyStatus = await getContainerStatus(containerName);
        if (verifyStatus === 'running') {
          await addLog({
            containerName,
            eventType,
            message: `容器${action === 'start' ? '启动' : '重启'}成功`,
          });
          console.log(`[Container Manager] ${containerName} ${action} confirmed running`);
          return true;
        }
        // Not confirmed running yet, continue loop
        console.log(`[Container Manager] ${containerName} ${action} returned success but not yet running, re-checking...`);
      } else {
        await addLog({
          containerName,
          eventType: 'error',
          message: `容器${action === 'start' ? '启动' : '重启'}失败，将在 ${RETRY_DELAY_MS / 1000}s 后重试`,
        });
      }
    } catch (error) {
      console.error(`[Container Manager] Error ${action}ing ${containerName}:`, error);
      await addLog({
        containerName,
        eventType: 'error',
        message: `${action === 'start' ? '启动' : '重启'}异常: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    retries++;
    if (retries < MAX_RETRIES) {
      console.log(`[Container Manager] Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // Max retries exceeded
  await addLog({
    containerName,
    eventType: 'error',
    message: `${action === 'start' ? '启动' : '重启'}失败，已达最大重试次数 (${MAX_RETRIES})，跳过此容器`,
  });
  console.error(`[Container Manager] ${containerName} failed to ${action} after ${MAX_RETRIES} retries, giving up`);
  return false;
}

export async function startContainerSequence() {
  if (sequencingInProgress) {
    console.log('[Container Manager] Start sequence already in progress, skipping');
    return;
  }

  sequencingInProgress = true;
  console.log('[Container Manager] ========== Starting container sequence ==========');

  try {
    const configs = await getContainerConfigs();

    for (const config of configs) {
      console.log(`[Container Manager] --- Processing container: ${config.name} ---`);
      const success = await ensureContainerRunning(config.name, 'start', 'startup');

      if (success && config.startupDelay > 0) {
        console.log(`[Container Manager] ${config.name} running, waiting ${config.startupDelay}s before next container...`);
        await new Promise(resolve => setTimeout(resolve, config.startupDelay * 1000));
      } else if (!success) {
        // Still proceed to next container even if this one failed
        console.log(`[Container Manager] ${config.name} failed to start, moving to next container`);
      }
    }

    console.log('[Container Manager] ========== Container sequence completed ==========');
  } catch (error) {
    console.error('[Container Manager] Fatal error in container sequence:', error);
  } finally {
    sequencingInProgress = false;
  }
}

async function runMonitorCycle() {
  try {
    const configs = await getContainerConfigs();
    const settings = await getGlobalSettings();
    const checkInterval = settings?.checkInterval || 60;

    console.log(`[Container Manager] Running monitor cycle (${configs.length} containers configured)`);

    for (const config of configs) {
      if (!monitoring) break; // Allow immediate stop
      if (config.monitor !== 1) continue;

      console.log(`[Container Manager] Checking container: ${config.name}`);
      const success = await ensureContainerRunning(config.name, 'restart', 'restart');

      if (!success) {
        console.log(`[Container Manager] ${config.name} monitoring: failed to restore, will retry next cycle`);
      }
    }

    // Schedule next cycle
    if (monitoring) {
      monitorTimer = setTimeout(runMonitorCycle, checkInterval * 1000);
    }
  } catch (error) {
    console.error('[Container Manager] Error in monitor cycle:', error);
    if (monitoring) {
      // Retry after 60s on error
      monitorTimer = setTimeout(runMonitorCycle, 60000);
    }
  }
}

export function startMonitoring() {
  if (monitoring) {
    console.log('[Container Manager] Monitoring already running');
    return;
  }

  monitoring = true;
  console.log('[Container Manager] Starting container monitoring...');

  // Fire first cycle asynchronously — do NOT block the caller
  runMonitorCycle();
}

export function stopMonitoring() {
  if (monitorTimer) {
    clearTimeout(monitorTimer);
    monitorTimer = null;
  }
  monitoring = false;
  console.log('[Container Manager] Monitoring stopped');
}

export function isMonitoring(): boolean {
  return monitoring;
}

export function isSequenceRunning(): boolean {
  return sequencingInProgress;
}
