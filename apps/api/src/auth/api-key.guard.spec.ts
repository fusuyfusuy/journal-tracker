import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

function makeContext(
  headers: Record<string, string | undefined> = {},
  handler: object = {},
  cls: object = {},
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    const configService = {
      get: () => ({ apiKeys: ['valid-key', 'another-key'] }),
    } as unknown as ConfigService;
    guard = new ApiKeyGuard(reflector, configService);
  });

  it('allows a request with a valid key', () => {
    const ctx = makeContext({ 'x-api-key': 'valid-key' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException with invalid key', () => {
    const ctx = makeContext({ 'x-api-key': 'wrong-key' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException with no header', () => {
    const ctx = makeContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('allows a @Public() route without a key', () => {
    const handler = {};
    // Simulate reflector returning true for IS_PUBLIC_KEY
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    const ctx = makeContext({}, handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
