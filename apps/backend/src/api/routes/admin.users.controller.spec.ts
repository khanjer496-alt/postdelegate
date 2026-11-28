// the real service pulls in every social and payment provider
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/admin-users/admin-users.service',
  () => ({ AdminUsersService: class {} })
);

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminUsersController } from './admin.users.controller';
import { AdminUsersListDto } from '@gitroom/nestjs-libraries/dtos/admin-users/admin.users.list.dto';

describe('AdminUsersController', () => {
  const service = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    summary: jest.fn().mockResolvedValue({ total: 0 }),
    getUser: jest.fn(),
  };
  const controller = new AdminUsersController(service as any);
  const admin: any = { id: 'a1', isSuperAdmin: true };
  const regular: any = { id: 'u1', isSuperAdmin: false };

  beforeEach(() => jest.clearAllMocks());

  it('lists, sums up and opens users for a super admin', async () => {
    const query = { search: 'acme', filter: 'paying' as const, page: 2 };
    expect(await controller.list(admin, query)).toEqual({ items: [], total: 0 });
    expect(service.list).toHaveBeenCalledWith(query);
    expect(await controller.summary(admin)).toEqual({ total: 0 });
    service.getUser.mockResolvedValue({ id: 'u2' });
    expect(await controller.getUser(admin, 'u2')).toEqual({ id: 'u2' });
  });

  it('answers 404 for a user that does not exist', async () => {
    service.getUser.mockResolvedValue(null);
    await expect(controller.getUser(admin, 'nope')).rejects.toThrow(
      'User not found'
    );
  });

  it('refuses a regular or missing user before reading any user', async () => {
    for (const who of [regular, undefined]) {
      await expect(controller.list(who, {})).rejects.toThrow('Unauthorized');
      await expect(controller.summary(who)).rejects.toThrow('Unauthorized');
      await expect(controller.getUser(who, 'u2')).rejects.toThrow(
        'Unauthorized'
      );
    }
    expect(service.list).not.toHaveBeenCalled();
    expect(service.summary).not.toHaveBeenCalled();
    expect(service.getUser).not.toHaveBeenCalled();
  });
});

describe('AdminUsersListDto', () => {
  const check = (query: Record<string, string>) =>
    validate(plainToInstance(AdminUsersListDto, query));

  it('takes page and limit from the query string, a search and a filter', async () => {
    const dto = plainToInstance(AdminUsersListDto, {
      page: '3',
      limit: '50',
      search: 'Acme',
      filter: 'needs_attention',
    });
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    expect(await validate(dto)).toHaveLength(0);
    expect(await check({})).toHaveLength(0);
  });

  it('refuses a bad page, a limit over 100, an unknown filter and a long search', async () => {
    expect(await check({ page: '0' })).toHaveLength(1);
    expect(await check({ page: '1.5' })).toHaveLength(1);
    expect(await check({ limit: '101' })).toHaveLength(1);
    expect(await check({ filter: 'everyone' })).toHaveLength(1);
    expect(await check({ search: 'x'.repeat(201) })).toHaveLength(1);
  });
});
