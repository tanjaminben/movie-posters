import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { argument, repositoryRoot, readJson, sha256, verify } from './verify.mjs';

const shellRoot = argument('shell-root', process.env.MOVIE_POSTERS_SHELL_ROOT);
if (!shellRoot) throw new Error('Supply --shell-root containing the shared website files');
const artRoot = argument('art-root', process.env.MOVIE_POSTERS_ART_ROOT);
const includeArt = process.argv.includes('--include-art');
if (includeArt && !artRoot) throw new Error('--include-art requires --art-root');
const outputRoot = resolve(argument('out', join(repositoryRoot, 'dist')));
const sourceRoots = [resolve(repositoryRoot, 'src'), resolve(shellRoot), artRoot && resolve(artRoot)].filter(Boolean);
for (const sourceRoot of sourceRoots) {
  if (outputRoot === sourceRoot || outputRoot.startsWith(sourceRoot + '/')) throw new Error('Output cannot be inside a source directory');
  if (outputRoot.startsWith(sourceRoot + '\\')) throw new Error('Output cannot be inside a source directory');
}
const target = join(outputRoot, 'guides', 'movie-posters');
if (existsSync(target)) throw new Error('Preserve existing output; select a fresh --out folder');
const verification = verify(artRoot);
const dependencies = readJson('provenance/shared-dependencies.json');
const identity = dependencies.approvedIdentity;
const sharedSvg = readFileSync(resolve(shellRoot, identity.assetPath.replace(/^site\//, '')));
if (sha256(sharedSvg) !== identity.assetSha256) throw new Error('Shared poster icon changed; coordinate with its portfolio owner');
const sharedCss = readFileSync(resolve(shellRoot, 'styles.css'), 'utf8')+'\n'+readFileSync(resolve(shellRoot, 'project-identities.css'), 'utf8');
for (const [property, expected] of [['--bt-icon-posters', identity.iconBackground], ['--bt-title-accent-posters', identity.titleStrokes]]) {
  const values = [...sharedCss.matchAll(new RegExp(property + '\\s*:\\s*([^;}]+)', 'g'))];
  if (values.at(-1)?.[1].trim().toLowerCase() !== expected.toLowerCase()) throw new Error('Approved shared token changed: ' + property);
}
const shell = readFileSync(resolve(shellRoot, 'work/index.html'), 'utf8');
let header = shell.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];
const footer = shell.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
if (!header || !footer) throw new Error('Shared Work header/footer contract not found');
header = header.replace(/ aria-current="page"/g, '');
const shellBindings = readJson('src/shell-bindings.json');
for (const label of shellBindings.preservedNonbreakingLabels) {
  const wrapped = '<span class="label-term">' + label + '</span>';
  if (!header.includes(wrapped)) {
    if (!header.includes(label)) throw new Error('Shared navigation label not found: ' + label);
    header = header.replace(label, () => wrapped);
  }
}
const destination = '<a href="/guides/movie-posters/">';
if (header.split(destination).length !== 2) throw new Error('Expected one shared Movie Posters navigation link');
header = header.replace(destination, '<a href="/guides/movie-posters/" aria-current="page">');
const template = readFileSync(resolve(repositoryRoot, 'src/index.template.html'), 'utf8');
const html = template.replace('{{SHARED_HEADER}}', () => header).replace('{{SHARED_FOOTER}}', () => footer);
if (/\{\{SHARED_/.test(html)) throw new Error('Unresolved shared component placeholder');
mkdirSync(target, { recursive: true });
writeFileSync(join(target, 'index.html'), html);
for (const name of ['posters.css', 'posters.js', 'posters-data.json']) copyFileSync(resolve(repositoryRoot, 'src', name), join(target, name));
const assets = readJson('assets/manifest.json');
if (includeArt) {
  mkdirSync(join(target, 'art'));
  for (const asset of assets.items) copyFileSync(resolve(artRoot, asset.runtime.file), join(target, 'art', asset.runtime.file));
}
if(includeArt){
  for(const display of readJson('assets/display-images.json')){
    const bytes=readFileSync(resolve(artRoot,display.file));
    if(sha256(bytes)!==display.sha256||bytes.length!==display.bytes)throw new Error('Full-size display mismatch: '+display.file);
    writeFileSync(join(target,'art',display.file),bytes);
  }
  mkdirSync(join(target,'art','previews'),{recursive:true});
  for(const preview of readJson('assets/gallery-previews.json').images){
    const bytes=readFileSync(resolve(artRoot,'previews',preview.file));
    if(sha256(bytes)!==preview.sha256||bytes.length!==preview.bytes)throw Error('Gallery preview mismatch: '+preview.file);
    writeFileSync(join(target,'art','previews',preview.file),bytes);
  }
}
const files = ['index.html', 'posters.css', 'posters.js', 'posters-data.json'].map(file => ({ file, sha256: sha256(readFileSync(join(target, file))) }));
writeFileSync(join(outputRoot, 'collection-build.json'), JSON.stringify({ schemaVersion: 1, route: '/guides/movie-posters/', files, artIncluded: includeArt, verification, sharedShellOwner: 'external shared website', sharedHeaderSha256: sha256(header), sharedFooterSha256: sha256(footer) }, null, 2) + '\n');
console.log(JSON.stringify({ output: outputRoot, files, artIncluded: includeArt, verification }, null, 2));
