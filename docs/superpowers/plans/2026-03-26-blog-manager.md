# Blog Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app at `localhost:9000` for authoring, managing, and publishing posts to a Jekyll GitHub Pages blog.

**Architecture:** Express server reads/writes directly to the Jekyll directory structure (`_posts/`, `_drafts/`, `assets/`). Single-page vanilla frontend uses EasyMDE for markdown editing and Pico CSS for styling. No build step, no database — the filesystem is the source of truth.

**Tech Stack:** Node.js, Express, multer, gray-matter, slugify, Pico CSS (CDN), EasyMDE (CDN)

---

## File Structure

```
blog-manager/
├── server.js              # Express server: static serving + all API routes
├── package.json           # Project metadata + 4 dependencies
├── public/
│   ├── index.html         # App shell: nav, view containers, editor markup
│   ├── style.css          # Custom styles on top of Pico CSS
│   └── app.js             # Vanilla JS: routing, API calls, editor init, image upload
└── launch/
    └── BlogManager.app/   # macOS app bundle for dock launch
        └── Contents/
            ├── Info.plist
            ├── MacOS/
            │   └── launch.sh
            └── Resources/
                └── AppIcon.icns
```

**Responsibilities:**
- `server.js`: All file I/O, front matter parsing, image handling, API routes. ~250 lines.
- `public/index.html`: Static markup for all three views (dashboard, editor, pages). Tab-style navigation hides/shows views. ~150 lines.
- `public/style.css`: Minimal overrides — Pico CSS does the heavy lifting. Category pills, toast, layout tweaks. ~100 lines.
- `public/app.js`: View switching, fetch wrappers, EasyMDE initialization, image drop handler, category picker logic, toast notifications. ~400 lines.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `blog-manager/package.json`
- Create: `blog-manager/server.js` (minimal — just static serving)
- Create: `blog-manager/public/index.html` (bare shell)

- [ ] **Step 1: Create package.json**

```bash
mkdir -p /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager/public
```

Create `blog-manager/package.json`:

```json
{
  "name": "blog-manager",
  "version": "1.0.0",
  "description": "Local blog manager for gclinton.com",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "gray-matter": "^4.0.3",
    "multer": "^1.4.5-lts.1",
    "slugify": "^1.6.6"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && npm install
```

Expected: `node_modules/` created, `package-lock.json` generated, 4 packages installed.

- [ ] **Step 3: Create minimal server.js**

Create `blog-manager/server.js`:

```js
const express = require('express');
const path = require('path');

const app = express();
const PORT = 9000;

// The blog root is one directory up from blog-manager/
const BLOG_ROOT = path.resolve(__dirname, '..');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Blog Manager running at http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Create bare index.html**

Create `blog-manager/public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog Manager</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
</head>
<body>
  <main class="container">
    <h1>Blog Manager</h1>
    <p>It works.</p>
  </main>
</body>
</html>
```

- [ ] **Step 5: Verify server starts and serves the page**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1 && curl -s http://localhost:9000 | head -5
kill %1
```

Expected: HTML output containing `<title>Blog Manager</title>`.

- [ ] **Step 6: Add blog-manager to Jekyll excludes and commit**

Add `blog-manager/` to the `exclude:` list in `_config.yml` so Jekyll doesn't try to process it.

```bash
git add blog-manager/package.json blog-manager/package-lock.json blog-manager/server.js blog-manager/public/index.html _config.yml
git commit -m "feat: scaffold blog-manager app with Express + Pico CSS"
```

---

### Task 2: Posts API — List and Read

**Files:**
- Modify: `blog-manager/server.js` (add GET /api/posts and GET /api/posts/:filename)

- [ ] **Step 1: Add posts list endpoint**

Add to `server.js` before `app.listen()`:

