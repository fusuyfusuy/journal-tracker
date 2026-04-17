import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AppConfig } from '@journal/shared';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const incomingHeader = request.headers['x-api-key'];

    if (!incomingHeader) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (Array.isArray(incomingHeader)) {
      throw new UnauthorizedException('Multiple X-API-Key headers are not allowed');
    }

    const incoming = incomingHeader;

    const cfg = this.config.get<AppConfig>('app');
    const apiKeys: string[] = cfg?.apiKeys ?? [];

    const matched = apiKeys.some((key) => this.timingSafeCompare(incoming, key));
    if (!matched) {
      throw new UnauthorizedException('Invalid X-API-Key');
    }

    return true;
  }

  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still do a comparison to avoid early-exit timing leaks on length
      const bufA = Buffer.from(a);
      const bufB = Buffer.alloc(bufA.length);
      Buffer.from(b).copy(bufB, 0, 0, Math.min(b.length, bufA.length));
      crypto.timingSafeEqual(bufA, bufB);
      return false;
    }
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
