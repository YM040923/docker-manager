import { containerCreateSchema, containerUpdateSchema, containerReorderSchema, logsListSchema, settingsUpdateSchema } from "@shared/validators";
import { z } from 'zod';

import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getContainerConfigs, createContainerConfig, updateContainerConfig, deleteContainerConfig, reorderContainerConfigs, getGlobalSettings, updateGlobalSettings, getLogs } from "./db";
import { getContainerStatus, startContainer, restartContainer, getAllContainers } from "./docker";
import { startContainerSequence, startMonitoring, stopMonitoring, isMonitoring } from "./containerManager";
import { addLog } from "./db";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie("docker_manager_auth", { path: "/" });
      return {
        success: true,
      } as const;
    }),
  }),

  containers: router({
    list: protectedProcedure.query(async () => {
      return await getContainerConfigs();
    }),

    status: protectedProcedure.query(async () => {
      const configs = await getContainerConfigs();
      const allContainers = await getAllContainers();
      return configs.map(config => {
        const found = allContainers.find(dc => dc.name === config.name);
        return {
          ...config,
          dockerStatus: found
            ? (found.status.includes('Up') ? 'running' : 'stopped')
            : 'not_found' as const,
        };
      });
    }),

    discover: protectedProcedure.query(async () => {
      const allContainers = await getAllContainers();
      const configuredContainers = await getContainerConfigs();
      const configuredNames = new Set(configuredContainers.map(c => c.name));

      return allContainers
        .filter(c => !configuredNames.has(c.name))
        .map(c => ({
          name: c.name,
          status: c.status,
        }));
    }),
    create: protectedProcedure
      .input(containerCreateSchema)
      .mutation(async ({ input }) => {
        const configs = await getContainerConfigs();
        const existing = configs.find(c => c.name === input.name);
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '容器已存在',
          });
        }
        const maxOrder = configs.length > 0 ? Math.max(...configs.map(c => c.startupOrder)) : -1;
        return await createContainerConfig({
          name: input.name,
          startupDelay: input.startupDelay,
          monitor: input.monitor ? 1 : 0,
          startupOrder: maxOrder + 1,
        });
      }),
    update: protectedProcedure
      .input(containerUpdateSchema)
      .mutation(async ({ input }) => {
        return await updateContainerConfig(input.id, {
          startupDelay: input.startupDelay,
          monitor: input.monitor ? 1 : 0,
        });
      }),
    delete: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input }) => {
        return await deleteContainerConfig(input);
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
        return await updateGlobalSettings({ checkInterval: input.checkInterval });
      }),
  }),

  logs: router({
    list: protectedProcedure
      .input(logsListSchema)
      .query(async ({ input }) => {
        return await getLogs(input.limit);
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
          // 验证容器在管理列表中
          const configs = await getContainerConfigs();
          if (!configs.find(c => c.name === input)) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '容器不在管理列表中' });
          }
          const success = await startContainer(input);
          if (success) {
            await addLog({
              containerName: input,
              eventType: 'startup',
              message: '容器手动启动成功',
            });
          } else {
            await addLog({
              containerName: input,
              eventType: 'error',
              message: '容器手动启动失败',
            });
          }
          return { success };
        } catch (error) {
          await addLog({
            containerName: input,
            eventType: 'error',
            message: `启动异常: ${error instanceof Error ? error.message : String(error)}`,
          });
          return { success: false };
        }
      }),

    restartContainer: protectedProcedure
      .input(z.string().min(1))
      .mutation(async ({ input }) => {
        try {
          const configs = await getContainerConfigs();
          if (!configs.find(c => c.name === input)) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '容器不在管理列表中' });
          }
          const success = await restartContainer(input);
          if (success) {
            await addLog({
              containerName: input,
              eventType: 'restart',
              message: '容器手动重启成功',
            });
          } else {
            await addLog({
              containerName: input,
              eventType: 'error',
              message: '容器手动重启失败',
            });
          }
          return { success };
        } catch (error) {
          await addLog({
            containerName: input,
            eventType: 'error',
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
