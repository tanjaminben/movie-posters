import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { argument, repositoryRoot, readJson, verify } from './verify.mjs';

const shellRoot = argument('shell-root', process.env.MOVIE_POSTERS_SHELL_ROOT);
const artRoot = argument('art-root', process.env.MOVIE_POSTERS_ART_ROOT);
if (!shellRoot || !artRoot) throw new Error('Supply --shell-root and --art-root; see README');
const outputRoot = resolve(argument('out', join(repositoryRoot, 'dist')));
const port = Number(argument('port', '8894'));
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
verify(artRoot);
const prefix = '/guides/movie-posters/';
const assets = readJson('assets/manifest.json');
const allowed = new Map(['index.html', 'posters.css', 'posters.js', 'posters-data.json'].map(file => [prefix + file, join(outputRoot, 'guides', 'movie-posters', file)]));
for (const asset of assets.items) allowed.set(asset.runtime.url, resolve(artRoot, asset.runtime.file));
const html = readFileSync(allowed.get(prefix + 'index.html'), 'utf8');
const sharedCss = readFileSync(resolve(shellRoot, 'styles.css'), 'utf8');
const shared = new Set(['/styles.css', '/landing.js']);
for (const match of html.matchAll(/(?:src|href)="(\/(?:assets|fonts)\/[^"]+)"/g)) shared.add(match[1]);
for (const match of sharedCss.matchAll(/url\(["']?((?:\/?assets|\/?fonts)\/[^"')]+)["']?\)/g)) shared.add('/' + match[1].replace(/^\//, ''));
for (const url of shared) allowed.set(url, resolve(shellRoot, '.' + url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400); response.end('Bad URL'); return; }
  if (pathname === '/') { response.writeHead(302, { Location: prefix }); response.end(); return; }
  if (pathname === prefix) pathname += 'index.html';
  const file = allowed.get(pathname);
  if (!file || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const size = statSync(file).size;
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': size, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : readFileSync(file));
  } catch { response.writeHead(404); response.end('Missing source or external asset'); }
});
server.listen(port, '127.0.0.1', () => console.log('Movie Posters source preview: http://127.0.0.1:' + server.address().port + prefix));
