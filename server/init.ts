import { startContainerSequence, startMonitoring } from './containerManager';

let initialized = false;

export async function initializeContainerManager() {
  if (initialized) {
    console.log('[Init] Container manager already initialized');
    return;
  }

  console.log('[Init] Initializing container manager...');
  
  try {
    // 启动容器序列
    await startContainerSequence();
    
    // 启动监控
    await startMonitoring();
    
    initialized = true;
    console.log('[Init] Container manager initialized successfully');
  } catch (error) {
    console.error('[Init] Error initializing container manager:', error);
  }
}

export function isInitialized(): boolean {
  return initialized;
}
