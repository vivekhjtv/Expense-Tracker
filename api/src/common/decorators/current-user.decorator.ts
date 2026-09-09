import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Types } from 'mongoose';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: Types.ObjectId;
    userEmail?: string;
  }
}

/** Injects the authenticated user's id, set by JwtAuthGuard from a verified token. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Types.ObjectId => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.userId) {
      // Only reachable if a route was marked @Public() but still asks for a
      // user — a wiring bug, not an authentication failure.
      throw new UnauthorizedException('Not signed in');
    }
    return request.userId;
  },
);
