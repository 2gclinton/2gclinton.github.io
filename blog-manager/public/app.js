/* ======================================================
   Section 1: Utilities
   ====================================================== */

let toastTimeout = null;

function showToast(message, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', !!isError);
  toast.hidden = false;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

async function api(path, options = {}) {
  try {
    const opts = { ...options };
    if (!opts.headers) opts.headers = {};
    if (!opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Request failed', true);
      return null;
    }
    return data;
  } catch (err) {
    showToast(err.message, true);
    return null;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ======================================================
   Section 1b: Post URL Helpers
   ====================================================== */

const LIVE_SITE_URL = 'https://gclinton.com';
const PREVIEW_URL = 'http://localhost:4000';

function getPostUrl(post, baseUrl) {
  // Extract date and slug from filename: YYYY-MM-DD-slug.ext
  // Using filename date avoids timezone issues with Date parsing
  const match = post.filename.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.(markdown|md)$/);
  if (!match) return null;
  const [, year, month, day, slug] = match;

  // Jekyll lowercases categories in URLs
  let catPath = '';
  const cats = String(post.categories || '').trim();
  if (cats) {
    catPath = cats.split(/\s+/).map(c => c.toLowerCase()).join('/') + '/';
  }

  return `${baseUrl}/${catPath}${year}/${month}/${day}/${slug}.html`;
}

/* ======================================================
   Section 2: View Routing
   ====================================================== */

const views = ['dashboard', 'editor', 'pages', 'page-editor'];

function showView(name) {
  views.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.hidden = (v !== name);
  });
  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === name);
  });
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const view = link.dataset.view;
    if (view === 'dashboard') {
      loadDashboard();
    } else if (view === 'pages') {
      loadPages();
    }
  });
});

/* ======================================================
   Section 3: Dashboard
   ====================================================== */

async function loadDashboard() {
  showView('dashboard');
  const posts = await api('/api/posts');
  if (!posts) return;

  const tbody = document.getElementById('posts-body');
  tbody.innerHTML = '';

  posts.forEach(post => {
    const dateStr = post.date ? new Date(post.date).toLocaleDateString() : '';
    const statusClass = post.status === 'published' ? 'badge-published' : 'badge-draft';
    const statusLabel = post.status === 'published' ? 'Published' : 'Draft';

    // View link
    let viewLink = '';
    if (post.status === 'published') {
      const liveUrl = getPostUrl(post, LIVE_SITE_URL);
      if (liveUrl) {
        viewLink = `<a href="${liveUrl}" target="_blank" rel="noopener" class="action-btn outline view-link">View Live</a>`;
      }
    } else {
      const previewUrl = getPostUrl(post, PREVIEW_URL);
      if (previewUrl) {
        viewLink = `<a href="${previewUrl}" target="_blank" rel="noopener" class="action-btn outline view-link preview-link">Preview</a>`;
      }
    }

    let actionButtons = '';
    if (post.status === 'draft') {
      actionButtons += `<button class="action-btn outline" data-action="publish" data-filename="${escapeHtml(post.filename)}">Publish</button>`;
    } else {
      actionButtons += `<button class="action-btn outline" data-action="unpublish" data-filename="${escapeHtml(post.filename)}">Unpublish</button>`;
    }
    actionButtons += `<button class="action-btn outline secondary" data-action="delete" data-filename="${escapeHtml(post.filename)}">Delete</button>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" class="edit-link" data-filename="${escapeHtml(post.filename)}">${escapeHtml(post.title || post.filename)}</a></td>
      <td>${escapeHtml(dateStr)}</td>
      <td>${escapeHtml(String(post.categories || ''))}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td>${viewLink}${actionButtons}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Event delegation on posts table
document.getElementById('posts-table').addEventListener('click', async e => {
  // Open view links in a new tab
  const viewLink = e.target.closest('.view-link');
  if (viewLink) {
    e.preventDefault();
    window.open(viewLink.href, '_blank');
    return;
  }

  e.preventDefault();

  // Edit link
  const editLink = e.target.closest('.edit-link');
  if (editLink) {
    openEditor(editLink.dataset.filename);
    return;
  }

  // Action buttons
  const actionBtn = e.target.closest('.action-btn');
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const filename = actionBtn.dataset.filename;

  if (action === 'delete') {
    if (!confirm('Are you sure you want to delete this post?')) return;
    const result = await api(`/api/posts/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (result) {
      showToast('Post deleted');
      loadDashboard();
    }
  } else if (action === 'publish') {
    const result = await api(`/api/posts/${encodeURIComponent(filename)}/publish`, { method: 'POST' });
    if (result) {
      showToast('Post published');
      loadDashboard();
    }
  } else if (action === 'unpublish') {
    const result = await api(`/api/posts/${encodeURIComponent(filename)}/unpublish`, { method: 'POST' });
    if (result) {
      showToast('Post unpublished');
      loadDashboard();
    }
  }
});

