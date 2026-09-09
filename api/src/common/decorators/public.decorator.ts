import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JwtAuthGuard.
 *
 * Auth is deny-by-default: the guard is registered globally, so a new
 * controller is protected the moment it is written. Exposing a route is an
 * explicit, greppable decision rather than something you can forget to do.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
