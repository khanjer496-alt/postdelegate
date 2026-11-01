// the real services pull in every social provider, the spec injects fakes
jest.mock('@gitroom/nestjs-libraries/database/prisma/notifications/notification.service', () => ({ NotificationService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository', () => ({ OrganizationRepository: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service', () => ({ AutopostService: class {} }));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({ emailButton: () => '' }));

import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';

const removeAs = async (myRole: Role, theirRole: Role, self = false) => {
  const repository = {
    getOrgsByUserId: jest.fn(async () => [
      { id: 'org-A', users: [{ role: theirRole }] },
    ]),
    deleteTeamMember: jest.fn(async () => ({})),
  };
  const service = new OrganizationService(repository as any, {} as any);
  const org = { id: 'org-A', users: [{ role: myRole }] } as any;
  const result = service.deleteTeamMember(
    org,
    'member',
    self ? 'member' : 'me'
  );
  return { result, repository };
};

describe('OrganizationService.deleteTeamMember', () => {
  it.each([
    ['ADMIN', 'USER'],
    ['SUPERADMIN', 'ADMIN'],
    ['SUPERADMIN', 'USER'],
  ] as const)('lets a %s remove a %s', async (me, them) => {
    const { result, repository } = await removeAs(me, them);
    await expect(result).resolves.toBeDefined();
    expect(repository.deleteTeamMember).toHaveBeenCalledWith('org-A', 'member');
  });

  it.each([
    ['ADMIN', 'ADMIN'],
    ['ADMIN', 'SUPERADMIN'],
    ['USER', 'USER'],
  ] as const)('does not let a %s remove a %s', async (me, them) => {
    const { result, repository } = await removeAs(me, them);
    await expect(result).rejects.toMatchObject({ status: 403 });
    expect(repository.deleteTeamMember).not.toHaveBeenCalled();
  });

  it('does not let a super admin remove themselves', async () => {
    const { result, repository } = await removeAs('SUPERADMIN', 'SUPERADMIN', true);
    await expect(result).rejects.toMatchObject({ status: 400 });
    expect(repository.deleteTeamMember).not.toHaveBeenCalled();
  });
});
