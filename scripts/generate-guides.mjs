import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function browserGuideSource(data) {
  return '// Generated from data/artist-guides.json; do not edit by hand.\nwindow.CHOEAE_ARTIST_GUIDES = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n';
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(await readFile(new URL('../data/artist-guides.json', import.meta.url), 'utf8'));
  await writeFile(new URL('../public/artist-guides.js', import.meta.url), browserGuideSource(data));
}
