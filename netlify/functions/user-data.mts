import type { Config } from '@netlify/functions';
import { getUser } from '@netlify/identity';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { userAppData, userProfiles } from '../../db/schema.js';

const MAX_PAYLOAD_BYTES = 4_000_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const text = (value: unknown, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

type IdentityUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

async function ensureProfile(user: IdentityUser) {
  const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  if (existing) return existing;
  const meta = user.userMetadata ?? {};
  const username = text(meta.username, 24).toLowerCase() || (user.email ?? '').split('@')[0].slice(0, 24);
  const [created] = await db
    .insert(userProfiles)
    .values({ userId: user.id, email: user.email ?? '', username, displayName: text(meta.full_name, 80) || username })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  return row;
}

const publicProfile = (row: typeof userProfiles.$inferSelect) => ({
  username: row.username,
  displayName: row.displayName,
  email: row.email,
  onboardingCompleted: row.onboardingCompleted,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export default async (req: Request) => {
  const user = await getUser();
  if (!user) return json({ error: 'Sesión no válida. Inicia sesión de nuevo.' }, 401);

  if (req.method === 'GET') {
    const profile = await ensureProfile(user);
    const [data] = await db.select().from(userAppData).where(eq(userAppData.userId, user.id)).limit(1);
    return json({ profile: publicProfile(profile), payload: data?.payload ?? null, updatedAt: data?.updatedAt ?? null });
  }

  if (req.method === 'PUT') {
    const raw = await req.text();
    if (raw.length > MAX_PAYLOAD_BYTES) return json({ error: 'Los datos superan el tamaño máximo permitido.' }, 413);
    let body: { payload?: unknown };
    try { body = JSON.parse(raw); } catch { return json({ error: 'JSON no válido.' }, 400); }
    const payload = body?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ error: 'Formato de datos no válido.' }, 400);

    await ensureProfile(user);
    const p = payload as { profile?: Record<string, unknown>; onboarding?: { completed?: unknown } };
    const profile = p.profile ?? {};
    // Keep the summary profile columns in sync with the profile edited in the app.
    await db
      .update(userProfiles)
      .set({
        displayName: text(profile.name, 80) || sql`${userProfiles.displayName}`,
        age: text(profile.age, 10),
        heightCm: text(profile.heightCm, 10),
        currentWeightKg: text(profile.currentWeightKg, 10),
        goalWeightKg: text(profile.goalWeightKg, 10),
        goalFatPercent: text(profile.goalFatPercent, 10),
        onboardingCompleted: p.onboarding?.completed === true,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, user.id));
    const now = new Date();
    await db
      .insert(userAppData)
      .values({ userId: user.id, payload, updatedAt: now })
      .onConflictDoUpdate({ target: userAppData.userId, set: { payload, updatedAt: now } });
    return json({ ok: true, updatedAt: now });
  }

  return json({ error: 'Método no permitido.' }, 405);
};

export const config: Config = {
  path: '/api/me',
};
