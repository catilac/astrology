# Astrology

My website [softmoon.world](https://softmoon.world) now built in Astro.

## To Run
```
npm install
npm run dev
```

## Writing blog posts

Add a `.md` file to `src/content/blog/`, or copy `first-post.md` as a starting
point. Each post needs this frontmatter followed by Markdown:

```markdown
---
title: "My new post"
description: "A short summary for the blog index and RSS readers."
pubDate: 2026-10-07
draft: true
---

Your writing goes here. Use headings, links, images, lists, and code blocks.
```

Set `draft: false` (or remove the draft field) to publish. Drafts are excluded
from the blog index, post pages, and RSS feed, including during local development.
To preview a post locally, temporarily set `draft: false` and run `npm run dev`.

The filename determines the URL: `my-new-post.md` becomes
`/blog/my-new-post.html`. Keep filenames lowercase with hyphens; subfolders are
supported. Use `##` for headings within a post; its title is already the main heading.
Put images in `public/images/` and reference them as `![Alt text](/images/photo.jpg)`.

The blog is at `/blog.html` and the RSS feed is at `/rss.xml`. Posts are sorted
newest first. RSS includes each post's title, summary, publication date, and link.
Dates are displayed in UTC so date-only frontmatter keeps the intended day.
Future dates do not schedule publication: any post without `draft: true` is published.

Run `npm run build` to generate the site, then deploy `dist/` as usual. Adding or
editing posts updates the site and feed on the next build and deployment.
The feed uses `site` in `astro.config.mjs` for absolute links; update it if the domain changes.
