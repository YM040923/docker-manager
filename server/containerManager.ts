import { getContainerConfigs, getGlobalSettings, addLog } from './db';
import { getContainerStatus, startContainer, restartContainer } from './docker';

let isRunning = false;
let monitorInterval: NodeJS.Timeout | null = null;

export async function startContainerSequence() {
  console.log('[Container Manager] Starting container sequence...');
  
  try {
    const configs = await getContainerConfigs();
    
    for (const config of configs) {
      try {
        console.log(`[Container Manager] Starting container: ${config.name}`);
        const success = await startContainer(config.name);
        
        if (success) {
          await addLog({
            containerName: config.name,
            eventType: 'startup',
            message: `容器启动成功`,
          });
          console.log(`[Container Manager] Container ${config.name} started successfully`);
        } else {
          await addLog({
            containerName: config.name,
            eventType: 'error',
            message: `容器启动失败`,
          });
          console.log(`[Container Manager] Failed to start container ${config.name}`);
        }
        
        // 等待配置的延迟时间
        if (config.startupDelay > 0) {
          console.log(`[Container Manager] Waiting ${config.startupDelay}s before next container...`);
          await new Promise(resolve => setTimeout(resolve, config.startupDelay * 1000));
        }
      } catch (error) {
        console.error(`[Container Manager] Error starting ${config.name}:`, error);
        await addLog({
          containerName: config.name,
          eventType: 'error',
          message: `启动异常: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
    
    console.log('[Container Manager] Container sequence completed');
  } catch (error) {
    console.error('[Container Manager] Error in container sequence:', error);
  }
}

export async function startMonitoring() {
  if (isRunning) {
    console.log('[Container Manager] Monitoring already running');
    return;
  }
  
  isRunning = true;
  console.log('[Container Manager] Starting container monitoring...');
  
  const runMonitorCycle = async () => {
    try {
      const configs = await getContainerConfigs();
      const settings = await getGlobalSettings();
      const checkInterval = settings?.checkInterval || 60;
      
      for (const config of configs) {
        if (config.monitor !== 1) continue;
        
        try {
          const status = await getContainerStatus(config.name);
          
          if (status === 'running') {
            console.log(`[Container Manager] Container ${config.name} is running`);
          } else if (status === 'stopped') {
            console.log(`[Container Manager] Container ${config.name} is stopped, attempting restart...`);
            const success = await restartContainer(config.name);
            
            if (success) {
              await addLog({
                containerName: config.name,
                eventType: 'restart',
                message: `容器已自动重启`,
              });
              console.log(`[Container Manager] Container ${config.name} restarted successfully`);
            } else {
              await addLog({
                containerName: config.name,
                eventType: 'error',
                message: `容器重启失败`,
              });
              console.log(`[Container Manager] Failed to restart container ${config.name}`);
            }
          } else {
            console.log(`[Container Manager] Container ${config.name} not found`);
            await addLog({
              containerName: config.name,
              eventType: 'error',
              message: `容器未找到`,
            });
          }
        } catch (error) {
          console.error(`[Container Manager] Error monitoring ${config.name}:`, error);
          await addLog({
            containerName: config.name,
            eventType: 'error',
            message: `监控异常: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      
      // 设置下一次检查
      monitorInterval = setTimeout(runMonitorCycle, checkInterval * 1000);
    } catch (error) {
      console.error('[Container Manager] Error in monitor cycle:', error);
      monitorInterval = setTimeout(runMonitorCycle, 60000); // 出错后等待60秒重试
    }
  };
  
  // 立即执行第一次
  await runMonitorCycle();
}

export function stopMonitoring() {
  if (monitorInterval) {
    clearTimeout(monitorInterval);
    monitorInterval = null;
  }
  isRunning = false;
  console.log('[Container Manager] Monitoring stopped');
}

export function isMonitoring(): boolean {
  return isRunning;
}
