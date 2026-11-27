// the real services pull in every social provider, the spec only needs the shape
jest.mock('@gitroom/nestjs-libraries/database/prisma/errors/errors.service', () => ({ ErrorsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.service', () => ({ AdminStatsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/affiliates/affiliate.service', () => ({ AffiliateService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/reviews/review.service', () => ({ ReviewService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/measurement/measurement.service', () => ({ MeasurementService: class {} }));

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminController } from './admin.controller';
import { AdminUsersDto } from '@gitroom/nestjs-libraries/dtos/users/admin.users.dto';

const adminStatsService = {
  listUsers: jest.fn().mockResolvedValue({ items: [], total: 0 }),
};

describe('AdminController users', () => {
  const controller = new AdminController(
    {} as any,
    adminStatsService as any,
    {} as any,
    {} as any,
    {} as any
  );
  const admin: any = { id: 'a1', isSuperAdmin: true };
  const regular: any = { id: 'u1', isSuperAdmin: false };

  beforeEach(() => jest.clearAllMocks());

  it('lists the users of the page and filter for a super admin', async () => {
    expect(await controller.listUsers(admin, { page: 2, q: 'acme' })).toEqual({
      items: [],
      total: 0,
    });
    expect(adminStatsService.listUsers).toHaveBeenCalledWith({
      page: 2,
      q: 'acme',
    });
  });

  it('starts on the first page without a filter', async () => {
    await controller.listUsers(admin, {});
    expect(adminStatsService.listUsers).toHaveBeenCalledWith({
      page: 0,
      q: undefined,
    });
  });

  it('refuses a regular or missing user before reading any user', async () => {
    await expect(controller.listUsers(regular, {})).rejects.toThrow(
      'Unauthorized'
    );
    await expect(controller.listUsers(undefined as any, {})).rejects.toThrow(
      'Unauthorized'
    );
    expect(adminStatsService.listUsers).not.toHaveBeenCalled();
  });
});

describe('AdminUsersDto', () => {
  const check = (query: Record<string, string>) =>
    validate(plainToInstance(AdminUsersDto, query));

  it('takes a page number from the query string and a filter', async () => {
    const dto = plainToInstance(AdminUsersDto, { page: '3', q: 'Acme' });
    expect(dto.page).toBe(3);
    expect(await validate(dto)).toHaveLength(0);
    expect(await check({})).toHaveLength(0);
  });

  it('refuses a negative, fractional or non numeric page and a long filter', async () => {
    expect(await check({ page: '-1' })).toHaveLength(1);
    expect(await check({ page: '1.5' })).toHaveLength(1);
    expect(await check({ page: 'abc' })).toHaveLength(1);
    expect(await check({ page: '10001' })).toHaveLength(1);
    expect(await check({ q: 'x'.repeat(201) })).toHaveLength(1);
  });
});
