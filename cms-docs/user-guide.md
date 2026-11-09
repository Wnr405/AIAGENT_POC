# CMS user guide (02-SRS §10.2)

Short task-based guide for the 1-hour onboarding session (BR-06). Screens follow 03-DESIGN §12.

## Everyone

- **Sign in** at the admin URL with your email and password. After 5 wrong attempts in 10 minutes the
  account pauses for 15 minutes (you will just see "Invalid email or password").
- **Forgot password?** Use the link on the sign-in page; the emailed link works once, for 60 minutes.
- **Inactivity:** you are signed out after 30 minutes without activity (you get a warning 2 minutes before).
- **Settings:** change your password (signs you out everywhere) and choose Light / Dark / System theme.

## Authors

1. _Articles → New article._ Only the title is required to save a draft. The slug is generated from the
   title; you can edit it (lowercase letters, digits, hyphens).
2. Write in the editor: headings H2–H4, bold/italic/underline, lists, quotes, code blocks, links, images,
   dividers. Changes autosave 30 seconds after you stop typing ("Saved … ago").
3. Fill **SEO**: meta title ≤ 70 and meta description ≤ 160 characters. If you leave them empty the title
   and the first 160 characters of the body are used.
4. **Submit for review** when ready. You can see the status of all your items in the list
   (Draft · In review · Scheduled · Published · Unpublished · Archived).
5. Upload images or PDFs in **Media** (PNG, JPEG, WEBP, GIF, SVG, PDF; max 20 MB). Always add alt text.

## Editors

- Review items **In review**: **Publish**, or **Send back to draft**. You can also publish drafts directly.
- **Schedule…** publishes automatically at the chosen time (your local time zone).
- **Unpublish** removes an item from the website/API within a minute; **Archive** hides unpublished items.
- **Delete** moves an item to the bin; it is permanently removed after 30 days.
- **Version history** lists every save; _Restore this version_ creates a new version (nothing is lost).
- Media used by content cannot be deleted (Admins can force it).

## Admins

- **Users:** invite by email (the link is valid 7 days), change roles, send a password reset or resend an
  invite, deactivate (immediate sign-out; their content stays). The last Admin cannot be removed.
- **Audit log:** every sign-in, user, content and media action with time, person and IP; filter and
  **Export CSV**.
- **API keys:** create a key for each website/app that reads published content. The key is shown **once** —
  copy it immediately. Revoke keys that are no longer used.

## For frontend developers

Public API: `GET /api/v1/articles`, `/api/v1/articles/{slug}`, `/api/v1/pages`, `/api/v1/pages/{slug}`,
`/api/v1/media/{id}` with header `X-API-Key`. Interactive docs: `/docs`. Responses are cacheable
(`ETag`, `Last-Modified`, `Cache-Control: max-age=30`); send `If-None-Match` to get `304`.
