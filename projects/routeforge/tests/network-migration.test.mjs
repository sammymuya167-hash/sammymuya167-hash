import test from 'node:test';
import { execFileSync } from 'node:child_process';
test('additive network migrations preserve populated office, planner and tracking records',()=>{
 execFileSync('python',['-c',`
import sqlite3,pathlib
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
files=sorted(pathlib.Path('drizzle').glob('*.sql'))
for f in files[:6]:
 for sql in f.read_text().split('--> statement-breakpoint'):
  if sql.strip(): db.executescript(sql)
db.execute("INSERT INTO plans(id,owner_id,name,scenario_json,result_json,updated_at) VALUES('preserved-plan','old-owner','Original','{}','{}',10)")
db.execute("INSERT INTO tracking_devices(id,owner_id,driver_name,created_at) VALUES('preserved-driver','old-owner','Original driver',10)")
db.execute("INSERT INTO office_orders(id,owner_id,status,input_json,payload_json,version,updated_at) VALUES('preserved-order','old-owner','queued','{}','{}',1,10)")
before={t:db.execute('SELECT * FROM '+t).fetchall() for t in ['plans','tracking_devices','office_orders']}
for f in files[6:]:
 for sql in f.read_text().split('--> statement-breakpoint'):
  if sql.strip(): db.executescript(sql)
for t in before: assert before[t]==db.execute('SELECT * FROM '+t).fetchall(),t
assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
assert db.execute('SELECT COUNT(*) FROM merchants').fetchone()[0]==0
assert db.execute('SELECT COUNT(*) FROM network_ledger').fetchone()[0]==0
`],{stdio:'pipe'});
});
