import { GoogleGenAI } from '@google/genai';
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');

/**
 * One shared GoogleGenAI instance for the process. The SDK object is a thin,
 * stateless HTTP wrapper, so constructing it per-request would only add
 * overhead and make the API key harder to trace.
 */
export const GeminiClientProvider: Provider = {
  provide: GEMINI_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): GoogleGenAI =>
    new GoogleGenAI({ apiKey: config.getOrThrow<string>('gemini.apiKey') }),
};
