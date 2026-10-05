import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePermissions, togglePermission, validateUser, permissionKeys } from '../lib/permissions.ts';

test('permission selections include dependencies and remove dependent writes', () => {
  assert.deepEqual(normalizePermissions(['kitchen.confirm']), ['kitchen.read','kitchen.confirm']);
  assert.deepEqual(normalizePermissions(['users.manage']), permissionKeys);
  assert.deepEqual(togglePermission(['missions.read','missions.write'], 'missions.read', false), []);
  assert.ok(normalizePermissions(['stats.read']).includes('missions.read'));
  assert.throws(() => normalizePermissions(['made.up']));
});
test('user creation validates identity, password, enabled state and permissions', () => {
  const b={username:' Nueva.Hermana ',full_name:' Nueva Hermana ',password:'strong-password-2026',permissions:['kitchen.confirm'],enabled:true};
  assert.equal(validateUser(b).username,'nueva.hermana');
  assert.throws(() => validateUser({...b,password:'short'}));
  assert.throws(() => validateUser({...b,permissions:['unknown']}));
  assert.throws(() => validateUser({...b,enabled:'true'}));
  assert.equal(validateUser({...b,password:undefined},false).password,'');
});
