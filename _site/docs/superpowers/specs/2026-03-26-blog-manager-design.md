# Blog Manager — Design Spec

A lightweight local web app for authoring, managing, and publishing posts to a Jekyll-based GitHub Pages blog at `gclinton.com`.

## Goals

- Replace manual file creation with a clean browser UI at `localhost:9000`
- Write in markdown with live preview, drag-and-drop images, category/tag management
- Publish = write a correctly named, front-matter-complete `.markdown` file to `_posts/`
- Zero build step. `node server.js` and go.
- Launchable from macOS dock as a native-feeling app

## Non-Goals

- Not a CMS — no user accounts, no database, no auth
- Not a Jekyll build tool — doesn't run `bundle exec jekyll serve`
- Not a git client — doesn't commit or push (user does that manually)
- No deployment pipeline — GitHub Pages handles that

---

## Architecture

```
blog-manager/
├── server.js              # Express server, all API routes
├── package.json           # 4 dependencies
├── public/                # Static frontend (served by Express)
│   ├── index.html         # Single-page app shell
│   ├── style.css          # Custom styles on top of Pico CSS
│   └── app.js             # Vanilla JS — UI logic, editor, API calls
└── BlogManager.app/       # macOS Automator wrapper (optional)
```

Lives inside the blog repo at `blog-manager/` so it travels with the project.

### Backend (Express)

Single `server.js` file. All routes prefixed `/api/`.

**Routes:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/posts` | List all posts + drafts with parsed front matter |
| GET | `/api/posts/:filename` | Read a single post (front matter + body) |
| POST | `/api/posts` | Create a new post (draft or published) |
| PUT | `/api/posts/:filename` | Update an existing post |
| DELETE | `/api/posts/:filename` | Delete a post |
| POST | `/api/posts/:filename/publish` | Move a draft from `_drafts/` to `_posts/` |
| POST | `/api/posts/:filename/unpublish` | Move a published post back to `_drafts/` |
| GET | `/api/categories` | List all categories found across posts |
| GET | `/api/pages` | List pages (about, resources, etc.) |
| GET | `/api/pages/:filename` | Read a page |
| PUT | `/api/pages/:filename` | Update a page |
| POST | `/api/upload` | Upload an image to `assets/`, return markdown link |

**File operations:**

- Reads/writes directly to `../_posts/`, `../_drafts/`, `../assets/` (parent of `blog-manager/`)
- Uses `gray-matter` to parse and serialize YAML front matter
- Uses `slugify` to generate filenames from titles
- Filename format: `YYYY-MM-DD-slug.markdown`
- Image uploads handled by `multer`, saved to `../assets/` with slugified names (no spaces)

**Config:**

- Reads `../_config.yml` once at startup to extract site metadata (title, description, categories if any)
- Port: `9000` (hardcoded, no env var complexity)

### Frontend

A single-page app with three views, no framework, no build step.

**Tech:**
- Pico CSS (CDN) — clean, dark-mode-ready styling with zero classes needed
- EasyMDE (CDN) — markdown editor with toolbar, preview, and drag-and-drop
- Vanilla JS — fetch calls to `/api/*`, DOM manipulation

**Views:**

1. **Dashboard** — table of all posts and drafts
   - Columns: title, date, categories, status (draft/published)
   - Sort by date (newest first)
   - Click title to edit
   - "New Post" button
   - Quick-action buttons: publish/unpublish, delete (with confirm)

2. **Post Editor** — the main authoring view
   - Title field (text input)
   - Date picker (defaults to today)
   - Layout selector (dropdown: `post`, `page` — pre-filled from existing posts)
   - Categories (multi-select pills + "add new" input)
   - EasyMDE markdown editor (full width, tall)
     - Drag-and-drop images: intercepted, uploaded via `/api/upload`, markdown `![](/assets/filename.png)` inserted at cursor
     - Toolbar: bold, italic, heading, link, image, list, preview, side-by-side, fullscreen
   - Live preview panel (EasyMDE built-in side-by-side mode)
   - Action buttons:
     - "Save Draft" — writes to `_drafts/`
     - "Publish" — writes to `_posts/` with dated filename
     - "Back to Dashboard"

3. **Pages** — simple list of existing pages (about, resources, etc.)
   - Click to edit with the same markdown editor
   - No create/delete (pages are rarely added)

**UI details:**
- Light mode by default (Pico CSS default theme)
- Responsive but optimized for desktop (this is a local tool)
- Minimal custom CSS — Pico handles typography, forms, buttons, tables
- Toast notifications for save/publish/error feedback (a small vanilla JS toast, ~20 lines)

### Front Matter Generation

When saving/publishing, the app constructs the front matter block:

```yaml
---
layout: post
title: "The Post Title"
date: 2026-03-26 12:00:00 -0400
categories: AI speculation
---
```

- `layout`: from the layout dropdown (default: `post`)
- `title`: from the title input, quoted
- `date`: from the date picker + hardcoded `-0400` timezone offset (matches existing posts)
- `categories`: space-separated string from selected categories

The body follows after the closing `---`.

### Image Handling

1. User drags image into EasyMDE editor
2. JS intercepts the drop event, POSTs file to `/api/upload`
3. Server saves to `../assets/` with a slugified filename (spaces → hyphens, lowercase)
4. Server returns `{ "url": "/assets/my-image.png" }`
5. JS inserts `![](/assets/my-image.png)` at the cursor position in the editor

Supported formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
Max size: 10MB (multer limit)

### macOS Dock Launcher

A minimal `BlogManager.app` created via a shell script bundle:

```
BlogManager.app/
└── Contents/
    ├── Info.plist
    ├── MacOS/
    │   └── launch.sh    # Starts node server, opens browser, traps SIGTERM to kill server
    └── Resources/
        └── AppIcon.icns # Simple icon
```

`launch.sh` does:
1. `cd` to the `blog-manager/` directory
2. Start `node server.js` in background
3. Wait 1 second for server to start
4. `open http://localhost:9000`
5. `wait` on the node process (keeps app "running" in dock)
6. On quit (SIGTERM): kills the node process

The user drags `BlogManager.app` to their dock. One click to launch.

---

## Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `express` | HTTP server + routing | ~200KB |
| `multer` | Multipart file upload handling | ~40KB |
| `gray-matter` | YAML front matter parse/serialize | ~30KB |
| `slugify` | Title → filename slug | ~10KB |

Frontend (CDN, no install):
- Pico CSS v2
- EasyMDE (includes CodeMirror)

Total: 4 npm dependencies. No dev dependencies. No build step.

---

## File Naming Convention

Posts: `YYYY-MM-DD-slugified-title.markdown`
- Date from the date picker
- Slug from the title: lowercased, non-alphanumeric → hyphens, consecutive hyphens collapsed
- Extension: `.markdown` (matches existing posts)

Example: title "AI is a UI Problem", date 2024-09-02 → `2024-09-02-ai-is-a-ui-problem.markdown`

---

## Error Handling

- File write failures: return 500 with message, show toast in UI
- Duplicate filename: append `-2`, `-3` etc. if slug collision detected
- Missing title: client-side validation, prevent save
- Upload failures: show toast, don't insert broken markdown link
- Server not reachable: show connection banner at top of page

---

## What This Doesn't Do

- No git operations — user commits and pushes manually
- No Jekyll preview — use `bundle exec jekyll serve` separately if needed
- No multi-user — this is a single-user local tool
- No database — the filesystem IS the database
- No auth — localhost only, not exposed to network