// New Post button
document.getElementById('btn-new-post').addEventListener('click', () => {
  openEditor(null);
});

// Publish to Site button (git commit + push)
document.getElementById('btn-sync').addEventListener('click', async () => {
  if (!confirm('Commit and push all changes to GitHub? This will publish your site.')) return;
  const btn = document.getElementById('btn-sync');
  btn.disabled = true;
  btn.textContent = 'Publishing...';
  try {
    const result = await api('/api/sync', { method: 'POST' });
    showToast(result.message);
  } catch (err) {
    // error already shown by api()
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish to Site';
  }
});

/* ======================================================
   Section 4: Post Editor
   ====================================================== */

let editorMDE = null;
let editingFilename = null;
let selectedCategories = [];
let allCategories = [];

async function openEditor(filename) {
  showView('editor');
  editingFilename = filename;
  selectedCategories = [];

  // Load categories for autocomplete
  const cats = await api('/api/categories');
  if (cats) allCategories = cats;

  if (filename) {
    // Editing existing post
    document.getElementById('editor-heading').textContent = 'Edit Post';
    const post = await api(`/api/posts/${encodeURIComponent(filename)}`);
    if (!post) return;

    document.getElementById('editor-title').value = post.title || '';
    // Parse date for the date input (YYYY-MM-DD)
    if (post.date) {
      const d = new Date(post.date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      document.getElementById('editor-date').value = `${yyyy}-${mm}-${dd}`;
    } else {
      document.getElementById('editor-date').value = '';
    }
    document.getElementById('editor-layout').value = post.layout || 'post';

    // Parse categories
    const catStr = String(post.categories || '');
    if (catStr.trim()) {
      selectedCategories = catStr.trim().split(/\s+/);
    }

    initMDE(post.content || '');
  } else {
    // New post
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

  document.getElementById('editor-content').value = content;

  editorMDE = new EasyMDE({
    element: document.getElementById('editor-content'),
    spellChecker: false,
    sideBySideFullscreen: false,
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
  });

  // Drag-and-drop image upload on the CodeMirror instance
  editorMDE.codemirror.on('drop', async (cm, e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    e.preventDefault();

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Upload failed', true);
        return;
      }
      const pos = cm.coordsChar({ left: e.pageX, top: e.pageY });
      cm.replaceRange(`![${file.name}](${data.url})`, pos);
      showToast('Image uploaded');
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

function renderCategoryPills() {
  const pillsContainer = document.getElementById('categories-pills');
  pillsContainer.innerHTML = '';

  selectedCategories.forEach(cat => {
    const pill = document.createElement('span');
    pill.className = 'cat-pill';
    pill.innerHTML = `${escapeHtml(cat)} <span class="remove" data-cat="${escapeHtml(cat)}">&times;</span>`;
    pillsContainer.appendChild(pill);
  });

  // Remove pill handler
  pillsContainer.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      selectedCategories = selectedCategories.filter(c => c !== cat);
      renderCategoryPills();
    });
  });

  // Update datalist for autocomplete
  const datalist = document.getElementById('cat-datalist');
  datalist.innerHTML = '';
  allCategories
    .filter(c => !selectedCategories.includes(c))
    .forEach(c => {
      const option = document.createElement('option');
      option.value = c;
      datalist.appendChild(option);
    });
}

