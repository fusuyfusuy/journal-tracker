import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HealthCheckResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health-indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let redisIndicator: jest.Mocked<RedisHealthIndicator>;

  const passingResult: HealthCheckResult = {
    status: 'ok',
    info: { db: { status: 'up' }, redis: { status: 'up' } },
    error: {},
    details: { db: { status: 'up' }, redis: { status: 'up' } },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
        {
          provide: RedisHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get(HealthCheckService);
    redisIndicator = module.get(RedisHealthIndicator);
  });

  describe('GET /health', () => {
    it('returns ok status with uptime unconditionally', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('GET /ready', () => {
    it('returns aggregate health check result when all checks pass', async () => {
      healthCheckService.check.mockResolvedValue(passingResult);

      const result = await controller.readiness();
      expect(result).toEqual(passingResult);
      expect(healthCheckService.check).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Function)]));
    });

    it('surfaces 503 when RedisHealthIndicator throws', async () => {
      const { HealthCheckError } = await import('@nestjs/terminus');
      const errorResult: HealthCheckResult = {
        status: 'error',
        info: { db: { status: 'up' } },
        error: { redis: { status: 'down', message: 'Connection refused' } },
        details: { db: { status: 'up' }, redis: { status: 'down', message: 'Connection refused' } },
      };

      redisIndicator.isHealthy.mockRejectedValue(
        new HealthCheckError('Redis check failed', { redis: { status: 'down' } }),
      );
      healthCheckService.check.mockRejectedValue(
        Object.assign(new HealthCheckError('Health check failed', errorResult), { response: errorResult }),
      );

      await expect(controller.readiness()).rejects.toBeInstanceOf(HealthCheckError);
    });
  });
});
