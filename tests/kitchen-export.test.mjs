import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenExportPages, mealsPerPage } from '../lib/kitchen-export-data.ts';

test('monthly kitchen export preserves every event and planned guests across pages', () => {
  const meals=Array.from({length:19},(_,i)=>({id:String(i),date:'2026-10-'+String(19-i).padStart(2,'0'),start:'16:00',end:'18:00',title:'Ensayo musical '+i,guests:40+i,meal_type:'snack',report:i===0?{actual_guests:39}:null}));
  const pages=kitchenExportPages([...meals,{...meals[0],id:'outside',date:'2026-11-01'}],'2026-10');
  assert.equal(pages.length,4);
  assert.ok(pages.every(p=>p.length<=mealsPerPage));
  assert.equal(pages.flat().length,19);
  assert.equal(new Set(pages.flat().map(p=>p.id)).size,19);
  assert.equal(pages[0][0].date,'2026-10-01');
  assert.equal(pages.flat().find(p=>p.id==='0').guests,40);
  assert.deepEqual(kitchenExportPages([],'2026-10'),[[]]);
  assert.throws(()=>kitchenExportPages(meals,'2026-13'));
});
