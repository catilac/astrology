import { Crepe } from '@milkdown/crepe';
import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { remarkPreserveEmptyLinePlugin } from '@milkdown/kit/preset/commonmark';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import '../../src/styles/tokens.css';
import './style.css';
import type { PostData } from './api';

interface Post { slug: string; data: PostData; body: string }

const SITE = `${location.protocol}//${location.hostname}:4321`;
const SAVE_DELAY = 500;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const select = $<HTMLSelectElement>('post-select');
const meta = $<HTMLFormElement>('meta');
const status = $('status');
const preview = $<HTMLIFrameElement>('preview');
const openPreview = $<HTMLAnchorElement>('open-preview');
const editorRoot = $('editor');

// Crepe stores an image's resize ratio in the markdown alt text and its caption
// in the title. Use the caption as alt text instead so posts stay accessible.
const imageBlockAltText = imageBlockSchema.extendSchema((prev) => (ctx) => ({
   ...prev(ctx),
   parseMarkdown: {
      match: ({ type }) => type === 'image-block',
      runner: (state, node, type) => {
         state.addNode(type, { src: node.url as string, caption: (node.alt as string) ?? '', ratio: 1 });
      },
   },
   toMarkdown: {
      match: (node) => node.type.name === 'image-block',
      runner: (state, node) => {
         state.openNode('paragraph');
         state.addNode('image', undefined, undefined, { url: node.attrs.src, alt: node.attrs.caption });
         state.closeNode();
      },
   },
}));

let current: Post | null = null;
let crepe: Crepe | null = null;
let saveTimer: number | undefined;
let saving: Promise<void> = Promise.resolve();

async function api<T>(url: string, init?: RequestInit): Promise<T> {
   const res = await fetch(url, init);
   const json = await res.json();
   if (!res.ok) throw new Error(json.error ?? res.statusText);
   return json;
}

function setStatus(text: string, isError = false) {
   status.textContent = text;
   status.classList.toggle('error', isError);
}

function previewUrl(slug: string) {
   return `${SITE}/blog/${encodeURIComponent(slug)}.html`;
}

// Pasted screenshots arrive as "image.png" or with no name at all.
function filenameFor(file: File) {
   if (file.name && /\.[a-z0-9]+$/i.test(file.name)) return file.name;
   const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') ?? 'png';
   return `image.${ext}`;
}

async function uploadImage(file: File) {
   if (!current) throw new Error('No post open');
   setStatus(`uploading ${file.name || 'image'}…`);
   const url = `/api/images/${encodeURIComponent(current.slug)}?filename=${encodeURIComponent(filenameFor(file))}`;
   const { src } = await api<{ src: string }>(url, { method: 'POST', body: file });
   setStatus('image saved');
   return src;
}

function displayUrl(src: string) {
   if (!src || /^(https?:|data:|blob:)/.test(src)) return src;
   return `/api/asset?src=${encodeURIComponent(src)}`;
}

function readMeta(): PostData {
   const form = new FormData(meta);
   return {
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      pubDate: String(form.get('pubDate') ?? ''),
      draft: form.get('draft') === 'on',
   };
}

function writeMeta(data: PostData) {
   (meta.elements.namedItem('title') as HTMLInputElement).value = data.title;
   (meta.elements.namedItem('description') as HTMLInputElement).value = data.description;
   (meta.elements.namedItem('pubDate') as HTMLInputElement).value = data.pubDate;
   (meta.elements.namedItem('draft') as HTMLInputElement).checked = data.draft;
}

