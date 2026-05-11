import { z } from 'zod';

export const containerCreateSchema = z.object({
  name: z.string().min(1).max(255),
  startupDelay: z.number().int().min(0).default(0),
  monitor: z.boolean().default(true),
});

export const containerUpdateSchema = z.object({
  id: z.number().int().positive(),
  startupDelay: z.number().int().min(0),
  monitor: z.boolean(),
});

export const containerReorderSchema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive(),
    startupOrder: z.number().int().min(0),
  })),
});

export const logsListSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(100),
});

export const settingsUpdateSchema = z.object({
  checkInterval: z.number().int().min(5).default(60),
});
