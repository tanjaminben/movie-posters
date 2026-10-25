import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const readJson = file => JSON.parse(readFileSync(resolve(repositoryRoot, file), 'utf8'));

export function argument(name, fallback) {
  const index = process.argv.indexOf('--' + name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error('Missing value for --' + name);
  return value;
}

export function verify(artRoot) {
  const manifest = readJson('assets/manifest.json');
  const data = readJson('src/posters-data.json');
  const snapshot = readJson('provenance/source-snapshot.json');
  const fail = message => { throw new Error(message); };
  if (data.items.length !== 44 || manifest.items.length !== 44) fail('Expected 44 active posters');
  if (new Set(data.items.map(item => item.id)).size !== 44) fail('Duplicate poster ID');
  const expectedCounts = { horror: 27, 'privacy-wizard': 7, 'privacy-wars': 7, 'consent-matrix': 3 };
  for (const [group, count] of Object.entries(expectedCounts)) {
    if (data.items.filter(item => item.group === group).length !== count) fail('Wrong family count: ' + group);
  }
  if (Object.keys(data.films).length !== 45) fail('Expected 45 film references');
  for (const item of data.items) {
    const asset = manifest.items.find(asset => asset.id === item.id);
    if (!asset || asset.runtime.url !== item.image || asset.title !== item.title) fail('Manifest mismatch: ' + item.id);
    if (item.width !== 1024 || item.height !== 1536) fail('Wrong canvas: ' + item.id);
    if (!/^[a-f0-9]{64}$/.test(asset.runtime.sha256)) fail('Invalid asset hash: ' + item.id);
    if (asset.runtime.file !== item.image.split('/').at(-1)) fail('Invalid image filename');
    if (!item.filmIds.length || item.filmIds.some(id => !/^tt\d+$/.test(id) || !data.films[id])) fail('Invalid film mapping');
  }
  for (const file of snapshot.files) {
    if (!existsSync(resolve(repositoryRoot, file.destination))) fail('Missing source snapshot: ' + file.destination);
    if (sha256(readFileSync(resolve(repositoryRoot, file.destination))) !== file.destinationSha256) fail('Changed source snapshot: ' + file.destination);
  }
  let externalImagesVerified = null;
  if (artRoot) {
    for (const asset of manifest.items) {
      const file = resolve(artRoot, asset.runtime.file);
      const bytes = readFileSync(file);
      if (sha256(bytes) !== asset.runtime.sha256 || bytes.length !== asset.runtime.bytes) fail('Image bytes changed: ' + asset.id);
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR') fail('Not a PNG: ' + asset.id);
      if (bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1536) fail('PNG dimensions changed: ' + asset.id);
    }
    externalImagesVerified = manifest.items.length;
  }
  return { posters: 44, films: 45, groups: expectedCounts, sourceFilesVerified: snapshot.files.length, externalImagesVerified };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verify(argument('art-root', process.env.MOVIE_POSTERS_ART_ROOT)), null, 2));
}
