import { AUTH_COOKIE_NAME } from "@shared/const";
import {
  containerCreateSchema,
  containerReorderSchema,
  containerUpdateSchema,
  logsListSchema,
  settingsUpdateSchema,
} from "@shared/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addLog,
  createContainerConfig,
  deleteContainerConfig,
  getContainerConfigs,
  getGlobalSettings,
  getLogs,
  reorderContainerConfigs,
  updateContainerConfig,
  updateGlobalSettings,
} from "./db";
import {
  isMonitoring,
  startContainerSequence,
  startMonitoring,
  stopMonitoring,
} from "./containerManager";
import {
  getAllContainers,
  getContainerStatus,
  restartContainer,
  startContainer,
} from "./docker";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";

async function assertManagedContainer(containerName: string) {
  const configs = await getContainerConfigs();
  if (!configs.find(config => config.name === containerName)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "容器不在管理列表中" });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
      return { success: true } as const;
    }),
  }),

  containers: router({
    list: protectedProcedure.query(async () => {
      return getContainerConfigs();
    }),

    status: protectedProcedure.query(async () => {
      const configs = await getContainerConfigs();
      const allContainers = await getAllContainers();
      return configs.map(config => {
        const found = allContainers.find(container => container.name === config.name);
        return {
          ...config,
          dockerStatus: found
            ? (found.status.includes("Up") ? "running" : "stopped")
            : "not_found" as const,
        };
      });
    }),

    discover: protectedProcedure.query(async () => {
      const allContainers = await getAllContainers();
      const configuredContainers = await getContainerConfigs();
      const configuredNames = new Set(configuredContainers.map(config => config.name));

      return allContainers
        .filter(container => !configuredNames.has(container.name))
        .map(container => ({
          name: container.name,
          status: container.status,
        }));
    }),

    create: protectedProcedure
      .input(containerCreateSchema)
      .mutation(async ({ input }) => {
        const configs = await getContainerConfigs();
        const existing = configs.find(config => config.name === input.name);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "容器已存在" });
        }

        const maxOrder = configs.length > 0
          ? Math.max(...configs.map(config => config.startupOrder))
          : -1;

        await createContainerConfig({
          name: input.name,
          startupDelay: input.startupDelay,
          monitor: input.monitor ? 1 : 0,
          startupOrder: maxOrder + 1,
        });
      }),

    update: protectedProcedure
      .input(containerUpdateSchema)
      .mutation(async ({ input }) => {
        await updateContainerConfig(input.id, {
          startupDelay: input.startupDelay,
          monitor: input.monitor ? 1 : 0,
        });
      }),

    delete: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input }) => {
        await deleteContainerConfig(input);
      }),

    reorder: protectedProcedure
      .input(containerReorderSchema)
      .mutation(async ({ input }) => {
        await reorderContainerConfigs(input.items);
      }),
  }),

  settings: router({
    get: protectedProcedure.query(async () => {
      const settings = await getGlobalSettings();
      return settings || { checkInterval: 60 };
    }),

    update: protectedProcedure
      .input(settingsUpdateSchema)
      .mutation(async ({ input }) => {
        await updateGlobalSettings({ checkInterval: input.checkInterval });
      }),
  }),

  logs: router({
    list: protectedProcedure
      .input(logsListSchema)
      .query(async ({ input }) => {
        return getLogs(input.limit);
      }),
  }),

  management: router({
    getStatus: protectedProcedure
      .input(z.string().min(1))
      .query(async ({ input }) => {
        const status = await getContainerStatus(input);
        return { containerName: input, status };
      }),

    startSequence: protectedProcedure.mutation(async () => {
      startContainerSequence();
      return { success: true };
    }),

    startContainer: protectedProcedure
      .input(z.string().min(1))
      .mutation(async ({ input }) => {
        try {
          await assertManagedContainer(input);
          const success = await startContainer(input);
          await addLog({
            containerName: input,
            eventType: success ? "startup" : "error",
            message: success ? "容器手动启动成功" : "容器手动启动失败",
          });
          return { success };
        } catch (error) {
          await addLog({
            containerName: input,
            eventType: "error",
            message: `启动异常: ${error instanceof Error ? error.message : String(error)}`,
          });
          return { success: false };
        }
      }),

    restartContainer: protectedProcedure
      .input(z.string().min(1))
      .mutation(async ({ input }) => {
        try {
          await assertManagedContainer(input);
          const success = await restartContainer(input);
          await addLog({
            containerName: input,
            eventType: success ? "restart" : "error",
            message: success ? "容器手动重启成功" : "容器手动重启失败",
          });
          return { success };
        } catch (error) {
          await addLog({
            containerName: input,
            eventType: "error",
            message: `重启异常: ${error instanceof Error ? error.message : String(error)}`,
          });
          return { success: false };
        }
      }),

    startMonitoring: protectedProcedure.mutation(async () => {
      if (!isMonitoring()) {
        await startContainerSequence();
        startMonitoring();
      }
      return { success: true, monitoring: true };
    }),

    stopMonitoring: protectedProcedure.mutation(async () => {
      stopMonitoring();
      return { success: true, monitoring: false };
    }),

    isMonitoring: protectedProcedure.query(async () => {
      return { monitoring: isMonitoring() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
