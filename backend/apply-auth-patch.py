"""Approved deployment helper. Makes a backup and stages source; never restarts services."""
from pathlib import Path
import datetime
import hashlib
import os
import re
import shutil
import subprocess

root = Path('/home/cbh/pomyjo-api')
source = root / 'server.js'
upload = Path('/home/nokira1024/google-drive-auth.cjs')
expected_source = '6692e31af986881c165189032411c1fbe885e23596d768775502af408eb4434f'
expected_module = '30ff3b36d29e0ab962159c5c36f3d4dce5bdc66a36aad2ca85d5999147c3b32c'
raw = source.read_bytes()
assert hashlib.sha256(raw).hexdigest() == expected_source, 'Source changed; re-audit required'
assert hashlib.sha256(upload.read_bytes()).hexdigest() == expected_module, 'Module upload mismatch'
assert not (root / 'google-drive-auth.cjs').exists(), 'Module already exists; do not overwrite'
text = raw.decode('utf-8').replace('\r\n', '\n')
start = text.index('// ---------- 구글 로그인 + 드라이브 저장 (내 저장소) ----------')
end = text.index('// 404', start)
constants = '\n'.join(re.findall(r'^const GOOGLE_(?:CLIENT_ID|CLIENT_SECRET|REDIRECT) = .*?;$', text[start:end], re.M))
assert len(constants.splitlines()) == 3, 'Config shape changed'
replacement = text[:start] + text[end:]
parser = "app.use(express.json({ limit: '64kb' }));"
assert replacement.count(parser) == 1
replacement = replacement.replace(parser, '')
prelude = constants + """

// Dedicated Google/Drive routes terminate before the public CORS middleware.
const choeaeOrigins = [
  'https://choeae-plaza.pomyjo.com',
  'https://ec13398c.choeae-plaza.pages.dev',
  'https://codex-finish-choeae-plaza.choeae-plaza.pages.dev'
];
const choeaeAuthPaths = ['/auth/google', '/auth/google/callback', '/auth/logout',
  '/api/auth/session', '/api/drive/load', '/api/drive/save'];
app.set('trust proxy', 'loopback');
app.use(choeaeAuthPaths, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Origin');
  const origin = req.headers.origin;
  if (origin && !choeaeOrigins.includes(origin)) return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  next();
});
app.use(choeaeAuthPaths, rateLimit({ windowMs: 60_000,
  max: req => ['/auth/google', '/api/drive/save'].includes(req.originalUrl.split('?')[0]) ? 10 : 120,
  standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '64kb' }));
require('./google-drive-auth.cjs').registerGoogleDriveAuth(app, {
  clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: GOOGLE_REDIRECT, defaultOrigin: choeaeOrigins[0], allowedOrigins: choeaeOrigins
});
app.all(choeaeAuthPaths, (req, res) => res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }));

"""
assert replacement.count('app.use(cors({') == 1
replacement = replacement.replace('app.use(cors({', prelude + 'app.use(cors({', 1)
assert 'driveTokens' not in replacement, 'Legacy token registry still referenced'
assert replacement.count("app.get('/auth/google'") == 0, 'Legacy routes still present'
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/var/backups') / ('choeae-auth-' + stamp)
backup.mkdir(mode=0o700)
for path in [source, Path('/etc/systemd/system/pomyjo-api.service')]:
    target = backup / path.name
    shutil.copyfile(path, target)
    target.chmod(0o600)
(backup / 'source.sha256').write_text(expected_source + '\n')
(backup / 'source.sha256').chmod(0o600)
candidate = root / 'server.choeae-candidate.cjs'
assert not candidate.exists(), 'Candidate already exists'
candidate.write_text(replacement, encoding='utf-8')
candidate.chmod(0o600)
stat = source.stat()
os.chown(candidate, stat.st_uid, stat.st_gid)
check = subprocess.run(['node', '--check', str(candidate)], capture_output=True)
assert check.returncode == 0, 'Candidate syntax failed; original untouched'
check = subprocess.run(['node', '--check', str(upload)], capture_output=True)
assert check.returncode == 0, 'Module syntax failed; original untouched'
module = root / 'google-drive-auth.cjs'
shutil.copyfile(upload, module)
module.chmod(0o640)
os.chown(module, stat.st_uid, stat.st_gid)
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected_source, 'Concurrent source change'
os.replace(candidate, source)
print('AUTH_PATCH_STAGED')
print('BACKUP=' + str(backup))
print('NEW_SOURCE_SHA256=' + hashlib.sha256(source.read_bytes()).hexdigest())
print('SERVICE_NOT_RESTARTED')
