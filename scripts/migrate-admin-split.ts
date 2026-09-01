/**
 * One-time data migration: splits the old single-identity model into the new
 * Admin/Member split.
 *
 * Before this migration, church admins were modelled as a ChurchMembership
 * row with role in (ADMIN, SUPER_ADMIN). After the schema change, admins live
 * in the dedicated Admin table (Admins) — a login identity separate from the
 * member User — and ChurchMembership.role should only ever be MEMBER.
 *
 * This script:
 *   1. Finds every APPROVED membership whose role is ADMIN or SUPER_ADMIN.
 *   2. Creates one Admin row per user (email, linkedUserId, church, role),
 *      reusing an existing Admin row if one is already linked to that user.
 *   3. Downgrades those memberships to MEMBER so member history and sign-in
 *      are untouched — the user now signs into the dashboard as an Admin.
 *
 * Usage:
 *   tsx scripts/migrate-admin-split.ts            # dry run (no writes)
 *   DRY_RUN=false tsx scripts/migrate-admin-split.ts   # apply
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.env.DRY_RUN !== 'false';

const ROOT = process.cwd();

const parseDotEnv = (filePath: string): Record<string, string> => {
    if (!existsSync(filePath)) return {};
    const vars: Record<string, string> = {};
    for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        vars[key] = value;
    }
    return vars;
};

const resolveBaseUrl = (): string => {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const vars = parseDotEnv(join(ROOT, '.env'));
    const url = vars.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is required. Set it in the environment or in .env');
    }
    return url;
};

const main = async (): Promise<void> => {
    const connectionString = resolveBaseUrl();
    // Print the host only — never the credentials.
    console.log(`Target: ${connectionString.split('@').pop() ?? connectionString}`);
    console.log(`Mode:   ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY (writes to DB)'}`);

    const schemaParam = new URL(connectionString).searchParams.get('schema');
    const adapter = new PrismaNeon(
        { connectionString },
        schemaParam ? { schema: schemaParam } : undefined,
    );
    const client = new PrismaClient({ adapter });

    try {
        const adminMemberships = await client.churchMembership.findMany({
            where: {
                role: { in: ['ADMIN', 'SUPER_ADMIN'] },
                status: 'APPROVED',
            },
            include: {
                user: { select: { id: true, email: true, fullName: true } },
                church: { select: { id: true, name: true } },
            },
        });

        console.log(`Found ${adminMemberships.length} admin/SUPER_ADMIN memberships to migrate.`);

        if (adminMemberships.length === 0) {
            console.log('Nothing to migrate.');
            return;
        }

        // Group by user so we create exactly one Admin row per user (the Admin
        // email and linkedUserId are both globally unique).
        const adminsCreated = new Map<string, { id: string; email: string; role: string; churchId: string }>();

        for (const m of adminMemberships) {
            const existingAdmin = await client.admin.findFirst({
                where: {
                    OR: [{ linkedUserId: m.user.id }, { email: m.user.email }],
                },
            });

            const role = m.role as 'ADMIN' | 'SUPER_ADMIN';

            if (existingAdmin) {
                // Reuse the existing Admin row and elevate its role if needed,
                // but keep the membership's church for the first one.
                if (!adminsCreated.has(m.user.id)) {
                    adminsCreated.set(m.user.id, {
                        id: existingAdmin.id,
                        email: existingAdmin.email,
                        role: existingAdmin.role,
                        churchId: existingAdmin.churchId,
                    });
                }
                if (existingAdmin.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
                    console.log(`  - elevating Admin ${existingAdmin.email} to ${role}`);
                    if (!DRY_RUN) {
                        await client.admin.update({
                            where: { id: existingAdmin.id },
                            data: { role: 'SUPER_ADMIN' },
                        });
                    }
                    const record = adminsCreated.get(m.user.id)!;
                    adminsCreated.set(m.user.id, { ...record, role: 'SUPER_ADMIN' });
                }
            } else {
                console.log(`  - new Admin: ${m.user.email} (${role}) @ ${m.church.name}`);
                if (!DRY_RUN) {
                    const created = await client.admin.create({
                        data: {
                            email: m.user.email,
                            fullName: m.user.fullName,
                            churchId: m.church.id,
                            role,
                            linkedUserId: m.user.id,
                            isActive: true,
                            loginProvider: 'EMAIL',
                            isVerified: true,
                        },
                    });
                    adminsCreated.set(m.user.id, {
                        id: created.id,
                        email: created.email,
                        role: created.role,
                        churchId: created.churchId,
                    });
                } else {
                    adminsCreated.set(m.user.id, {
                        id: 'pending',
                        email: m.user.email,
                        role,
                        churchId: m.church.id,
                    });
                }
            }

            // Downgrade the membership so member history stays a MEMBER.
            if (!DRY_RUN) {
                await client.churchMembership.update({
                    where: { id: m.id },
                    data: { role: 'MEMBER' },
                });
            }
        }

        console.log(
            DRY_RUN
                ? `Dry run complete. Run with DRY_RUN=false to apply (${adminsCreated.size} admin(s) would be created/updated).`
                : `Applied. Created/updated ${adminsCreated.size} Admin row(s); downgraded memberships to MEMBER.`,
        );
    } finally {
        await client.$disconnect();
    }
};

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