// Extra Enters in the editor become runs of blank lines. They render the same,
// so squash them, but leave fenced code alone. The code block language picker
// writes names like "Rust", which Shiki only highlights in lowercase.
function tidyMarkdown(markdown: string) {
   return markdown.split(/(^```[\s\S]*?^```)/m)
      .map((part, i) => (i % 2
         ? part.replace(/^```(\S+)/, (_m, lang: string) => '```' + lang.toLowerCase())
         : part.replace(/\n{3,}/g, '\n\n')))
      .join('');
}

function scheduleSave() {
   setStatus('editing…');
   clearTimeout(saveTimer);
   saveTimer = window.setTimeout(save, SAVE_DELAY);
}

function save() {
   clearTimeout(saveTimer);
   saveTimer = undefined;
   if (!current) return saving;
   const post = current;
   post.data = readMeta();
   post.body = currentMarkdown();
   saving = saving.then(async () => {
      try {
         await api(`/api/posts/${encodeURIComponent(post.slug)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: post.data, body: post.body }),
         });
         setStatus(`saved ${new Date().toLocaleTimeString()}`);
      } catch (err) {
         setStatus(`save failed: ${(err as Error).message}`, true);
      }
   });
   return saving;
}

async function flush() {
   if (saveTimer !== undefined) await save();
   await saving;
}

function currentMarkdown() {
   return crepe ? tidyMarkdown(crepe.getMarkdown()) : current?.body ?? '';
}

async function destroyEditor() {
   await crepe?.destroy();
   crepe = null;
   editorRoot.replaceChildren();
}

async function createEditor(markdown: string) {
   crepe = new Crepe({
      root: editorRoot,
      defaultValue: markdown,
      features: {
         [Crepe.Feature.AI]: false,
         [Crepe.Feature.TopBar]: false,
         [Crepe.Feature.Latex]: false,
      },
      featureConfigs: {
         [Crepe.Feature.ImageBlock]: {
            onUpload: uploadImage,
            blockOnUpload: uploadImage,
            inlineOnUpload: uploadImage,
            proxyDomURL: displayUrl,
         },
         [Crepe.Feature.Placeholder]: { text: 'Start writing…' },
      },
   });
   crepe.editor.use(imageBlockAltText);
   // Otherwise every extra Enter is saved as a `<br />` line.
   await crepe.editor.remove(remarkPreserveEmptyLinePlugin);
   // Only save after a real edit, so opening a post never rewrites it.
   crepe.on((listener) => listener.markdownUpdated((_ctx, markdown, prev) => {
      if (markdown !== prev) scheduleSave();
   }));
   await crepe.create();
}

async function open(post: Post) {
   await destroyEditor();
   current = post;
   writeMeta(post.data);
   select.value = post.slug;
   history.replaceState(null, '', `?post=${encodeURIComponent(post.slug)}`);

   await createEditor(post.body);

   preview.src = previewUrl(post.slug);
   openPreview.href = previewUrl(post.slug);
   setStatus('');
}

async function loadList(selected?: string) {
   const posts = await api<(PostData & { slug: string })[]>('/api/posts');
   select.replaceChildren(...posts.map((p) => {
      const option = new Option(`${p.draft ? '✎ ' : ''}${p.title || p.slug} · ${p.slug}`, p.slug);
      return option;
   }));
   const slug = selected && posts.some((p) => p.slug === selected) ? selected : posts[0]?.slug;
   if (slug) await open(await api<Post>(`/api/posts/${encodeURIComponent(slug)}`));
}

select.addEventListener('change', async () => {
   await flush();
   await open(await api<Post>(`/api/posts/${encodeURIComponent(select.value)}`));
});

meta.addEventListener('input', scheduleSave);

$('new-post').addEventListener('click', async () => {
   const slug = prompt('Slug for the new post (used in its URL):')?.trim().toLowerCase().replace(/\s+/g, '-');
   if (!slug) return;
   try {
      await flush();
      const post = await api<Post>('/api/posts', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ slug }),
      });
      await loadList(post.slug);
   } catch (err) {
      setStatus((err as Error).message, true);
   }
});

window.addEventListener('beforeunload', (event) => {
   if (saveTimer !== undefined) {
      save();
      event.preventDefault();
   }
});

loadList(new URLSearchParams(location.search).get('post') ?? undefined)
   .catch((err) => setStatus((err as Error).message, true));
