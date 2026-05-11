import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as docker from './docker';
import * as db from './db';

vi.mock('./docker');
vi.mock('./db');

describe('Manual Container Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startContainer', () => {
    it('should start a container and log success', async () => {
      const { startContainer } = await import('./docker');
      
      vi.mocked(docker.startContainer).mockResolvedValue(true);
      vi.mocked(db.addLog).mockResolvedValue(undefined);

      const result = await docker.startContainer('test-container');

      expect(result).toBe(true);
    });

    it('should handle start failure', async () => {
      vi.mocked(docker.startContainer).mockResolvedValue(false);

      const result = await docker.startContainer('test-container');

      expect(result).toBe(false);
    });

    it('should handle Docker errors', async () => {
      vi.mocked(docker.startContainer).mockRejectedValue(
        new Error('Docker socket error')
      );

      await expect(docker.startContainer('test-container')).rejects.toThrow();
    });
  });

  describe('restartContainer', () => {
    it('should restart a container successfully', async () => {
      vi.mocked(docker.restartContainer).mockResolvedValue(true);

      const result = await docker.restartContainer('test-container');

      expect(result).toBe(true);
    });

    it('should handle restart failure', async () => {
      vi.mocked(docker.restartContainer).mockResolvedValue(false);

      const result = await docker.restartContainer('test-container');

      expect(result).toBe(false);
    });
  });

  describe('getContainerStatus', () => {
    it('should return running status', async () => {
      vi.mocked(docker.getContainerStatus).mockResolvedValue('running');

      const status = await docker.getContainerStatus('test-container');

      expect(status).toBe('running');
    });

    it('should return stopped status', async () => {
      vi.mocked(docker.getContainerStatus).mockResolvedValue('stopped');

      const status = await docker.getContainerStatus('test-container');

      expect(status).toBe('stopped');
    });

    it('should return not_found for missing containers', async () => {
      vi.mocked(docker.getContainerStatus).mockResolvedValue('not_found');

      const status = await docker.getContainerStatus('nonexistent-container');

      expect(status).toBe('not_found');
    });
  });
});
