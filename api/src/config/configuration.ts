export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  maxUploadBytes: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
}

export interface DatabaseConfig {
  uri: string;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  thinkingBudget: number;
}

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '10', 10) * 1024 * 1024,
  } satisfies AppConfig,
  auth: {
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  } satisfies AuthConfig,
  database: {
    uri: process.env.MONGODB_URI as string,
  } satisfies DatabaseConfig,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY as string,
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET ?? '0', 10),
  } satisfies GeminiConfig,
});
