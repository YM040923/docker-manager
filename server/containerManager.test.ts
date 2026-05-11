import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as containerManager from './containerManager';
import * as docker from './docker';
import * as db from './db';

vi.mock('./docker');
vi.mock('./db');

describe('Container Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    containerManager.stopMonitoring();
  });

  describe('startContainerSequence', () => {
    it('should start containers in order with delays', async () => {
      const mockConfigs = [
        { id: 1, name: 'mysql', startupOrder: 0, startupDelay: 1, monitor: 1 },
        { id: 2, name: 'redis', startupOrder: 1, startupDelay: 0, monitor: 1 },
      ];

      vi.mocked(db.getContainerConfigs).mockResolvedValue(mockConfigs as any);
      vi.mocked(docker.startContainer).mockResolvedValue(true);
      vi.mocked(db.addLog).mockResolvedValue(undefined);

      await containerManager.startContainerSequence();

      expect(vi.mocked(docker.startContainer)).toHaveBeenCalledWith('mysql');
      expect(vi.mocked(docker.startContainer)).toHaveBeenCalledWith('redis');
      expect(vi.mocked(db.addLog)).toHaveBeenCalledTimes(2);
    });

    it('should log errors when container startup fails', async () => {
      const mockConfigs = [
        { id: 1, name: 'mysql', startupOrder: 0, startupDelay: 0, monitor: 1 },
      ];

      vi.mocked(db.getContainerConfigs).mockResolvedValue(mockConfigs as any);
      vi.mocked(docker.startContainer).mockResolvedValue(false);
      vi.mocked(db.addLog).mockResolvedValue(undefined);

      await containerManager.startContainerSequence();

      expect(vi.mocked(db.addLog)).toHaveBeenCalledWith(
        expect.objectContaining({
          containerName: 'mysql',
          eventType: 'error',
        })
      );
    });
  });

  describe('monitoring', () => {
    it('should detect and restart stopped containers', async () => {
      const mockConfigs = [
        { id: 1, name: 'mysql', startupOrder: 0, startupDelay: 0, monitor: 1 },
      ];
      const mockSettings = { checkInterval: 1 };

      vi.mocked(db.getContainerConfigs).mockResolvedValue(mockConfigs as any);
      vi.mocked(db.getGlobalSettings).mockResolvedValue(mockSettings as any);
      vi.mocked(docker.getContainerStatus).mockResolvedValue('stopped');
      vi.mocked(docker.restartContainer).mockResolvedValue(true);
      vi.mocked(db.addLog).mockResolvedValue(undefined);

      await containerManager.startMonitoring();

      // 等待一个监控周期
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(vi.mocked(docker.restartContainer)).toHaveBeenCalledWith('mysql');
      expect(vi.mocked(db.addLog)).toHaveBeenCalledWith(
        expect.objectContaining({
          containerName: 'mysql',
          eventType: 'restart',
        })
      );

      containerManager.stopMonitoring();
    });

    it('should skip containers with monitor disabled', async () => {
      const mockConfigs = [
        { id: 1, name: 'mysql', startupOrder: 0, startupDelay: 0, monitor: 0 },
      ];
      const mockSettings = { checkInterval: 1 };

      vi.mocked(db.getContainerConfigs).mockResolvedValue(mockConfigs as any);
      vi.mocked(db.getGlobalSettings).mockResolvedValue(mockSettings as any);

      await containerManager.startMonitoring();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(vi.mocked(docker.getContainerStatus)).not.toHaveBeenCalled();

      containerManager.stopMonitoring();
    });

    it('should track monitoring state', async () => {
      expect(containerManager.isMonitoring()).toBe(false);

      const mockConfigs: any[] = [];
      const mockSettings = { checkInterval: 1 };

      vi.mocked(db.getContainerConfigs).mockResolvedValue(mockConfigs);
      vi.mocked(db.getGlobalSettings).mockResolvedValue(mockSettings as any);

      await containerManager.startMonitoring();

      expect(containerManager.isMonitoring()).toBe(true);

      containerManager.stopMonitoring();

      expect(containerManager.isMonitoring()).toBe(false);
    });
  });
});
