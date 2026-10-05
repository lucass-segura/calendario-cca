import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenPeriod } from '../lib/kitchen-period.ts';
test('kitchen calendar supports month and full year without ambiguous periods', () => {
  assert.deepEqual(kitchenPeriod(new URLSearchParams('year=2026')), {from:'2026-01-01',until:'2026-12-31'});
  assert.deepEqual(kitchenPeriod(new URLSearchParams('month=2028-02')), {from:'2028-02-01',until:'2028-02-31'});
  for (const query of ['', 'month=2026-13', 'year=1899', 'year=9999', 'year=2026&month=2026-10', 'year=2026-01']) assert.throws(() => kitchenPeriod(new URLSearchParams(query)));
});
