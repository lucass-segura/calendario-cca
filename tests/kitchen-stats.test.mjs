import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenActualTotals } from '../lib/kitchen-stats.ts';
test('statistics sum real attendance and exact cents by event month, including zero attendance', () => {
  const rows = [
    { reservation_id:'a',event_date:'2026-10-01',actual_guests:38,spent_cents:1250050,planned_snapshot:{guests:40} },
    { reservation_id:'b',event_date:'2026-11-02',actual_guests:12,spent_cents:200025,planned_snapshot:{guests:20} },
    { reservation_id:'c',event_date:'2026-10-03',actual_guests:0,spent_cents:0,planned_snapshot:{guests:15} },
  ];
  assert.deepEqual(kitchenActualTotals(rows),{events:3,guests:50,spent_cents:1450075});
  assert.deepEqual(kitchenActualTotals(rows,'2026-10'),{events:2,guests:38,spent_cents:1250050});
  assert.deepEqual(kitchenActualTotals(rows,'2026-01'),{events:0,guests:0,spent_cents:0});
  assert.deepEqual(kitchenActualTotals([]),{events:0,guests:0,spent_cents:0});
});
