import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const python = process.platform === 'win32' ? 'python' : 'python3';
const script = fileURLToPath(new URL('../backend/comment-request-audit.py', import.meta.url));
const retentionScript = fileURLToPath(new URL('../backend/retention-audit.py', import.meta.url));

test('comment request audit is bounded and read-only against a real synthetic SQLite DB', () => {
  const dir = mkdtempSync(join(tmpdir(), 'choeae-comment-audit-'));
  const db = join(dir, 'test.sqlite');
  try {
    const setup = spawnSync(python, ['-c', `import sqlite3,sys
d=sqlite3.connect(sys.argv[1])
d.execute('CREATE TABLE singer_comments(id INTEGER PRIMARY KEY,name TEXT,text TEXT)')
d.executemany('INSERT INTO singer_comments VALUES(?,?,?)',[(1,'private-name','private-body'),(2,'other-name','other-body')])
d.commit()
d.close()`, db], {encoding:'utf8'});
    assert.equal(setup.status, 0, setup.stderr);
    const before = readFileSync(db);
    const run = ids => spawnSync(python, [script, '--db', db, '--ids', ids], {encoding:'utf8'});
    const result = run('1,3');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {readOnly:true, requested:2, found:1, missingIds:[3]});
    assert.doesNotMatch(result.stdout, /private|other|test\.sqlite/);
    for (const ids of ['', '1,1', '0', '-1', '1 OR 1=1', '9007199254740992', Array.from({length:51}, (_,i)=>i+1).join(',')]) {
      assert.equal(run(ids).status, 1, ids);
    }
    assert.deepEqual(readFileSync(db), before);
    const absent = join(dir,'absent.sqlite');
    assert.equal(spawnSync(python,[script,'--db',absent,'--ids','1']).status,1);
    assert.equal(existsSync(absent),false);
    assert.equal(spawnSync(python,[script,'--db',db,'--ids','1','--apply']).status,2);
    assert.deepEqual(readFileSync(db), before);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});

test('retention audit uses a UTC calendar year and excludes invalid/future/boundary timestamps without writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'choeae-retention-audit-'));
  const db = join(dir, 'test.sqlite');
  try {
    const result = spawnSync(python, ['-c', `import importlib.util,sqlite3,sys,json
from datetime import datetime,timezone
s=importlib.util.spec_from_file_location('retention_audit',sys.argv[1])
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
now=datetime(2024,2,29,12,0,tzinfo=timezone.utc)
limits=m.cutoffs(now)
assert limits['singer_comments']==int(datetime(2023,2,28,12,0,tzinfo=timezone.utc).timestamp()*1000)
try:m.cutoffs(datetime(2024,1,1));raise AssertionError('naive time accepted')
except ValueError:pass
d=sqlite3.connect(sys.argv[2])
for t,c in limits.items():
 d.execute('CREATE TABLE '+t+"(id INTEGER PRIMARY KEY, created_at, name TEXT, site TEXT DEFAULT 'choeae-plaza')")
 vals=[c-1,c,c+1,None,0,-1,int(now.timestamp()*1000)+1,'bad',float(c)-0.5]
 d.executemany('INSERT INTO '+t+'(created_at,name) VALUES(?,?)',[(v,'private-name') for v in vals])
d.execute("INSERT INTO pageviews(created_at,site) VALUES(1,'other-pomyjo-site')")
d.commit();d.close()
before=open(sys.argv[2],'rb').read()
r=m.retention_report(sys.argv[2],now)
for t in limits:
 assert r['tables'][t]['eligible']==1,r
 assert r['tables'][t]['invalidTimestamp']==6,r
 assert r['tables'][t]['total']==9,r
assert before==open(sys.argv[2],'rb').read()
print(json.dumps(r))`, retentionScript, db], {encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.doesNotMatch(result.stdout,/private-name/);
    assert.equal(JSON.parse(result.stdout).readOnly,true);
    assert.equal(spawnSync(python,[retentionScript,'--db',db,'--apply']).status,2);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
