import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE, SessionService } from './session.service';

export const PUBLIC = 'public';
/** Marks a route as reachable without a session. */
export const Public = () => SetMetadata(PUBLIC, true);

export interface AuthedRequest extends Request {
  userId: string;
  sessionId: string;
}

/** Global guard: every /api route needs a session unless marked @Public(). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private sessions: SessionService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const s = await this.sessions.resolve(req.cookies?.[SESSION_COOKIE]);
    if (s) { req.userId = s.userId; req.sessionId = s.sessionId; }
    if (!s && !isPublic) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    return true;
  }
}

/**
 * CSRF defence for cookie auth: state-changing requests must carry a custom header.
 * Browsers cannot add it cross-origin without a CORS preflight, and CORS is not enabled.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (req.headers['x-openpass'] !== '1') throw new ForbiddenException({ code: 'CSRF', message: 'Missing X-OpenPass header' });
    return true;
  }
}

export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().userId);
export const SessionId = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().sessionId);

/** Requests per minute for sign-in style endpoints (AUTH_RATE_LIMIT, default 10 per IP). */
export const authLimit = () => Number(process.env.AUTH_RATE_LIMIT || 10);
