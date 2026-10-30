# Astrology

My website [softmoon.world](https://softmoon.world) now built in Astro.

## To Run
```
npm install
npm run dev
```

## Writing blog posts

The easiest way is the local editor:

```
npm run write
```

This starts the site on port 4321 and opens the editor on port 4322. Edits save
automatically and the preview beside the editor is the real site, so it reloads as
you type. Paste or drag in an image and it is saved to `src/assets/blog/<post>/`.

You can also add a `.md` file to `src/content/blog/` by hand. Each post needs this frontmatter followed by Markdown:

```markdown
---
title: "My new post"
description: "A short summary for the blog index and RSS readers."
pubDate: 2026-10-07
draft: true
---

Your writing goes here. Use headings, links, images, lists, and code blocks.
```

Set `draft: false` (or remove the draft field) to publish. Drafts are left out of
the blog index, the RSS feed, and the build. During local development they still get
a post page, so you can preview one at `/blog/<name>.html`.

The filename determines the URL: `my-new-post.md` becomes
`/blog/my-new-post.html`. Keep filenames lowercase with hyphens; subfolders are
supported. Use `##` for headings within a post; its title is already the main heading.
Put images in `src/assets/blog/<post>/` and reference them relative to the post,
like `![Alt text](../../assets/blog/my-new-post/photo.jpg)`. Astro resizes them and
converts them to webp at build time. In the editor, an image's caption is its alt text.

The blog is at `/blog.html` and the RSS feed is at `/rss.xml`. Posts are sorted
newest first. RSS includes each post's title, summary, publication date, and link.
Dates are displayed in UTC so date-only frontmatter keeps the intended day.
Future dates do not schedule publication: any post without `draft: true` is published.

Run `npm run build` to generate the site, then deploy `dist/` as usual. Adding or
editing posts updates the site and feed on the next build and deployment.
The feed uses `site` in `astro.config.mjs` for absolute links; update it if the domain changes.

## License

The code is dedicated to the public domain under [CC0 1.0](LICENSE): templates,
components, styles, scripts, and configuration are free to copy and reuse.

The content is © Moon Davé, all rights reserved, and is not covered by CC0. This
includes:

- blog posts in `src/content/`
- performance history in `src/data/`
- everything in `public/`, including the resume and images
- the bio and "Currently" text in `src/components/About.astro` and `src/components/Now.astro`
- the Soft Moon World ASCII logo in `src/components/SMWHead.astro`

Please ask before reusing any of it.
