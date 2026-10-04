// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const reservations = sqliteTable('reservations', {
 id: text('id').primaryKey(), title: text('title').notNull(), sector: text('sector').notNull(), sectors_json: text('sectors_json'),
 responsible: text('responsible').notNull(), contact: text('contact').notNull(), date: text('date').notNull(),
 start: text('start').notNull(), end: text('end').notNull(), service: text('service').notNull(),
 guests: integer('guests').notNull(), notes: text('notes').notNull(), prepared: integer('prepared').notNull().default(0),
 updated: text('updated').notNull(), series_id: text('series_id'), repeat_ordinal: integer('repeat_ordinal'), repeat_weekday: integer('repeat_weekday'), repeat_until: text('repeat_until'), repeat_rule: text('repeat_rule'),
}, t => [index('idx_reservations_date').on(t.date),index('idx_reservations_series').on(t.series_id)]);
export const settings = sqliteTable('settings', {id:integer('id').primaryKey(),name:text('name').notNull(),sectors:text('sectors').notNull()});
export const missionPeople = sqliteTable('mission_people',{id:text('id').primaryKey(),name:text('name').notNull(),active:integer('active').notNull().default(1)});
export const missionPlaces = sqliteTable('mission_places',{id:text('id').primaryKey(),name:text('name').notNull(),active:integer('active').notNull().default(1)});
export const missionTrips = sqliteTable('mission_trips',{id:text('id').primaryKey(),date:text('date').notNull(),place_id:text('place_id').notNull(),people_json:text('people_json').notNull(),notes:text('notes').notNull(),updated:text('updated').notNull()},t=>[index('idx_mission_trips_date').on(t.date)]);

