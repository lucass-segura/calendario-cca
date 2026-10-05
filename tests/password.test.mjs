import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordChangeInput } from '../lib/auth/password.ts';

test('password changes require matching new passwords and preserve spaces', () => {
  assert.deepEqual(passwordChangeInput({ currentPassword: 'actual123', password: ' nueva clave ', confirmation: ' nueva clave ' }), { current_password: 'actual123', password: ' nueva clave ' });
  assert.throws(() => passwordChangeInput({ currentPassword: 'actual123', password: 'nueva1234', confirmation: 'otra1234' }), /no coinciden/);
});
test('password changes reject missing, short, unchanged and oversized inputs', () => {
  for (const input of [null, {}, { currentPassword: '', password: 'nueva1234', confirmation: 'nueva1234' }, { currentPassword: 'actual123', password: '123', confirmation: '123' }, { currentPassword: 'actual123', password: 'actual123', confirmation: 'actual123' }, { currentPassword: 'actual123', password: 'á'.repeat(40), confirmation: 'á'.repeat(40) }]) assert.throws(() => passwordChangeInput(input));
});
