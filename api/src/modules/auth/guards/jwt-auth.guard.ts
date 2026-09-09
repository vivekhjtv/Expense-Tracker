import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Types } from 'mongoose';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // Every query in the app scopes on req.userId; this is the only place
      // it is ever set, and it comes from a signature-verified token.
      request.userId = new Types.ObjectId(payload.sub);
      request.userEmail = payload.email;
      return true;
    } catch {
      // Expired and malformed are deliberately indistinguishable to the
      // caller — the client's reaction is identical either way.
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.header('authorization');
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
