import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, ended } from '../lib/kitchen.ts';
import { validate, sameOrigin } from '../lib/reservations.ts';

const report = { performed: true, actual_guests: 83, total_spent: '12500,50', expected_revision: 0 };
test('preserves exact peso cents, accepts zero and rejects malformed financial input', () => {
  assert.equal(validateReport(report).spent_cents, 1250050);
  assert.equal(validateReport({ ...report, total_spent: '0', actual_guests: 0 }).spent_cents, 0);
  for (const total_spent of ['1.234,56', '-1', '1.001', '', '1e6', '10000000.01']) assert.throws(() => validateReport({ ...report, total_spent }));
  for (const actual_guests of ['', null, 1.5, -1, 10001]) assert.throws(() => validateReport({ ...report, actual_guests }));
});
test('requires a real event and a reason for each correction', () => {
  assert.throws(() => validateReport({ ...report, performed: false }));
  assert.throws(() => validateReport({ ...report, expected_revision: 1 }));
  assert.throws(() => validateReport({ ...report, expected_revision: -1 }));
  assert.equal(validateReport({ ...report, expected_revision: 1, correction_note: 'Se contaron niños también.' }).expected_revision, 1);
});
test('closing starts after end time in Argentina, including month boundaries', () => {
  assert.equal(ended('2026-09-30', '23:00', new Date('2026-10-01T01:59:59Z')), false);
  assert.equal(ended('2026-09-30', '23:00', new Date('2026-10-01T02:00:00Z')), true);
});
test('planning requires an explicit meal type instead of guessing from the title', () => {
  const plan = { title: 'Reunión', sector: 'Jóvenes', responsible: 'Responsable', contact: '', date: '2026-10-05', start: '12:00', end: '14:00', service: 'food', guests: 100, notes: '' };
  assert.throws(() => validate(plan));
  assert.equal(validate({ ...plan, meal_type: 'snack' }).meal_type, 'snack');
  assert.equal(validate({ ...plan, service: 'space' }).meal_type, null);
});
test('accepts actual local Host but rejects cross-origin, forged forwarding and missing Origin', () => {
  const request = (origin, extra = {}) => new Request('http://localhost:3000/api/kitchen/example', { headers: { host: '127.0.0.1:3000', ...(origin ? { origin } : {}), ...extra } });
  assert.equal(sameOrigin(request('http://127.0.0.1:3000')), true);
  assert.equal(sameOrigin(request('http://evil.example')), false);
  assert.equal(sameOrigin(request('http://127.0.0.1:3001')), false);
  assert.equal(sameOrigin(request('https://127.0.0.1:3000')), false);
  assert.equal(sameOrigin(request(null)), false);
  assert.equal(sameOrigin(request('http://evil.example', { 'x-forwarded-host': 'evil.example' })), false);
});
