import { getCollection } from 'astro:content';

export async function getPublishedPosts() {
   const posts = await getCollection('blog', ({ data }) => !data.draft);
   return posts.sort((a, b) =>
      b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.id.localeCompare(b.id)
   );
}

export function postUrl(id: string) {
   return `/blog/${id.split('/').map(encodeURIComponent).join('/')}.html`;
}

export function formatPostDate(date: Date) {
   return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
   });
}
