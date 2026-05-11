import { COOKIE_NAME } from "@shared/const";

import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getContainerConfigs, createContainerConfig, updateContainerConfig, deleteContainerConfig, getGlobalSettings, updateGlobalSettings, getLogs } from "./db";
import { getContainerStatus, startContainer, restartContainer, getAllContainers } from "./docker";
import { startContainerSequence, startMonitoring, stopMonitoring, isMonitoring } from "./containerManager";
import { addLog } from "./db";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  containers: router({
    list: publicProcedure.query(async () => {
      return await getContainerConfigs();
    }),
    
    discover: publicProcedure.query(async () => {
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
    create: publicProcedure
      .input((val: any) => ({
        name: String(val.name),
        startupDelay: Number(val.startupDelay) || 0,
        monitor: Boolean(val.monitor),
      }))
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
    update: publicProcedure
      .input((val: any) => ({
        id: Number(val.id),
        startupDelay: Number(val.startupDelay),
        monitor: Boolean(val.monitor),
      }))
      .mutation(async ({ input }) => {
        return await updateContainerConfig(input.id, {
          startupDelay: input.startupDelay,
          monitor: input.monitor ? 1 : 0,
        });
      }),
    delete: publicProcedure
      .input((val: any) => Number(val.id))
      .mutation(async ({ input }) => {
        return await deleteContainerConfig(input);
      }),
    reorder: publicProcedure
      .input((val: any) => ({
        items: Array.isArray(val.items) ? val.items.map((item: any) => ({
          id: Number(item.id),
          startupOrder: Number(item.startupOrder),
        })) : [],
      }))
      .mutation(async ({ input }) => {
        for (const item of input.items) {
          await updateContainerConfig(item.id, { startupOrder: item.startupOrder });
        }
      }),
  }),

  settings: router({
    get: publicProcedure.query(async () => {
      const settings = await getGlobalSettings();
      return settings || { checkInterval: 60 };
    }),
    update: publicProcedure
      .input((val: any) => ({
        checkInterval: Number(val.checkInterval) || 60,
      }))
      .mutation(async ({ input }) => {
        return await updateGlobalSettings({ checkInterval: input.checkInterval });
      }),
  }),

  logs: router({
    list: publicProcedure
      .input((val: any) => ({
        limit: Number(val?.limit) || 100,
      }))
      .query(async ({ input }) => {
        return await getLogs(input.limit);
      }),
  }),

  management: router({
    getStatus: publicProcedure
      .input((val: any) => String(val.containerName))
      .query(async ({ input }) => {
        const status = await getContainerStatus(input);
        return { containerName: input, status };
      }),
    
    startSequence: publicProcedure.mutation(async () => {
      await startContainerSequence();
      return { success: true };
    }),
    
    startContainer: publicProcedure
      .input((val: any) => String(val.containerName))
      .mutation(async ({ input }) => {
        try {
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
    
    restartContainer: publicProcedure
      .input((val: any) => String(val.containerName))
      .mutation(async ({ input }) => {
        try {
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
    
    startMonitoring: publicProcedure.mutation(async () => {
      if (!isMonitoring()) {
        await startMonitoring();
      }
      return { success: true, monitoring: true };
    }),
    
    stopMonitoring: publicProcedure.mutation(async () => {
      stopMonitoring();
      return { success: true, monitoring: false };
    }),
    
    isMonitoring: publicProcedure.query(async () => {
      return { monitoring: isMonitoring() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
