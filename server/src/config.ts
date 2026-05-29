import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATA_DIR: z.string().default('./data'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET 至少 16 字符'),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(6, 'ADMIN_PASSWORD 至少 6 字符'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
