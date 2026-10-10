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
const jobScript = fileURLToPath(new URL('../backend/retention-job.py', import.meta.url));

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

test('retention job requires apply, deletes only expired site-scoped rows and is idempotent', () => {
  const dir=mkdtempSync(join(tmpdir(),'choeae-retention-job-'));
  try {
    const result=spawnSync(python,['-c',`import importlib.util,sqlite3,sys
from datetime import datetime,timezone
s=importlib.util.spec_from_file_location('job',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
now=datetime(2026,10,8,tzinfo=timezone.utc); limits=m.audit.cutoffs(now)
d=sqlite3.connect(sys.argv[2])
for t,c in limits.items():
 d.execute('CREATE TABLE '+t+"(id INTEGER PRIMARY KEY,created_at INTEGER,site TEXT DEFAULT 'choeae-plaza')")
 d.executemany('INSERT INTO '+t+'(created_at) VALUES(?)',[(c-1,),(c,),(c+1,)])
d.execute("INSERT INTO pageviews(created_at,site) VALUES(1,'other-site')")
d.execute('CREATE TABLE unrelated(id INTEGER)');d.execute('INSERT INTO unrelated VALUES(1)');d.commit();d.close()
before=open(sys.argv[2],'rb').read()
assert m.cleanup(sys.argv[2],now=now)['readOnly'] is True
assert before==open(sys.argv[2],'rb').read()
r=m.cleanup(sys.argv[2],True,now)
assert r['deleted']=={'singer_comments':1,'pageviews':1},r
assert m.cleanup(sys.argv[2],True,now)['deleted']=={'singer_comments':0,'pageviews':0}
d=sqlite3.connect(sys.argv[2]);assert d.execute('SELECT COUNT(*) FROM singer_comments').fetchone()[0]==2
assert d.execute("SELECT COUNT(*) FROM pageviews WHERE site='other-site'").fetchone()[0]==1
assert d.execute('SELECT COUNT(*) FROM unrelated').fetchone()[0]==1
d.close()
print('job verified')`,jobScript,join(dir,'test.sqlite')],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('retention job rolls both tables back on limits, invalid timestamps, triggers, cascades and a second-table error', () => {
  const dir=mkdtempSync(join(tmpdir(),'choeae-retention-rollback-'));
  try {
    const result=spawnSync(python,['-c',`import importlib.util,sqlite3,sys
from datetime import datetime,timezone
s=importlib.util.spec_from_file_location('job',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
now=datetime(2026,10,8,tzinfo=timezone.utc)
real_connect=sqlite3.connect
for mode in ['limit','invalid','trigger','cascade','second-error']:
 p=sys.argv[2]+'/'+mode+'.sqlite';d=real_connect(p)
 for t in ['singer_comments','pageviews']:
  d.execute('CREATE TABLE '+t+"(id INTEGER PRIMARY KEY,created_at INTEGER,site TEXT DEFAULT 'choeae-plaza')")
  d.executemany('INSERT INTO '+t+'(created_at) VALUES(?)',[(1,),(2,)])
 if mode=='invalid':d.execute('INSERT INTO pageviews(created_at) VALUES(NULL)')
 if mode=='trigger':d.execute('CREATE TRIGGER changed AFTER DELETE ON singer_comments BEGIN DELETE FROM pageviews; END')
 if mode=='cascade':d.execute('CREATE TABLE child(id INTEGER REFERENCES singer_comments(id) ON DELETE CASCADE)')
 d.commit();d.close()
 if mode=='second-error':
  def denied(*a,**k):
   c=real_connect(*a,**k)
   c.set_authorizer(lambda action,p1,p2,db,src: sqlite3.SQLITE_DENY if action==sqlite3.SQLITE_DELETE and p1=='pageviews' else sqlite3.SQLITE_OK)
   return c
  m.sqlite3.connect=denied
 try:m.cleanup(p,True,now,max_rows=1 if mode=='limit' else 5000);raise AssertionError('unsafe cleanup accepted: '+mode)
 except (ValueError,sqlite3.Error):pass
 finally:m.sqlite3.connect=real_connect
 d=real_connect(p);assert d.execute('SELECT COUNT(*) FROM singer_comments').fetchone()[0]==2,mode
 assert d.execute('SELECT COUNT(*) FROM pageviews').fetchone()[0]==(3 if mode=='invalid' else 2),mode
 d.close()
print('rollback verified')`,jobScript,dir],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
