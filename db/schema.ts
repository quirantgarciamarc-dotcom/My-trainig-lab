import { boolean, index, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// One row per Netlify Identity user. user_id is the Identity user id (JWT "sub").
export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull().default(''),
  username: text('username').notNull().default(''),
  displayName: text('display_name').notNull().default(''),
  age: text('age').notNull().default(''),
  heightCm: text('height_cm').notNull().default(''),
  currentWeightKg: text('current_weight_kg').notNull().default(''),
  goalWeightKg: text('goal_weight_kg').notNull().default(''),
  goalFatPercent: text('goal_fat_percent').notNull().default(''),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Full personal app state (history, body measurements, recovery metrics, plans, chat…) per user.
export const userAppData = pgTable('user_app_data', {
  userId: text('user_id').primaryKey().references(() => userProfiles.userId, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Server-side quota log for the AI coach.
export const coachUsageLog = pgTable('coach_usage_log', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  quotaKey: text('quota_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('coach_usage_log_user_key_date_idx').on(table.userId, table.quotaKey, table.createdAt)]);
