import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts, postUrl } from '../lib/blog';

export async function GET(context: APIContext) {
   const posts = await getPublishedPosts();
   return rss({
      title: 'Soft Moon World Blog',
      description: 'Writing from Soft Moon World.',
      site: context.site!,
      items: posts.map((post) => ({
         title: post.data.title,
         description: post.data.description,
         pubDate: post.data.pubDate,
         link: postUrl(post.id),
      })),
      customData: '<language>en-us</language>',
      trailingSlash: false,
   });
}
