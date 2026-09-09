import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';

/**
 * Liveness probe for the host platform.
 *
 * Public by necessity — the platform cannot present a token. It reports the
 * database connection state but deliberately nothing else: no versions, no
 * config, nothing worth having if someone finds it.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  check() {
    return {
      status: this.connection.readyState === 1 ? 'ok' : 'degraded',
      database: this.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
