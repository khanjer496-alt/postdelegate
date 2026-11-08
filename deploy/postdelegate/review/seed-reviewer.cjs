// Local/owner-run only. Never imported by the application or run during deploy.
const { readFileSync } = require('node:fs');

async function seedReviewer(prisma, config, passwordHash) {
  const { orgId, userId, email } = config;
  if (![orgId, userId].every(id => /^pd-review-[a-z0-9-]{3,80}$/.test(id || ''))) {
    throw new Error('Reviewer ids must start with pd-review- and use lowercase letters, numbers and hyphens.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !passwordHash) {
    throw new Error('Reviewer email and password hash are required.');
  }
  return prisma.$transaction(async tx => {
    // Create-only, never adopt a real account or workspace, including soft-deleted ones.
    if (await tx.user.findFirst({ where: { OR: [{ id: userId }, { email: { equals: email, mode: 'insensitive' } }] }, select: { id: true } })) {
      throw new Error('Reviewer user or email already exists; no records changed.');
    }
    if (await tx.organization.findFirst({ where: { id: orgId }, select: { id: true } })) {
      throw new Error('Reviewer workspace already exists; no records changed.');
    }
    await tx.user.create({ data: {
      id: userId, email, password: passwordHash, providerName: 'LOCAL',
      name: 'Platform Reviewer', timezone: 0, activated: true, isSuperAdmin: false,
      sendSuccessEmails: false, sendFailureEmails: false, sendStreakEmails: false,
      sendOnboardingEmails: false,
    }, select: { id: true } });
    await tx.organization.create({ data: {
      id: orgId, name: 'PostDelegate Platform Review', allowTrial: false, isTrailing: false,
    }, select: { id: true } });
    await tx.userOrganization.create({ data: {
      id: `${orgId}-membership`, userId, organizationId: orgId, role: 'ADMIN',
      weeklySummaryEmails: false,
    }, select: { id: true } });
    await tx.subscription.create({ data: {
      id: `${orgId}-plan`, organizationId: orgId, provider: 'manual',
      subscriptionTier: 'ULTIMATE', period: 'YEARLY', totalChannels: 10, isLifetime: true,
    }, select: { id: true } });
    return { orgId, userId };
  });
}

async function main() {
  const config = {
    orgId: process.env.REVIEWER_ORG_ID,
    userId: process.env.REVIEWER_USER_ID,
    email: process.env.REVIEWER_EMAIL,
  };
  if (!process.argv.includes('--apply')) {
    console.log('Dry run: creates a new reviewer user, workspace, membership and manual 10-channel plan. No database connection. Supply REVIEWER_ORG_ID, REVIEWER_USER_ID, REVIEWER_EMAIL and REVIEWER_PASSWORD_FILE; --apply is owner-run only.');
    return;
  }
  // Pass the protected Vault file path, never the password in argv or source.
  const password = readFileSync(process.env.REVIEWER_PASSWORD_FILE, 'utf8').trimEnd();
  if (password.length < 20) throw new Error('Use a Vault-generated password of at least 20 characters.');
  const { PrismaClient } = require('@prisma/client');
  const { hashSync } = require('bcrypt');
  const prisma = new PrismaClient();
  try { console.log(await seedReviewer(prisma, config, hashSync(password, 12))); }
  finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch(() => {
  // Prisma errors may contain connection strings or supplied row values.
  console.error('Reviewer seed failed. Check the input and whether the reviewer already exists; no secrets are printed.');
  process.exitCode = 1;
});
module.exports = { seedReviewer };
