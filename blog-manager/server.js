const express = require('express');
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const multer = require('multer');
const slugify = require('slugify');

// --- Constants ---
const PORT = 9000;
const BLOG_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(BLOG_ROOT, '_posts');
const DRAFTS_DIR = path.join(BLOG_ROOT, '_drafts');
const ASSETS_DIR = path.join(BLOG_ROOT, 'assets');

// Ensure directories exist
if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// --- Helpers ---

function makeFilename(title, date) {
  const slug = slugify(title, { lower: true, strict: true });
  const dateStr = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${dateStr}-${slug}.markdown`;
}

function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  // Use 01:00:00 to avoid GitHub Pages skipping posts with future timestamps
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 01:00:00 -0400`;
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

function sanitizeFilename(filename) {
  const base = path.basename(filename);
  if (base !== filename || filename.includes('\0')) {
    return null;
  }
  return base;
}

function resolveUniqueFilename(dir, filename) {
  if (!fs.existsSync(path.join(dir, filename))) return filename;
  const ext = path.extname(filename);
  const base = filename.slice(0, -ext.length);
  let i = 2;
  while (fs.existsSync(path.join(dir, `${base}-${i}${ext}`))) i++;
  return `${base}-${i}${ext}`;
}

// --- App setup ---

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Multer setup for image uploads ---

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  },
});

// --- Route 1: GET /api/posts ---
// List all posts from _posts (published) and _drafts (draft)

