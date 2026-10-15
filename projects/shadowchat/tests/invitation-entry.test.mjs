import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingInvitation, clearPendingInvitation } from '../lib/invitation-entry.ts';

function tabStorage() {
  const records = new Map();
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}
test('an invitation survives sign-in and an account switch without entering the auth URL', () => {
  const tab = tabStorage(), token = 'ab'.repeat(32), now = Date.now();
  assert.equal(pendingInvitation('#invite='+token,tab,now),token);
  assert.equal(pendingInvitation('',tab,now+1000),token);
  assert.equal(pendingInvitation('',tab,now+2000),token);
  clearPendingInvitation(tab);
  assert.equal(pendingInvitation('',tab,now+3000),'');
  assert.equal(pendingInvitation('',tabStorage(),now),'');
});
test('malformed and expired retained invitations are ignored', () => {
  const tab=tabStorage(),now=Date.now();
  assert.equal(pendingInvitation('#invite=https://evil.test',tab,now),'');
  pendingInvitation('#invite='+'ab'.repeat(32),tab,now);
  assert.equal(pendingInvitation('',tab,now+48*3600000),'');
  tab.setItem('shadowchat-pending-invitation','invalid JSON');
  assert.equal(pendingInvitation('',tab,now),'');
});
test('unavailable tab storage does not break opening an invitation', () => {
  const token='cd'.repeat(32),blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
  assert.equal(pendingInvitation('#invite='+token,blocked),token);
  assert.equal(pendingInvitation('',blocked),'');
  assert.doesNotThrow(()=>clearPendingInvitation(blocked));
});