```js
const matter = require('gray-matter');
const fs = require('fs');

const POSTS_DIR = path.join(BLOG_ROOT, '_posts');
const DRAFTS_DIR = path.join(BLOG_ROOT, '_drafts');

// Ensure _drafts exists
if (!fs.existsSync(DRAFTS_DIR)) {
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
}

app.get('/api/posts', (req, res) => {
  try {
    const posts = [];

    // Read published posts
    if (fs.existsSync(POSTS_DIR)) {
      for (const file of fs.readdirSync(POSTS_DIR)) {
        if (!file.endsWith('.markdown') && !file.endsWith('.md')) continue;
        const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
        const { data } = matter(raw);
        posts.push({
          filename: file,
          title: data.title || file,
          date: data.date || null,
          categories: data.categories || '',
          layout: data.layout || 'post',
          status: 'published',
        });
      }
    }

    // Read drafts
    if (fs.existsSync(DRAFTS_DIR)) {
      for (const file of fs.readdirSync(DRAFTS_DIR)) {
        if (!file.endsWith('.markdown') && !file.endsWith('.md')) continue;
        const raw = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf8');
        const { data } = matter(raw);
        posts.push({
          filename: file,
          title: data.title || file,
          date: data.date || null,
          categories: data.categories || '',
          layout: data.layout || 'post',
          status: 'draft',
        });
      }
    }

    // Sort newest first
    posts.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Add single post read endpoint**

Add to `server.js`:

```js
app.get('/api/posts/:filename', (req, res) => {
  const { filename } = req.params;

  // Check _posts first, then _drafts
  let filePath = path.join(POSTS_DIR, filename);
  let status = 'published';

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DRAFTS_DIR, filename);
    status = 'draft';
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Post not found' });
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(raw);
    res.json({
      filename,
      title: data.title || '',
      date: data.date || null,
      categories: data.categories || '',
      layout: data.layout || 'post',
      status,
      content,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Verify endpoints work**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1
curl -s http://localhost:9000/api/posts | python3 -m json.tool | head -20
curl -s http://localhost:9000/api/posts/2024-09-02-AI-UI-problem.markdown | python3 -m json.tool | head -10
kill %1
```

Expected: JSON array of 5+ posts with title/date/categories/status fields. Single post returns content field with markdown body.

- [ ] **Step 4: Commit**

```bash
git add blog-manager/server.js
git commit -m "feat: add GET /api/posts list and read endpoints"
```

---

### Task 3: Posts API — Create, Update, Delete, Publish/Unpublish

**Files:**
- Modify: `blog-manager/server.js`

- [ ] **Step 1: Add helper to generate filenames**

Add to `server.js` after the requires:

```js
const slugify = require('slugify');

function makeFilename(title, date) {
  const slug = slugify(title, { lower: true, strict: true });
  const dateStr = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${dateStr}-${slug}.markdown`;
}

function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} -0400`;
}

function buildFileContent(title, date, categories, layout, content) {
  const frontMatter = [
    '---',
    `layout: ${layout || 'post'}`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    `date: ${formatDate(date)}`,
    `categories: ${categories || ''}`,
    '---',
  ].join('\n');
  return frontMatter + '\n' + (content || '');
}

function resolveUniqueFilename(dir, filename) {
  if (!fs.existsSync(path.join(dir, filename))) return filename;
  const ext = path.extname(filename);
  const base = filename.slice(0, -ext.length);
  let i = 2;
  while (fs.existsSync(path.join(dir, `${base}-${i}${ext}`))) i++;
  return `${base}-${i}${ext}`;
}
```

- [ ] **Step 2: Add create endpoint**

```js
app.post('/api/posts', (req, res) => {
  try {
    const { title, date, categories, layout, content, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const dir = status === 'published' ? POSTS_DIR : DRAFTS_DIR;
    const filename = resolveUniqueFilename(dir, makeFilename(title, date));
    const fileContent = buildFileContent(title, date, categories, layout, content);

    fs.writeFileSync(path.join(dir, filename), fileContent, 'utf8');
    res.json({ filename, status: status || 'draft' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Add update endpoint**

```js
app.put('/api/posts/:filename', (req, res) => {
  const { filename } = req.params;
  const { title, date, categories, layout, content } = req.body;

  // Find where the file currently lives
  let filePath = path.join(POSTS_DIR, filename);
  let currentStatus = 'published';
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DRAFTS_DIR, filename);
    currentStatus = 'draft';
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Post not found' });
  }

  try {
    const fileContent = buildFileContent(title, date, categories, layout, content);

    // If title or date changed, the filename changes too
    const newFilename = makeFilename(title, date);
    const dir = currentStatus === 'published' ? POSTS_DIR : DRAFTS_DIR;

    // Delete old file
    fs.unlinkSync(filePath);

    // Write new file (resolve conflicts)
    const finalFilename = resolveUniqueFilename(dir, newFilename);
    fs.writeFileSync(path.join(dir, finalFilename), fileContent, 'utf8');

    res.json({ filename: finalFilename, status: currentStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Add delete endpoint**

```js
app.delete('/api/posts/:filename', (req, res) => {
  const { filename } = req.params;

  let filePath = path.join(POSTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DRAFTS_DIR, filename);
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Post not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ deleted: filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 5: Add publish/unpublish endpoints**

```js
app.post('/api/posts/:filename/publish', (req, res) => {
  const { filename } = req.params;
  const src = path.join(DRAFTS_DIR, filename);
  if (!fs.existsSync(src)) {
    return res.status(404).json({ error: 'Draft not found' });
  }

  try {
    // Re-read to update the date to now if it's a draft without a date prefix
    const raw = fs.readFileSync(src, 'utf8');
    const { data, content } = matter(raw);
    const newFilename = makeFilename(data.title || filename, data.date || new Date());
    const dest = path.join(POSTS_DIR, resolveUniqueFilename(POSTS_DIR, newFilename));

    fs.writeFileSync(dest, raw, 'utf8');
    fs.unlinkSync(src);
    res.json({ filename: path.basename(dest), status: 'published' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts/:filename/unpublish', (req, res) => {
  const { filename } = req.params;
  const src = path.join(POSTS_DIR, filename);
  if (!fs.existsSync(src)) {
    return res.status(404).json({ error: 'Published post not found' });
  }

  try {
    const raw = fs.readFileSync(src, 'utf8');
    const dest = path.join(DRAFTS_DIR, resolveUniqueFilename(DRAFTS_DIR, filename));
    fs.writeFileSync(dest, raw, 'utf8');
    fs.unlinkSync(src);
    res.json({ filename: path.basename(dest), status: 'draft' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Add categories endpoint**

```js
app.get('/api/categories', (req, res) => {
  try {
    const cats = new Set();
    for (const dir of [POSTS_DIR, DRAFTS_DIR]) {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.markdown') && !file.endsWith('.md')) continue;
        const raw = fs.readFileSync(path.join(dir, file), 'utf8');
        const { data } = matter(raw);
        const c = data.categories;
        if (typeof c === 'string') {
          c.split(/\s+/).filter(Boolean).forEach((cat) => cats.add(cat));
        } else if (Array.isArray(c)) {
          c.forEach((cat) => cats.add(String(cat)));
        }
      }
    }
    res.json([...cats].sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 7: Verify create and categories**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1
curl -s -X POST http://localhost:9000/api/posts -H 'Content-Type: application/json' -d '{"title":"Test Post","date":"2026-03-26","categories":"testing","content":"Hello world","status":"draft"}' | python3 -m json.tool
curl -s http://localhost:9000/api/categories | python3 -m json.tool
# Clean up test draft
rm -f ../\_drafts/2026-03-26-test-post.markdown
kill %1
```

Expected: Create returns `{ "filename": "2026-03-26-test-post.markdown", "status": "draft" }`. Categories returns array including "testing", "AI", "speculation", "leadership", "code".

- [ ] **Step 8: Commit**

```bash
git add blog-manager/server.js
git commit -m "feat: add create, update, delete, publish/unpublish post endpoints"
```

---

### Task 4: Pages API

**Files:**
- Modify: `blog-manager/server.js`

- [ ] **Step 1: Add pages list and read/update endpoints**

Add to `server.js`:

```js
const PAGES_EXTENSIONS = ['.markdown', '.md', '.html'];
const PAGES_EXCLUDE = ['index.markdown', 'index.md', 'index.html', '404.html'];

app.get('/api/pages', (req, res) => {
  try {
    const pages = [];
    for (const file of fs.readdirSync(BLOG_ROOT)) {
      if (!PAGES_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;
      if (PAGES_EXCLUDE.includes(file)) continue;
      const raw = fs.readFileSync(path.join(BLOG_ROOT, file), 'utf8');
      const { data } = matter(raw);
      pages.push({
        filename: file,
        title: data.title || file,
        layout: data.layout || 'page',
        permalink: data.permalink || null,
      });
    }
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pages/:filename', (req, res) => {
  const filePath = path.join(BLOG_ROOT, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(raw);
    res.json({
      filename: req.params.filename,
      title: data.title || '',
      layout: data.layout || 'page',
      permalink: data.permalink || '',
      content,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pages/:filename', (req, res) => {
  const filePath = path.join(BLOG_ROOT, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  try {
    const { title, layout, permalink, content } = req.body;
    const frontMatter = ['---', `layout: ${layout || 'page'}`, `title: ${title}`];
    if (permalink) frontMatter.push(`permalink: ${permalink}`);
    frontMatter.push('---');
    fs.writeFileSync(filePath, frontMatter.join('\n') + '\n' + (content || ''), 'utf8');
    res.json({ filename: req.params.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Verify**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1
curl -s http://localhost:9000/api/pages | python3 -m json.tool
curl -s http://localhost:9000/api/pages/about.markdown | python3 -m json.tool | head -10
kill %1
```

Expected: Pages list returns about.markdown and resources.markdown. Single page returns content with front matter fields.

- [ ] **Step 3: Commit**

```bash
git add blog-manager/server.js
git commit -m "feat: add pages list, read, and update endpoints"
```

---

### Task 5: Image Upload API

**Files:**
- Modify: `blog-manager/server.js`

- [ ] **Step 1: Add multer upload endpoint**

Add to the top of `server.js` with other requires:

```js
const multer = require('multer');
```

Add the upload route:

```js
const ASSETS_DIR = path.join(BLOG_ROOT, 'assets');

// Ensure assets dir exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid image file provided' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const name = path.basename(req.file.originalname, ext);
    const slug = slugify(name, { lower: true, strict: true });
    let filename = `${slug}${ext}`;

    // Avoid overwriting
    let i = 2;
    while (fs.existsSync(path.join(ASSETS_DIR, filename))) {
      filename = `${slug}-${i}${ext}`;
      i++;
    }

    fs.writeFileSync(path.join(ASSETS_DIR, filename), req.file.buffer);
    res.json({ url: `/assets/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Update the multer config to use memory storage (add `storage` option):

```js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});
```

- [ ] **Step 2: Verify upload works**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1
# Create a tiny test image
printf '\x89PNG\r\n\x1a\n' > /tmp/test-upload.png
curl -s -X POST http://localhost:9000/api/upload -F "image=@/tmp/test-upload.png" | python3 -m json.tool
# Clean up
rm -f ../assets/test-upload.png /tmp/test-upload.png
kill %1
```

Expected: Returns `{ "url": "/assets/test-upload.png" }`.

- [ ] **Step 3: Commit**

```bash
git add blog-manager/server.js
git commit -m "feat: add image upload endpoint with slugified filenames"
```

---

### Task 6: Frontend — HTML Shell and Styles

**Files:**
- Modify: `blog-manager/public/index.html` (replace placeholder content)
- Create: `blog-manager/public/style.css`

- [ ] **Step 1: Write the full HTML shell**

Replace `blog-manager/public/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog Manager</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav class="container">
    <ul>
      <li><strong>Blog Manager</strong></li>
    </ul>
    <ul>
      <li><a href="#" data-view="dashboard" class="nav-link active">Posts</a></li>
      <li><a href="#" data-view="pages" class="nav-link">Pages</a></li>
    </ul>
  </nav>

  <main class="container">

    <!-- Dashboard View -->
    <section id="view-dashboard">
      <header>
        <hgroup>
          <h2>Posts</h2>
          <p>All published posts and drafts</p>
        </hgroup>
        <button id="btn-new-post" class="btn-new">+ New Post</button>
      </header>
      <table id="posts-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Categories</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="posts-body"></tbody>
      </table>
    </section>

    <!-- Editor View -->
    <section id="view-editor" hidden>
      <header>
        <a href="#" id="btn-back-dashboard">&larr; Back to Posts</a>
        <h2 id="editor-heading">New Post</h2>
      </header>

      <div class="grid">
        <label>
          Title
          <input type="text" id="editor-title" placeholder="Post title" required>
        </label>
        <label>
          Date
          <input type="date" id="editor-date">
        </label>
      </div>

      <div class="grid">
        <label>
          Layout
          <select id="editor-layout">
            <option value="post">post</option>
            <option value="page">page</option>
          </select>
        </label>
        <div>
          <label>Categories</label>
          <div id="categories-picker">
            <div id="categories-pills"></div>
            <div class="cat-input-row">
              <input type="text" id="cat-input" placeholder="Add category...">
              <button id="btn-add-cat" class="outline" type="button">Add</button>
            </div>
          </div>
        </div>
      </div>

      <label>
        Content
        <textarea id="editor-content"></textarea>
      </label>

      <div class="editor-actions">
        <button id="btn-save-draft" class="secondary">Save Draft</button>
        <button id="btn-publish">Publish</button>
      </div>
    </section>

    <!-- Pages View -->
    <section id="view-pages" hidden>
      <hgroup>
        <h2>Pages</h2>
        <p>Edit existing site pages</p>
      </hgroup>
      <table id="pages-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Permalink</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="pages-body"></tbody>
      </table>
    </section>

    <!-- Page Editor View -->
    <section id="view-page-editor" hidden>
      <header>
        <a href="#" id="btn-back-pages">&larr; Back to Pages</a>
        <h2 id="page-editor-heading">Edit Page</h2>
      </header>

      <div class="grid">
        <label>
          Title
          <input type="text" id="page-editor-title">
        </label>
        <label>
          Permalink
          <input type="text" id="page-editor-permalink" placeholder="/about/">
        </label>
      </div>

      <label>
        Content
        <textarea id="page-editor-content"></textarea>
      </label>

      <div class="editor-actions">
        <button id="btn-save-page">Save Page</button>
      </div>
    </section>

  </main>

  <!-- Toast -->
  <div id="toast" class="toast" hidden></div>

  <script src="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js"></script>
  <script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write custom styles**

Create `blog-manager/public/style.css`:

```css
/* Dashboard header layout */
#view-dashboard > header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.btn-new {
  white-space: nowrap;
}

/* Category pills */
#categories-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  background: var(--pico-primary-background);
  color: var(--pico-primary-inverse);
  font-size: 0.85rem;
  cursor: default;
}

.cat-pill .remove {
  cursor: pointer;
  font-weight: bold;
  opacity: 0.7;
}

.cat-pill .remove:hover {
  opacity: 1;
}

.cat-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.cat-input-row input {
  margin-bottom: 0;
}

.cat-input-row button {
  margin-bottom: 0;
  padding: 0.4rem 0.8rem;
}

/* Editor actions bar */
.editor-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* Status badges */
.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge-published {
  background: #d4edda;
  color: #155724;
}

.badge-draft {
  background: #fff3cd;
  color: #856404;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  background: var(--pico-primary-background);
  color: var(--pico-primary-inverse);
  font-size: 0.9rem;
  z-index: 1000;
  transition: opacity 0.3s;
}

.toast.error {
  background: #f8d7da;
  color: #721c24;
}

/* Nav active state */
.nav-link.active {
  font-weight: bold;
  text-decoration: underline;
}

/* Action buttons in table */
.action-btn {
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  margin-right: 0.3rem;
  cursor: pointer;
}

/* Make EasyMDE taller */
.EasyMDEContainer .CodeMirror {
  min-height: 350px;
}
```

- [ ] **Step 3: Verify HTML loads with styles**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1
curl -s http://localhost:9000 | grep '<title>'
curl -s http://localhost:9000/style.css | head -3
kill %1
```

Expected: Title tag present, CSS file served.

- [ ] **Step 4: Commit**

```bash
git add blog-manager/public/index.html blog-manager/public/style.css
git commit -m "feat: add blog manager HTML shell and styles"
```

---

### Task 7: Frontend — JavaScript Application

**Files:**
- Create: `blog-manager/public/app.js`

This is the largest file. It handles view switching, API calls, EasyMDE initialization, category picking, image drag-and-drop, and toast notifications.

- [ ] **Step 1: Write app.js — utilities and view routing**

Create `blog-manager/public/app.js`:

```js
// ── Utilities ────────────────────────────────────────────

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.hidden = true; }, 3000);
}

async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    showToast(err.message, true);
    throw err;
  }
}

// ── View Routing ─────────────────────────────────────────

const views = ['dashboard', 'editor', 'pages', 'page-editor'];

function showView(name) {
  views.forEach((v) => {
    document.getElementById(`view-${v}`).hidden = v !== name;
  });

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach((link) => {
    const target = link.dataset.view;
    link.classList.toggle('active', target === name || (target === 'dashboard' && name === 'editor') || (target === 'pages' && name === 'page-editor'));
  });
}

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    if (view === 'dashboard') loadDashboard();
    if (view === 'pages') loadPages();
  });
});
```

- [ ] **Step 2: Write app.js — dashboard**

Append to `app.js`:

```js
// ── Dashboard ────────────────────────────────────────────

async function loadDashboard() {
  showView('dashboard');
  const posts = await api('/api/posts');
  const tbody = document.getElementById('posts-body');
  tbody.innerHTML = '';

  for (const post of posts) {
    const tr = document.createElement('tr');
    const dateStr = post.date ? new Date(post.date).toLocaleDateString() : '—';
    const cats = typeof post.categories === 'string' ? post.categories : (post.categories || []).join(' ');

    tr.innerHTML = `
      <td><a href="#" class="edit-link" data-filename="${post.filename}">${escapeHtml(post.title)}</a></td>
      <td>${dateStr}</td>
      <td>${escapeHtml(cats)}</td>
      <td><span class="badge badge-${post.status}">${post.status}</span></td>
      <td>
        ${post.status === 'draft'
          ? `<button class="action-btn outline" data-action="publish" data-filename="${post.filename}">Publish</button>`
          : `<button class="action-btn outline" data-action="unpublish" data-filename="${post.filename}">Unpublish</button>`
        }
        <button class="action-btn outline secondary" data-action="delete" data-filename="${post.filename}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Dashboard event delegation
document.getElementById('posts-table').addEventListener('click', async (e) => {
  const link = e.target.closest('.edit-link');
  if (link) {
    e.preventDefault();
    openEditor(link.dataset.filename);
    return;
  }

  const btn = e.target.closest('.action-btn');
  if (!btn) return;

  const { action, filename } = btn.dataset;

  if (action === 'delete') {
    if (!confirm(`Delete "${filename}"?`)) return;
    await api(`/api/posts/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    showToast('Deleted');
    loadDashboard();
  }

  if (action === 'publish') {
    await api(`/api/posts/${encodeURIComponent(filename)}/publish`, { method: 'POST' });
    showToast('Published');
    loadDashboard();
  }

  if (action === 'unpublish') {
    await api(`/api/posts/${encodeURIComponent(filename)}/unpublish`, { method: 'POST' });
    showToast('Moved to drafts');
    loadDashboard();
  }
});

document.getElementById('btn-new-post').addEventListener('click', () => openEditor(null));
```

- [ ] **Step 3: Write app.js — post editor with EasyMDE and image upload**

Append to `app.js`:

```js
// ── Post Editor ──────────────────────────────────────────

let editorMDE = null;
let editingFilename = null;
let selectedCategories = [];
let allCategories = [];

async function openEditor(filename) {
  showView('editor');
  editingFilename = filename;

  // Load categories
  allCategories = await api('/api/categories');

  if (filename) {
    document.getElementById('editor-heading').textContent = 'Edit Post';
    const post = await api(`/api/posts/${encodeURIComponent(filename)}`);
    document.getElementById('editor-title').value = post.title;
    document.getElementById('editor-date').value = post.date ? new Date(post.date).toISOString().slice(0, 10) : '';
    document.getElementById('editor-layout').value = post.layout || 'post';

    const cats = typeof post.categories === 'string' ? post.categories.split(/\s+/).filter(Boolean) : (post.categories || []);
    selectedCategories = [...cats];

    initMDE(post.content || '');
  } else {
    document.getElementById('editor-heading').textContent = 'New Post';
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('editor-layout').value = 'post';
    selectedCategories = [];
    initMDE('');
  }

  renderCategoryPills();
}

function initMDE(content) {
  if (editorMDE) {
    editorMDE.toTextArea();
    editorMDE = null;
  }

  const textarea = document.getElementById('editor-content');
  textarea.value = content;

  editorMDE = new EasyMDE({
    element: textarea,
    spellChecker: false,
    autosave: { enabled: false },
    placeholder: 'Write your post in markdown...',
    toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'],
    sideBySideFullscreen: false,
  });

  // Drag-and-drop image upload
  editorMDE.codemirror.on('drop', async (cm, e) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    e.preventDefault();

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const cursor = cm.getCursor();
      cm.replaceRange(`![${file.name}](${data.url})`, cursor);
      showToast('Image uploaded');
    } catch (err) {
      showToast('Upload failed: ' + err.message, true);
    }
  });
}

// Category picker
function renderCategoryPills() {
  const container = document.getElementById('categories-pills');
  container.innerHTML = '';

  for (const cat of selectedCategories) {
    const pill = document.createElement('span');
    pill.className = 'cat-pill';
    pill.innerHTML = `${escapeHtml(cat)} <span class="remove" data-cat="${escapeHtml(cat)}">&times;</span>`;
    container.appendChild(pill);
  }

  // Show suggestions from existing categories not yet selected
  const input = document.getElementById('cat-input');
  input.setAttribute('list', 'cat-suggestions');

  let datalist = document.getElementById('cat-suggestions');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'cat-suggestions';
    input.parentNode.appendChild(datalist);
  }
  datalist.innerHTML = allCategories
    .filter((c) => !selectedCategories.includes(c))
    .map((c) => `<option value="${escapeHtml(c)}">`)
    .join('');
}

document.getElementById('categories-pills').addEventListener('click', (e) => {
  const remove = e.target.closest('.remove');
  if (!remove) return;
  selectedCategories = selectedCategories.filter((c) => c !== remove.dataset.cat);
  renderCategoryPills();
});

document.getElementById('btn-add-cat').addEventListener('click', addCategory);
document.getElementById('cat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
});

function addCategory() {
  const input = document.getElementById('cat-input');
  const val = input.value.trim();
  if (val && !selectedCategories.includes(val)) {
    selectedCategories.push(val);
    renderCategoryPills();
  }
  input.value = '';
  input.focus();
}
```

- [ ] **Step 4: Write app.js — save/publish actions**

Append to `app.js`:

```js
// ── Save / Publish ───────────────────────────────────────

function getEditorData() {
  return {
    title: document.getElementById('editor-title').value.trim(),
    date: document.getElementById('editor-date').value,
    layout: document.getElementById('editor-layout').value,
    categories: selectedCategories.join(' '),
    content: editorMDE ? editorMDE.value() : '',
  };
}

document.getElementById('btn-save-draft').addEventListener('click', async () => {
  const data = getEditorData();
  if (!data.title) return showToast('Title is required', true);

  if (editingFilename) {
    await api(`/api/posts/${encodeURIComponent(editingFilename)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, status: 'draft' }),
    });
  } else {
    await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ ...data, status: 'draft' }),
    });
  }

  showToast('Draft saved');
  loadDashboard();
});

document.getElementById('btn-publish').addEventListener('click', async () => {
  const data = getEditorData();
  if (!data.title) return showToast('Title is required', true);

  if (editingFilename) {
    await api(`/api/posts/${encodeURIComponent(editingFilename)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    // If it was a draft, also publish it
    // We need to figure out the new filename after the update
    // Simplify: just save with published status
    const result = await api(`/api/posts/${encodeURIComponent(editingFilename)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } else {
    await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ ...data, status: 'published' }),
    });
  }

  showToast('Published');
  loadDashboard();
});

document.getElementById('btn-back-dashboard').addEventListener('click', (e) => {
  e.preventDefault();
  loadDashboard();
});
```

Wait — the publish logic for editing an existing post is awkward. Let me simplify. When the user clicks "Publish" on an existing post, we should update it and ensure it's in `_posts/`. Let me rethink this.

The cleaner approach: the `PUT` endpoint already knows which directory the file is in. We need a way to say "save AND move to published." Let's add a `status` field to the PUT body that the server respects.

**Revised Step 4 — update server.js PUT to handle status changes, then simplify client:**

First, update the PUT endpoint in `server.js` to accept a `status` field:

In Task 3's `app.put('/api/posts/:filename')`, replace the directory logic:

```js
app.put('/api/posts/:filename', (req, res) => {
  const { filename } = req.params;
  const { title, date, categories, layout, content, status } = req.body;

  // Find where the file currently lives
  let filePath = path.join(POSTS_DIR, filename);
  let currentStatus = 'published';
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DRAFTS_DIR, filename);
    currentStatus = 'draft';
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Post not found' });
  }

  try {
    const fileContent = buildFileContent(title, date, categories, layout, content);
    const newFilename = makeFilename(title, date);

    // Determine target directory — if status is provided, use it; otherwise keep current
    const targetStatus = status || currentStatus;
    const targetDir = targetStatus === 'published' ? POSTS_DIR : DRAFTS_DIR;

    // Delete old file
    fs.unlinkSync(filePath);

    // Write new file
    const finalFilename = resolveUniqueFilename(targetDir, newFilename);
    fs.writeFileSync(path.join(targetDir, finalFilename), fileContent, 'utf8');

    res.json({ filename: finalFilename, status: targetStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Then the client publish button becomes simply:

```js
document.getElementById('btn-save-draft').addEventListener('click', async () => {
  const data = getEditorData();
  if (!data.title) return showToast('Title is required', true);

  if (editingFilename) {
    await api(`/api/posts/${encodeURIComponent(editingFilename)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, status: 'draft' }),
    });
  } else {
    await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ ...data, status: 'draft' }),
    });
  }

  showToast('Draft saved');
  loadDashboard();
});

document.getElementById('btn-publish').addEventListener('click', async () => {
  const data = getEditorData();
  if (!data.title) return showToast('Title is required', true);

  if (editingFilename) {
    await api(`/api/posts/${encodeURIComponent(editingFilename)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, status: 'published' }),
    });
  } else {
    await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ ...data, status: 'published' }),
    });
  }

  showToast('Published');
  loadDashboard();
});

document.getElementById('btn-back-dashboard').addEventListener('click', (e) => {
  e.preventDefault();
  loadDashboard();
});
```

- [ ] **Step 5: Write app.js — pages view and page editor**

Append to `app.js`:

```js
// ── Pages ────────────────────────────────────────────────

let pageMDE = null;
let editingPage = null;

async function loadPages() {
  showView('pages');
  const pages = await api('/api/pages');
  const tbody = document.getElementById('pages-body');
  tbody.innerHTML = '';

  for (const page of pages) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" class="page-edit-link" data-filename="${page.filename}">${escapeHtml(page.title)}</a></td>
      <td>${escapeHtml(page.permalink || '—')}</td>
      <td><button class="action-btn outline page-edit-link" data-filename="${page.filename}">Edit</button></td>
    `;
    tbody.appendChild(tr);
  }
}

document.getElementById('pages-table').addEventListener('click', async (e) => {
  const link = e.target.closest('.page-edit-link');
  if (!link) return;
  e.preventDefault();
  await openPageEditor(link.dataset.filename);
});

async function openPageEditor(filename) {
  showView('page-editor');
  editingPage = filename;
  const page = await api(`/api/pages/${encodeURIComponent(filename)}`);

  document.getElementById('page-editor-heading').textContent = `Edit: ${page.title}`;
  document.getElementById('page-editor-title').value = page.title;
  document.getElementById('page-editor-permalink').value = page.permalink || '';

  if (pageMDE) {
    pageMDE.toTextArea();
    pageMDE = null;
  }

  const textarea = document.getElementById('page-editor-content');
  textarea.value = page.content || '';

  pageMDE = new EasyMDE({
    element: textarea,
    spellChecker: false,
    placeholder: 'Page content...',
    toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', '|', 'preview', 'side-by-side', 'fullscreen'],
    sideBySideFullscreen: false,
  });
}

document.getElementById('btn-save-page').addEventListener('click', async () => {
  if (!editingPage) return;

  await api(`/api/pages/${encodeURIComponent(editingPage)}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: document.getElementById('page-editor-title').value.trim(),
      permalink: document.getElementById('page-editor-permalink').value.trim(),
      content: pageMDE ? pageMDE.value() : '',
    }),
  });

  showToast('Page saved');
  loadPages();
});

document.getElementById('btn-back-pages').addEventListener('click', (e) => {
  e.preventDefault();
  loadPages();
});

// ── Init ─────────────────────────────────────────────────

loadDashboard();
```

- [ ] **Step 6: Verify the full app loads and shows posts**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1
curl -s http://localhost:9000/app.js | wc -l
curl -s http://localhost:9000/api/posts | python3 -c "import sys,json; posts=json.load(sys.stdin); print(f'{len(posts)} posts loaded')"
kill %1
```

Expected: `app.js` has ~300+ lines. API returns 5+ posts.

- [ ] **Step 7: Commit**

```bash
git add blog-manager/public/app.js
git commit -m "feat: add full frontend JS — dashboard, editor, pages, image upload"
```

---

### Task 8: macOS Dock Launcher

**Files:**
- Create: `blog-manager/launch/BlogManager.app/Contents/Info.plist`
- Create: `blog-manager/launch/BlogManager.app/Contents/MacOS/launch.sh`

- [ ] **Step 1: Create the app bundle structure**

```bash
mkdir -p /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager/launch/BlogManager.app/Contents/MacOS
mkdir -p /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager/launch/BlogManager.app/Contents/Resources
```

- [ ] **Step 2: Write Info.plist**

Create `blog-manager/launch/BlogManager.app/Contents/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Blog Manager</string>
  <key>CFBundleDisplayName</key>
  <string>Blog Manager</string>
  <key>CFBundleIdentifier</key>
  <string>com.gclinton.blog-manager</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleExecutable</key>
  <string>launch.sh</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
```

- [ ] **Step 3: Write launch script**

Create `blog-manager/launch/BlogManager.app/Contents/MacOS/launch.sh`:

```bash
#!/bin/bash

# Resolve the blog-manager directory (two levels up from MacOS/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOG_MANAGER_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$BLOG_MANAGER_DIR" || exit 1

# Kill any existing instance on port 9000
lsof -ti:9000 | xargs kill -9 2>/dev/null

# Start the server
node server.js &
SERVER_PID=$!

# Wait for server to be ready
for i in {1..10}; do
  curl -s http://localhost:9000 > /dev/null 2>&1 && break
  sleep 0.5
done

# Open browser
open http://localhost:9000

# Wait for the server process — keeps the app "running" in the dock
wait $SERVER_PID
```

- [ ] **Step 4: Make launch script executable**

```bash
chmod +x /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager/launch/BlogManager.app/Contents/MacOS/launch.sh
```

- [ ] **Step 5: Test the launcher**

```bash
open /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager/launch/BlogManager.app
```

Expected: Browser opens to `http://localhost:9000` showing the Blog Manager dashboard. The app appears in the dock while running.

After verifying, close the app (Cmd+Q on the dock icon or kill the process):

```bash
lsof -ti:9000 | xargs kill -9 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add blog-manager/launch/
git commit -m "feat: add macOS dock launcher app bundle"
```

---

### Task 9: Final Integration — Exclude from Jekyll, Update .gitignore

**Files:**
- Modify: `_config.yml`
- Modify: `.gitignore` (create if needed)

- [ ] **Step 1: Add blog-manager to Jekyll excludes**

This was done in Task 1 Step 6, but verify it's there. The `exclude:` list in `_config.yml` should include:

```yaml
- blog-manager/
```

- [ ] **Step 2: Add node_modules to .gitignore**

Check if `.gitignore` exists. If not, create it. Ensure it contains:

```
blog-manager/node_modules/
```

- [ ] **Step 3: Verify everything works end-to-end**

```bash
cd /Users/greg/Documents/GitHub/2gclinton.github.io/blog-manager && node server.js &
sleep 1

echo "=== Posts ==="
curl -s http://localhost:9000/api/posts | python3 -c "import sys,json; [print(f'  {p[\"status\"]}: {p[\"title\"]}') for p in json.load(sys.stdin)]"

echo "=== Categories ==="
curl -s http://localhost:9000/api/categories | python3 -m json.tool

echo "=== Pages ==="
curl -s http://localhost:9000/api/pages | python3 -c "import sys,json; [print(f'  {p[\"title\"]}') for p in json.load(sys.stdin)]"

echo "=== Create test draft ==="
curl -s -X POST http://localhost:9000/api/posts -H 'Content-Type: application/json' -d '{"title":"Integration Test","date":"2026-03-26","categories":"testing","content":"# Test\nHello","status":"draft"}' | python3 -m json.tool

echo "=== Publish it ==="
curl -s -X POST "http://localhost:9000/api/posts/2026-03-26-integration-test.markdown/publish" -X POST | python3 -m json.tool

echo "=== Delete it ==="
curl -s -X DELETE "http://localhost:9000/api/posts/2026-03-26-integration-test.markdown" | python3 -m json.tool

kill %1
```

Expected: All 5 existing posts listed, categories include AI/code/speculation/leadership, pages show about + resources, draft created then published then deleted successfully.

- [ ] **Step 4: Final commit**

```bash
git add _config.yml .gitignore
git commit -m "chore: exclude blog-manager from Jekyll build and gitignore node_modules"
```

---

## Summary

| Task | What It Builds | Files |
|------|---------------|-------|
| 1 | Project scaffolding | package.json, server.js (minimal), index.html (bare) |
| 2 | Posts API — list + read | server.js |
| 3 | Posts API — create, update, delete, publish/unpublish | server.js |
| 4 | Pages API — list, read, update | server.js |
| 5 | Image upload API | server.js |
| 6 | Frontend HTML + CSS | index.html, style.css |
| 7 | Frontend JavaScript | app.js |
| 8 | macOS dock launcher | BlogManager.app bundle |
| 9 | Final integration + gitignore | _config.yml, .gitignore |
