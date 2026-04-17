import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HealthCheckResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health-indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let redisIndicator: jest.Mocked<RedisHealthIndicator>;
  let dbIndicator: jest.Mocked<TypeOrmHealthIndicator>;

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
    dbIndicator = module.get(TypeOrmHealthIndicator);
  });

  describe('GET /health', () => {
    it('returns ok status with uptime unconditionally', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('GET /ready', () => {
    it('wires both db and redis check functions into health.check()', async () => {
      healthCheckService.check.mockResolvedValue(passingResult);
      dbIndicator.pingCheck.mockResolvedValue({ db: { status: 'up' } });
      redisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } });

      const result = await controller.readiness();
      expect(result).toEqual(passingResult);

      expect(healthCheckService.check).toHaveBeenCalledTimes(1);
      const checks = healthCheckService.check.mock.calls[0][0];
      expect(Array.isArray(checks)).toBe(true);
      expect(checks).toHaveLength(2);
      expect(typeof checks[0]).toBe('function');
      expect(typeof checks[1]).toBe('function');

      // Invoke the passed functions; they must delegate to the indicators
      // with the documented keys ('db' and 'redis').
      await checks[0]();
      await checks[1]();
      expect(dbIndicator.pingCheck).toHaveBeenCalledWith('db');
      expect(redisIndicator.isHealthy).toHaveBeenCalledWith('redis');
    });

    it('rejects with HealthCheckError when RedisHealthIndicator throws', async () => {
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