// Add category button
document.getElementById('btn-add-cat').addEventListener('click', addCategory);

// Enter key in category input
document.getElementById('cat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCategory();
  }
});

function addCategory() {
  const input = document.getElementById('cat-input');
  const val = input.value.trim();
  if (val && !selectedCategories.includes(val)) {
    selectedCategories.push(val);
    renderCategoryPills();
  }
  input.value = '';
}

/* ======================================================
   Section 5: Save / Publish
   ====================================================== */

function getEditorData() {
  return {
    title: document.getElementById('editor-title').value.trim(),
    date: document.getElementById('editor-date').value,
    layout: document.getElementById('editor-layout').value,
    categories: selectedCategories.join(' '),
    content: editorMDE ? editorMDE.value() : '',
  };
}

// Save Draft
document.getElementById('btn-save-draft').addEventListener('click', async () => {
  const data = getEditorData();
  if (!data.title) {
    showToast('Title is required', true);
    return;
  }
  data.status = 'draft';

  let result;
  if (editingFilename) {
    result = await api(`/api/posts/${encodeURIComponent(editingFilename)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } else {
    result = await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  if (result) {
    editingFilename = result.filename;
    showToast('Draft saved');
  }
});

// Publish
document.getElementById('btn-publish').addEventListener('click', async () => {
  const data = getEditorData();
  if (!data.title) {
    showToast('Title is required', true);
    return;
  }
  data.status = 'published';

  let result;
  if (editingFilename) {
    result = await api(`/api/posts/${encodeURIComponent(editingFilename)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } else {
    result = await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  if (result) {
    editingFilename = result.filename;
    showToast('Post published');
  }
});

// Back to dashboard
document.getElementById('btn-back-dashboard').addEventListener('click', e => {
  e.preventDefault();
  loadDashboard();
});

/* ======================================================
   Section 6: Pages
   ====================================================== */

let pageMDE = null;
let editingPage = null;

async function loadPages() {
  showView('pages');
  const pages = await api('/api/pages');
  if (!pages) return;

  const tbody = document.getElementById('pages-body');
  tbody.innerHTML = '';

  pages.forEach(page => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" class="page-edit-link" data-filename="${escapeHtml(page.filename)}">${escapeHtml(page.title || page.filename)}</a></td>
      <td>${escapeHtml(page.permalink || '')}</td>
      <td><button class="action-btn outline page-edit-link" data-filename="${escapeHtml(page.filename)}">Edit</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Event delegation on pages table
document.getElementById('pages-table').addEventListener('click', e => {
  e.preventDefault();
  const editLink = e.target.closest('.page-edit-link');
  if (editLink) {
    openPageEditor(editLink.dataset.filename);
  }
});

async function openPageEditor(filename) {
  showView('page-editor');
  editingPage = filename;

  document.getElementById('page-editor-heading').textContent = 'Edit Page';

  const page = await api(`/api/pages/${encodeURIComponent(filename)}`);
  if (!page) return;

  document.getElementById('page-editor-title').value = page.title || '';
  document.getElementById('page-editor-permalink').value = page.permalink || '';

  // Init EasyMDE for page content
  if (pageMDE) {
    pageMDE.toTextArea();
    pageMDE = null;
  }

  document.getElementById('page-editor-content').value = page.content || '';

  pageMDE = new EasyMDE({
    element: document.getElementById('page-editor-content'),
    spellChecker: false,
    sideBySideFullscreen: false,
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
  });
}

// Save Page
document.getElementById('btn-save-page').addEventListener('click', async () => {
  if (!editingPage) return;

  const data = {
    title: document.getElementById('page-editor-title').value.trim(),
    permalink: document.getElementById('page-editor-permalink').value.trim(),
    content: pageMDE ? pageMDE.value() : '',
  };

  const result = await api(`/api/pages/${encodeURIComponent(editingPage)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  if (result) {
    showToast('Page saved');
  }
});

// Save & Publish page
document.getElementById('btn-save-publish-page').addEventListener('click', async () => {
  if (!editingPage) return;

  const data = {
    title: document.getElementById('page-editor-title').value.trim(),
    permalink: document.getElementById('page-editor-permalink').value.trim(),
    content: pageMDE ? pageMDE.value() : '',
  };

  const result = await api(`/api/pages/${encodeURIComponent(editingPage)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  if (!result) return;

  const btn = document.getElementById('btn-save-publish-page');
  btn.disabled = true;
  btn.textContent = 'Publishing...';
  try {
    const sync = await api('/api/sync', { method: 'POST' });
    showToast(sync.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save & Publish';
  }
});

// Back to pages
document.getElementById('btn-back-pages').addEventListener('click', e => {
  e.preventDefault();
  loadPages();
});

/* ======================================================
   Section 7: Preview Server
   ====================================================== */

let previewRunning = false;
let previewPollInterval = null;

async function updatePreviewStatus() {
  const status = await api('/api/preview/status');
  if (!status) return;

  previewRunning = status.running;
  const btn = document.getElementById('btn-preview-toggle');
  const dot = document.getElementById('preview-dot');

  if (status.running && status.ready) {
    btn.textContent = 'Stop Preview';
    btn.classList.add('preview-active');
    dot.className = 'preview-dot ready';
    dot.title = 'Preview server running at localhost:4000';
    // Enable preview links
    document.querySelectorAll('.preview-link').forEach(el => {
      el.classList.remove('disabled');
    });
  } else if (status.running) {
    btn.textContent = 'Starting...';
    btn.disabled = true;
    dot.className = 'preview-dot starting';
    dot.title = 'Preview server starting...';
  } else {
    btn.textContent = 'Start Preview';
    btn.classList.remove('preview-active');
    btn.disabled = false;
    dot.className = 'preview-dot stopped';
    dot.title = 'Preview server stopped';
    // Disable preview links
    document.querySelectorAll('.preview-link').forEach(el => {
      el.classList.add('disabled');
    });
  }

  // Once ready, slow down polling
  if (status.running && status.ready) {
    btn.disabled = false;
    if (previewPollInterval) {
      clearInterval(previewPollInterval);
      previewPollInterval = setInterval(updatePreviewStatus, 10000);
    }
  }
}

document.getElementById('btn-preview-toggle').addEventListener('click', async () => {
  const btn = document.getElementById('btn-preview-toggle');
  btn.disabled = true;

  if (previewRunning) {
    await api('/api/preview/stop', { method: 'POST' });
    showToast('Preview server stopped');
  } else {
    await api('/api/preview/start', { method: 'POST' });
    showToast('Preview server starting...');
    // Poll faster while starting
    if (previewPollInterval) clearInterval(previewPollInterval);
    previewPollInterval = setInterval(updatePreviewStatus, 1500);
  }

  await updatePreviewStatus();
});

/* ======================================================
   Section 8: Analytics
   ====================================================== */

async function loadStats() {
  const stats = await api('/api/stats');
  if (!stats) return;
  document.getElementById('stat-pageviews').textContent = stats.pageviews;
  document.getElementById('stat-visitors').textContent = stats.visitors;
}

/* ======================================================
   Section 9: Init
   ====================================================== */

loadDashboard();
loadStats();
updatePreviewStatus();
// Poll preview status periodically
previewPollInterval = setInterval(updatePreviewStatus, 10000);
