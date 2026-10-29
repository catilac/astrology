import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import matter from 'gray-matter';

const root = path.resolve(import.meta.dirname, '../..');
const postsDir = path.join(root, 'src/content/blog');
const assetsDir = path.join(root, 'src/assets/blog');

const SITE = 'http://localhost:4321';

const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;
const IMAGE_TYPES: Record<string, string> = {
   '.png': 'image/png',
   '.jpg': 'image/jpeg',
   '.jpeg': 'image/jpeg',
   '.gif': 'image/gif',
   '.webp': 'image/webp',
   '.avif': 'image/avif',
   '.svg': 'image/svg+xml',
};

export interface PostData {
   title: string;
   description: string;
   pubDate: string;
   draft: boolean;
}

class HttpError extends Error {
   constructor(public status: number, message: string) { super(message); }
}

function postPath(slug: string) {
   if (!SLUG.test(slug)) throw new HttpError(400, `Bad slug: ${slug}`);
   return path.join(postsDir, `${slug}.md`);
}

function toDateString(value: unknown) {
   if (value instanceof Date) return value.toISOString().slice(0, 10);
   return typeof value === 'string' ? value : '';
}

function readData(raw: Record<string, unknown>): PostData {
   return {
      title: String(raw.title ?? ''),
      description: String(raw.description ?? ''),
      pubDate: toDateString(raw.pubDate),
      draft: Boolean(raw.draft),
   };
}

// Written by hand rather than with gray-matter so the frontmatter keeps the
// same shape as hand-written posts. JSON strings are valid YAML.
function serialize(data: PostData, body: string) {
   return [
      '---',
      `title: ${JSON.stringify(data.title)}`,
      `description: ${JSON.stringify(data.description)}`,
      `pubDate: ${data.pubDate}`,
      `draft: ${data.draft}`,
      '---',
      '',
      body.trimEnd(),
      '',
   ].join('\n');
}

async function exists(file: string) {
   return fs.access(file).then(() => true, () => false);
}

async function readBody(req: IncomingMessage) {
   const chunks: Buffer[] = [];
   for await (const chunk of req) chunks.push(chunk);
   return Buffer.concat(chunks);
}

async function listPosts() {
   const files = (await fs.readdir(postsDir)).filter((f) => f.endsWith('.md'));
   const posts = await Promise.all(files.map(async (file) => {
      const { data } = matter(await fs.readFile(path.join(postsDir, file), 'utf8'));
      return { slug: file.slice(0, -3), ...readData(data) };
   }));
   return posts.sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.slug.localeCompare(b.slug));
}

async function readPost(slug: string) {
   const file = postPath(slug);
   if (!(await exists(file))) throw new HttpError(404, `No post: ${slug}`);
   const { data, content } = matter(await fs.readFile(file, 'utf8'));
   return { slug, data: readData(data), body: content.replace(/^\n+/, '') };
}

async function createPost(slug: string) {
   const file = postPath(slug);
   if (await exists(file)) throw new HttpError(409, `A post called ${slug} already exists`);
   const data: PostData = {
      title: slug,
      description: 'TODO',
      pubDate: new Date().toISOString().slice(0, 10),
      draft: true,
   };
   await fs.writeFile(file, serialize(data, ''));
   await waitForPage(slug);
   return { slug, data, body: '' };
}

// Astro takes a moment to pick up a new file. Wait so the preview doesn't
// open on a 404.
async function waitForPage(slug: string) {
   for (let i = 0; i < 20; i++) {
      const ok = await fetch(`${SITE}/blog/${encodeURIComponent(slug)}.html`).then((r) => r.ok, () => false);
      if (ok) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
   }
}

async function savePost(slug: string, post: { data: PostData; body: string }) {
   await fs.writeFile(postPath(slug), serialize(post.data, post.body));
}

function cleanFilename(name: string) {
   const ext = path.extname(name).toLowerCase();
   if (!(ext in IMAGE_TYPES)) throw new HttpError(415, `Not an image: ${name}`);
   const base = path.basename(name, path.extname(name))
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
   return { base, ext };
}

// Saves next to other images for the post and returns the path to put in the
// markdown, relative to the post file, so Astro optimizes it at build time.
async function saveImage(slug: string, filename: string, bytes: Buffer) {
   postPath(slug);
   const dir = path.join(assetsDir, slug);
   await fs.mkdir(dir, { recursive: true });
   const { base, ext } = cleanFilename(filename);
   let name = `${base}${ext}`;
   for (let n = 2; await exists(path.join(dir, name)); n++) name = `${base}-${n}${ext}`;
   await fs.writeFile(path.join(dir, name), bytes);
   return path.relative(postsDir, path.join(dir, name)).split(path.sep).join('/');
}

// Serves an image referenced from a post so the editor can display it.
async function sendAsset(src: string, res: ServerResponse) {
   const file = path.resolve(postsDir, src);
   const type = IMAGE_TYPES[path.extname(file).toLowerCase()];
   if (!file.startsWith(path.join(root, 'src') + path.sep) || !type) throw new HttpError(403, 'Not allowed');
   if (!(await exists(file))) throw new HttpError(404, `No image: ${src}`);
   res.setHeader('Content-Type', type);
   res.end(await fs.readFile(file));
}

function sendJson(res: ServerResponse, value: unknown, status = 200) {
   res.statusCode = status;
   res.setHeader('Content-Type', 'application/json');
   res.end(JSON.stringify(value));
}

export function postsApi(): Plugin {
   return {
      name: 'posts-api',
      configureServer(server) {
         server.middlewares.use('/api', async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const [, resource, slug] = url.pathname.split('/').map(decodeURIComponent);
            try {
               if (resource === 'posts' && !slug && req.method === 'GET') {
                  return sendJson(res, await listPosts());
               }
               if (resource === 'posts' && !slug && req.method === 'POST') {
                  const { slug: newSlug } = JSON.parse((await readBody(req)).toString());
                  return sendJson(res, await createPost(String(newSlug ?? '')), 201);
               }
               if (resource === 'posts' && slug && req.method === 'GET') {
                  return sendJson(res, await readPost(slug));
               }
               if (resource === 'posts' && slug && req.method === 'PUT') {
                  await savePost(slug, JSON.parse((await readBody(req)).toString()));
                  return sendJson(res, { ok: true });
               }
               if (resource === 'images' && slug && req.method === 'POST') {
                  const filename = url.searchParams.get('filename') ?? 'image.png';
                  return sendJson(res, { src: await saveImage(slug, filename, await readBody(req)) }, 201);
               }
               if (resource === 'asset' && req.method === 'GET') {
                  return await sendAsset(url.searchParams.get('src') ?? '', res);
               }
               throw new HttpError(404, 'Not found');
            } catch (err) {
               const status = err instanceof HttpError ? err.status : 500;
               sendJson(res, { error: err instanceof Error ? err.message : String(err) }, status);
            }
         });
      },
   };
}
