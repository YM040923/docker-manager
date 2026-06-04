import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as containerManager from "./containerManager";
import * as db from "./db";
import * as docker from "./docker";

vi.mock("./docker");
vi.mock("./db");

describe("Container Manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    containerManager.stopMonitoring();
    vi.useRealTimers();
  });

  describe("startContainerSequence", () => {
    it("starts containers in order after verifying they are running", async () => {
      vi.mocked(db.getContainerConfigs).mockResolvedValue([
        { id: 1, name: "mysql", startupOrder: 0, startupDelay: 0, monitor: 1 },
        { id: 2, name: "redis", startupOrder: 1, startupDelay: 0, monitor: 1 },
      ] as any);
      vi.mocked(docker.getContainerStatus)
        .mockResolvedValueOnce("stopped")
        .mockResolvedValueOnce("running")
        .mockResolvedValueOnce("stopped")
        .mockResolvedValueOnce("running");
      vi.mocked(docker.startContainer).mockResolvedValue(true);
      vi.mocked(db.addLog).mockResolvedValue(undefined);

      await containerManager.startContainerSequence();

      expect(vi.mocked(docker.startContainer).mock.calls.map(call => call[0]))
        .toEqual(["mysql", "redis"]);
      expect(vi.mocked(db.addLog)).toHaveBeenCalledWith(expect.objectContaining({
        containerName: "mysql",
        eventType: "startup",
      }));
      expect(vi.mocked(db.addLog)).toHaveBeenCalledWith(expect.objectContaining({
        containerName: "redis",
        eventType: "startup",
      }));
    });

    it("logs an error when startup keeps failing", async () => {
      vi.useFakeTimers();
      vi.mocked(db.getContainerConfigs).mockResolvedValue([
        { id: 1, name: "mysql", startupOrder: 0, startupDelay: 0, monitor: 1 },
      ] as any);
      vi.mocked(docker.getContainerStatus).mockResolvedValue("stopped");
      vi.mocked(docker.startContainer).mockResolvedValue(false);
      vi.mocked(db.addLog).mockResolvedValue(undefined);

      const sequence = containerManager.startContainerSequence();
      await vi.advanceTimersByTimeAsync(5000 * 19);
      await sequence;

      expect(vi.mocked(db.addLog)).toHaveBeenCalledWith(expect.objectContaining({
        containerName: "mysql",
        eventType: "error",
      }));
    });
  });

  describe("monitoring", () => {
    it("detects and restarts stopped containers", async () => {
      vi.mocked(db.getContainerConfigs).mockResolvedValue([
        { id: 1, name: "mysql", startupOrder: 0, startupDelay: 0, monitor: 1 },
      ] as any);
      vi.mocked(db.getGlobalSettings).mockResolvedValue({ checkInterval: 1 } as any);
      vi.mocked(docker.getContainerStatus)
        .mockResolvedValueOnce("stopped")
        .mockResolvedValueOnce("running");
      vi.mocked(docker.restartContainer).mockResolvedValue(true);
      vi.mocked(db.addLog).mockResolvedValue(undefined);

      containerManager.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(vi.mocked(docker.restartContainer)).toHaveBeenCalledWith("mysql");
      expect(vi.mocked(db.addLog)).toHaveBeenCalledWith(expect.objectContaining({
        containerName: "mysql",
        eventType: "restart",
      }));
    });

    it("skips containers with monitor disabled", async () => {
      vi.mocked(db.getContainerConfigs).mockResolvedValue([
        { id: 1, name: "mysql", startupOrder: 0, startupDelay: 0, monitor: 0 },
      ] as any);
      vi.mocked(db.getGlobalSettings).mockResolvedValue({ checkInterval: 1 } as any);

      containerManager.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(vi.mocked(docker.getContainerStatus)).not.toHaveBeenCalled();
    });

    it("tracks monitoring state", async () => {
      vi.mocked(db.getContainerConfigs).mockResolvedValue([]);
      vi.mocked(db.getGlobalSettings).mockResolvedValue({ checkInterval: 1 } as any);

      expect(containerManager.isMonitoring()).toBe(false);
      containerManager.startMonitoring();
      expect(containerManager.isMonitoring()).toBe(true);
      containerManager.stopMonitoring();
      expect(containerManager.isMonitoring()).toBe(false);
    });
  });
});
