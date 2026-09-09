import * as Joi from 'joi';

/**
 * Fail at boot, not at 2am on the first receipt scan. Every variable the app
 * reads is declared here and the process refuses to start without it.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),

  MONGODB_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),

  // 32 chars minimum: a short secret makes the signature brute-forceable
  // offline, which would let anyone mint a token for any user.
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('30d'),

  GEMINI_API_KEY: Joi.string().min(10).required(),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash'),
  GEMINI_THINKING_BUDGET: Joi.number().integer().min(-1).default(0),

  MAX_UPLOAD_SIZE_MB: Joi.number().integer().min(1).max(25).default(10),
});
