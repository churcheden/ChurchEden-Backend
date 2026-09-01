/**
 * Idempotent data seed: creates the three starter churches in the church
 * directory (Assets/Seed). Matches the shape used by the onboarding flow —
 * each church gets its service times and default ministries.
 *
 * The seed is keyed on Church.name (a natural key) so re-running it never
 * creates duplicates.
 *
 * Usage:
 *   tsx scripts/seed-churches.ts                    # dry run (no writes)
 *   DRY_RUN=false tsx scripts/seed-churches.ts      # apply
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

interface SeedChurch {
    name: string;
    denomination: string;
    congregationSize: 'RANGE_1_100' | 'RANGE_101_500' | 'RANGE_501_1000' | 'RANGE_1001_2000' | 'RANGE_2000_PLUS';
    foundedYear: number;
    country: string;
    city: string;
    address: string;
    phone: string;
    email: string;
    primaryLanguage: 'ENGLISH' | 'FRENCH' | 'SPANISH';
    timeZone: string;
    serviceTimes: Array<{ label: string; dayOfWeek: number; time: string }>;
    ministries: Array<{ name: string; type: string; description?: string }>;
}

const SEED_CHURCHES: SeedChurch[] = [
    {
        name: "Redeemer's Chapel International",
        denomination: 'Non-denominational',
        congregationSize: 'RANGE_501_1000',
        foundedYear: 2012,
        country: 'Ghana',
        city: 'Ridge, Accra',
        address: '14 Independence Ave, Ridge, Accra',
        phone: '+233241234501',
        email: 'info@redeemerschapel.org',
        primaryLanguage: 'ENGLISH',
        timeZone: 'Africa/Accra',
        serviceTimes: [
            { label: 'Sunday Service', dayOfWeek: 0, time: '09:00' },
            { label: 'Midweek Bible Study', dayOfWeek: 3, time: '18:30' },
        ],
        ministries: [
            { name: 'Worship & Music', type: 'MINISTRY', description: 'Praise and worship team' },
            { name: 'Youth', type: 'MINISTRY', description: 'Youth ministry for young adults' },
            { name: 'Children', type: 'DEPARTMENT', description: 'Kids church and Sunday school' },
        ],
    },
    {
        name: 'Grace Life Cathedral',
        denomination: 'Pentecostal',
        congregationSize: 'RANGE_1001_2000',
        foundedYear: 2010,
        country: 'Ghana',
        city: 'East Legon, Accra',
        address: 'Lagos Avenue, East Legon, Accra',
        phone: '+233241234502',
        email: 'hello@gracelifecathedral.org',
        primaryLanguage: 'ENGLISH',
        timeZone: 'Africa/Accra',
        serviceTimes: [
            { label: 'Sunday Service', dayOfWeek: 0, time: '09:30' },
            { label: 'Week of Prayer', dayOfWeek: 2, time: '18:00' },
        ],
        ministries: [
            { name: 'Worship & Music', type: 'MINISTRY', description: 'Worship ministry' },
            { name: 'Small Groups', type: 'MINISTRY', description: 'Life groups and cell meetings' },
            { name: 'Leadership', type: 'DEPARTMENT', description: 'Leadership development' },
        ],
    },
    {
        name: 'Kingdom Harvest International',
        denomination: 'Charismatic',
        congregationSize: 'RANGE_101_500',
        foundedYear: 2016,
        country: 'Ghana',
        city: 'Tema, Greater Accra',
        address: '23 Community 7, Tema',
        phone: '+233241234503',
        email: 'contact@kingdomharvest.org',
        primaryLanguage: 'ENGLISH',
        timeZone: 'Africa/Accra',
        serviceTimes: [
            { label: 'Sunday Service', dayOfWeek: 0, time: '10:00' },
            { label: 'Midweek Service', dayOfWeek: 4, time: '18:30' },
        ],
        ministries: [
            { name: 'Worship & Music', type: 'MINISTRY', description: 'Worship team' },
            { name: 'Missions', type: 'MINISTRY', description: 'Outreach and missions' },
            { name: 'Media', type: 'DEPARTMENT', description: 'Media and communication' },
        ],
    },
];

const main = async (): Promise<void> => {
    const connectionString = resolveBaseUrl();
    console.log(`Target: ${connectionString.split('@').pop() ?? connectionString}`);
    console.log(`Mode:   ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY (writes to DB)'}`);

    const schemaParam = new URL(connectionString).searchParams.get('schema');
    const adapter = new PrismaNeon(
        { connectionString },
        schemaParam ? { schema: schemaParam } : undefined,
    );
    const client = new PrismaClient({ adapter });

    try {
        let created = 0;
        let skipped = 0;

        for (const church of SEED_CHURCHES) {
            const existing = await client.church.findFirst({
                where: { name: church.name },
                select: { id: true },
            });

            if (existing) {
                console.log(`  - skip (already exists): ${church.name}`);
                skipped += 1;
                continue;
            }

            console.log(`  - create: ${church.name} (${church.city})`);
            created += 1;

            if (!DRY_RUN) {
                await client.church.create({
                    data: {
                        name: church.name,
                        denomination: church.denomination,
                        congregationSize: church.congregationSize,
                        foundedYear: church.foundedYear,
                        country: church.country,
                        city: church.city,
                        address: church.address,
                        phone: church.phone,
                        email: church.email,
                        primaryLanguage: church.primaryLanguage,
                        timeZone: church.timeZone,
                        serviceTimes: {
                            create: church.serviceTimes.map((st) => ({
                                label: st.label,
                                dayOfWeek: st.dayOfWeek,
                                time: st.time,
                            })),
                        },
                        ministries: {
                            create: church.ministries.map((m) => ({
                                name: m.name,
                                type: m.type,
                                description: m.description,
                            })),
                        },
                    },
                });
            }
        }

        console.log(
            DRY_RUN
                ? `Dry run complete. ${created} church(es) would be created, ${skipped} already exist. Run with DRY_RUN=false to apply.`
                : `Applied. Created ${created} church(es), skipped ${skipped} existing.`,
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