app.get('/api/posts', (req, res) => {
  try {
    const posts = [];

    // Read published posts
    if (fs.existsSync(POSTS_DIR)) {
      const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.markdown') || f.endsWith('.md'));
      for (const filename of files) {
        const filePath = path.join(POSTS_DIR, filename);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);
        posts.push({
          filename,
          title: parsed.data.title || '',
          date: parsed.data.date || '',
          categories: parsed.data.categories || '',
          layout: parsed.data.layout || 'post',
          status: 'published',
        });
      }
    }

    // Read drafts
    if (fs.existsSync(DRAFTS_DIR)) {
      const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.markdown') || f.endsWith('.md'));
      for (const filename of files) {
        const filePath = path.join(DRAFTS_DIR, filename);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);
        posts.push({
          filename,
          title: parsed.data.title || '',
          date: parsed.data.date || '',
          categories: parsed.data.categories || '',
          layout: parsed.data.layout || 'post',
          status: 'draft',
        });
      }
    }

    // Sort newest first
    posts.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 2: GET /api/posts/:filename ---
// Read single post. Check _posts first, then _drafts.

app.get('/api/posts/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  try {
    let filePath = path.join(POSTS_DIR, filename);
    let status = 'published';

    if (!fs.existsSync(filePath)) {
      filePath = path.join(DRAFTS_DIR, filename);
      status = 'draft';
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);

    res.json({
      filename,
      title: parsed.data.title || '',
      date: parsed.data.date || '',
      categories: parsed.data.categories || '',
      layout: parsed.data.layout || 'post',
      status,
      content: parsed.content,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 3: POST /api/posts ---
// Create new post.

app.post('/api/posts', (req, res) => {
  try {
    const { title, date, categories, layout, content, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const targetDir = status === 'published' ? POSTS_DIR : DRAFTS_DIR;
    const targetStatus = status === 'published' ? 'published' : 'draft';
    let filename = makeFilename(title, date);
    filename = resolveUniqueFilename(targetDir, filename);

    const fileContent = buildFileContent(title, date, categories, layout, content);
    fs.writeFileSync(path.join(targetDir, filename), fileContent, 'utf-8');

    res.status(201).json({ filename, status: targetStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 4: PUT /api/posts/:filename ---
// Update post. Handle status changes (move between _posts and _drafts).

app.put('/api/posts/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  try {
    const { title, date, categories, layout, content, status } = req.body;

    // Find the file
    let filePath = path.join(POSTS_DIR, filename);
    let currentStatus = 'published';

    if (!fs.existsSync(filePath)) {
      filePath = path.join(DRAFTS_DIR, filename);
      currentStatus = 'draft';
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Read existing data
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);

    const newTitle = title !== undefined ? title : parsed.data.title;
    const newDate = date !== undefined ? date : parsed.data.date;
    const newCategories = categories !== undefined ? categories : (parsed.data.categories || '');
    const newLayout = layout !== undefined ? layout : (parsed.data.layout || 'post');
    const newContent = content !== undefined ? content : parsed.content;

    // Determine target directory based on status
    let targetStatus;
    let targetDir;
    if (status !== undefined) {
      targetStatus = status === 'published' ? 'published' : 'draft';
      targetDir = status === 'published' ? POSTS_DIR : DRAFTS_DIR;
    } else {
      targetStatus = currentStatus;
      targetDir = currentStatus === 'published' ? POSTS_DIR : DRAFTS_DIR;
    }

    // Generate new filename - write first, then delete old (safe ordering)
    const newFilename = makeFilename(newTitle, newDate);
    const finalFilename = resolveUniqueFilename(targetDir, newFilename);
    const newPath = path.join(targetDir, finalFilename);

    const fileContent = buildFileContent(newTitle, newDate, newCategories, newLayout, newContent);
    fs.writeFileSync(newPath, fileContent, 'utf-8');

    if (filePath !== newPath) {
      fs.unlinkSync(filePath);
    }

    res.json({ filename: finalFilename, status: targetStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 5: DELETE /api/posts/:filename ---
// Delete post from _posts or _drafts.

app.delete('/api/posts/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  try {
    let filePath = path.join(POSTS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(DRAFTS_DIR, filename);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 6: POST /api/posts/:filename/publish ---
// Move draft to _posts.

app.post('/api/posts/:filename/publish', (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  try {
    const draftPath = path.join(DRAFTS_DIR, filename);

    if (!fs.existsSync(draftPath)) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const raw = fs.readFileSync(draftPath, 'utf-8');
    const parsed = matter(raw);

    const title = parsed.data.title || 'untitled';
    const date = parsed.data.date;

    let newFilename = makeFilename(title, date);
    newFilename = resolveUniqueFilename(POSTS_DIR, newFilename);

    // Rebuild file content to ensure consistent formatting
    const fileContent = buildFileContent(
      parsed.data.title,
      parsed.data.date,
      parsed.data.categories || '',
      parsed.data.layout || 'post',
      parsed.content
    );

    fs.writeFileSync(path.join(POSTS_DIR, newFilename), fileContent, 'utf-8');
    fs.unlinkSync(draftPath);

    res.json({ filename: newFilename, status: 'published' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 7: POST /api/posts/:filename/unpublish ---
// Move published post to _drafts.

app.post('/api/posts/:filename/unpublish', (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  try {
    const postPath = path.join(POSTS_DIR, filename);

    if (!fs.existsSync(postPath)) {
      return res.status(404).json({ error: 'Published post not found' });
    }

    const raw = fs.readFileSync(postPath, 'utf-8');
    const parsed = matter(raw);

    let newFilename = resolveUniqueFilename(DRAFTS_DIR, filename);

    // Rebuild file content
    const fileContent = buildFileContent(
      parsed.data.title,
      parsed.data.date,
      parsed.data.categories || '',
      parsed.data.layout || 'post',
      parsed.content
    );

    fs.writeFileSync(path.join(DRAFTS_DIR, newFilename), fileContent, 'utf-8');
    fs.unlinkSync(postPath);

    res.json({ filename: newFilename, status: 'draft' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 8: GET /api/categories ---
// Scan all posts+drafts, extract categories, return sorted unique array.

app.get('/api/categories', (req, res) => {
  try {
    const categoriesSet = new Set();

    const dirs = [POSTS_DIR, DRAFTS_DIR];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.markdown') || f.endsWith('.md'));
      for (const filename of files) {
        const filePath = path.join(dir, filename);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);
        const cats = parsed.data.categories;
        if (Array.isArray(cats)) {
          cats.forEach(c => {
            if (c && typeof c === 'string') categoriesSet.add(c.trim());
          });
        } else if (typeof cats === 'string' && cats.trim()) {
          cats.trim().split(/\s+/).forEach(c => categoriesSet.add(c));
        }
      }
    }

    const sorted = Array.from(categoriesSet).sort();
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 9: GET /api/pages ---
// List .markdown/.md/.html files at BLOG_ROOT, excluding index.* and 404.html.

app.get('/api/pages', (req, res) => {
  try {
    const files = fs.readdirSync(BLOG_ROOT).filter(f => {
      if (f.startsWith('index.')) return false;
      if (f === '404.html') return false;
      const ext = path.extname(f).toLowerCase();
      return ['.markdown', '.md', '.html'].includes(ext);
    });

    const pages = files.map(filename => {
      const filePath = path.join(BLOG_ROOT, filename);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(raw);
      return {
        filename,
        title: parsed.data.title || '',
        layout: parsed.data.layout || '',
        permalink: parsed.data.permalink || '',
      };
    });

    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 10: GET /api/pages/:filename ---
// Read a single page.

app.get('/api/pages/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  try {
    const filePath = path.join(BLOG_ROOT, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);

    res.json({
      filename,
      title: parsed.data.title || '',
      layout: parsed.data.layout || '',
      permalink: parsed.data.permalink || '',
      content: parsed.content,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 11: PUT /api/pages/:filename ---
// Update a page.

app.put('/api/pages/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) return res.status(400).json({ error: 'Invalid filename' });

  const filePath = path.join(BLOG_ROOT, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  try {
    const { title, layout, permalink, content } = req.body;
    // Read existing to preserve unknown front matter fields
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    parsed.data.title = title;
    parsed.data.layout = layout || 'page';
    if (permalink) {
      parsed.data.permalink = permalink;
    } else {
      delete parsed.data.permalink;
    }
    fs.writeFileSync(filePath, matter.stringify(content || '', parsed.data), 'utf8');
    res.json({ filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Route 12: POST /api/upload ---
// Upload an image to assets/.

app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const nameWithoutExt = path.basename(req.file.originalname, ext);
    const slugifiedName = slugify(nameWithoutExt, { lower: true, strict: true });
    let filename = `${slugifiedName}${ext}`;

    filename = resolveUniqueFilename(ASSETS_DIR, filename);

    fs.writeFileSync(path.join(ASSETS_DIR, filename), req.file.buffer);

    // Auto-commit the image so it's included in the next push
    try {
      execSync(`git add assets/${filename}`, { cwd: BLOG_ROOT, encoding: 'utf8' });
      execSync(`git commit -m "Add image: ${filename}"`, { cwd: BLOG_ROOT, encoding: 'utf8' });
    } catch (gitErr) {
      // Non-fatal — image is saved, just not committed yet
      console.error('[upload] git commit failed:', gitErr.message);
    }

    res.status(201).json({ url: `/assets/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Error handler for multer ---
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// --- Git sync (commit + push) ---

const { execSync, spawn } = require('child_process');

// --- Jekyll preview server management ---
let jekyllProcess = null;
let jekyllReady = false;

function getJekyllStatus() {
  return {
    running: jekyllProcess !== null && !jekyllProcess.killed,
    ready: jekyllReady,
    url: 'http://localhost:4000',
  };
}

// Clean up Jekyll process on exit
function killJekyll() {
  if (jekyllProcess && !jekyllProcess.killed) {
    jekyllProcess.kill();
    jekyllProcess = null;
    jekyllReady = false;
  }
}
process.on('exit', killJekyll);
process.on('SIGINT', () => { killJekyll(); process.exit(); });
process.on('SIGTERM', () => { killJekyll(); process.exit(); });

app.post('/api/sync', (req, res) => {
  try {
    // Stage all changes in the blog root (posts, drafts, assets, pages)
    execSync('git add -A', { cwd: BLOG_ROOT, encoding: 'utf8' });

    // Check if there are staged changes
    const status = execSync('git status --porcelain', { cwd: BLOG_ROOT, encoding: 'utf8' }).trim();
    if (!status) {
      return res.json({ message: 'Nothing to publish — site is up to date.' });
    }

    // Commit with a timestamp message
    const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    execSync(`git commit -m "Publish: ${now}"`, { cwd: BLOG_ROOT, encoding: 'utf8' });

    // Push to origin
    execSync('git push', { cwd: BLOG_ROOT, encoding: 'utf8', timeout: 30000 });

    res.json({ message: 'Published to site.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// --- Analytics (GoatCounter) ---

const GOATCOUNTER_SITE = 'gclinton.goatcounter.com';

app.get('/api/stats', async (req, res) => {
  try {
    const response = await fetch(`https://${GOATCOUNTER_SITE}/counter/TOTAL.json`);
    if (!response.ok) {
      return res.status(502).json({ error: 'Could not fetch analytics' });
    }
    const data = await response.json();
    res.json({
      pageviews: data.count || '0',
      visitors: data.count_unique || '0',
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Jekyll preview server ---

app.get('/api/preview/status', (req, res) => {
  res.json(getJekyllStatus());
});

app.post('/api/preview/start', (req, res) => {
  if (jekyllProcess && !jekyllProcess.killed) {
    return res.json({ message: 'Preview server already running', ...getJekyllStatus() });
  }

  jekyllReady = false;
  const rubyBin = '/opt/homebrew/opt/ruby/bin';
  const gemBin = '/opt/homebrew/lib/ruby/gems/4.0.0/bin';
  const envPath = `${rubyBin}:${gemBin}:${process.env.PATH}`;
  const previewGemfile = path.join(__dirname, 'Gemfile.preview');

  jekyllProcess = spawn('jekyll', ['serve', '--drafts', '--future', '--port', '4000', '--host', 'localhost'], {
    cwd: BLOG_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: envPath, BUNDLE_GEMFILE: previewGemfile },
  });

  jekyllProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[jekyll stdout]', output);
    if (output.includes('Server running') || output.includes('Server address')) {
      jekyllReady = true;
    }
  });

  jekyllProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('[jekyll stderr]', output);
    if (output.includes('Server running') || output.includes('Server address')) {
      jekyllReady = true;
    }
  });

  jekyllProcess.on('close', (code) => {
    console.log('[jekyll] process exited with code', code);
    jekyllProcess = null;
    jekyllReady = false;
  });

  jekyllProcess.on('error', (err) => {
    console.error('[jekyll] spawn error:', err.message);
    jekyllProcess = null;
    jekyllReady = false;
  });

  res.json({ message: 'Preview server starting...', ...getJekyllStatus() });
});

app.post('/api/preview/stop', (req, res) => {
  if (!jekyllProcess || jekyllProcess.killed) {
    return res.json({ message: 'Preview server is not running', ...getJekyllStatus() });
  }

  killJekyll();
  res.json({ message: 'Preview server stopped', ...getJekyllStatus() });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Blog Manager running at http://localhost:${PORT}`);
  console.log(`Blog root: ${BLOG_ROOT}`);
});
