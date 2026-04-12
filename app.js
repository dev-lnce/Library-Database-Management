/* =============================================================================
   LIBRARY MANAGEMENT SYSTEM — Frontend JavaScript
   Capstone Project | Phase 3: app.js
   Handles: data fetching · book rendering · borrow flow · terminal logging
============================================================================= */

'use strict';

// ─── DOM refs ──────────────────────────────────────────────────────────────────
const booksList    = document.getElementById('books-list');
const memberSelect = document.getElementById('member-select');
const searchInput  = document.getElementById('search-input');
const termBody     = document.getElementById('term-body');
const termWelcome  = document.getElementById('term-welcome');
const toastEl      = document.getElementById('toast');

// Header stat elements
const statTitles = document.getElementById('stat-titles').querySelector('.stat-n');
const statAvail  = document.getElementById('stat-avail').querySelector('.stat-n');
const statOut    = document.getElementById('stat-out').querySelector('.stat-n');

// ─── App state ─────────────────────────────────────────────────────────────────
let allBooks       = [];   // full library catalogue
let selectedMember = null; // { member_id, full_name }
let toastTimer     = null;

// ─── Cover palette (cycles through for each book) ─────────────────────────────
const SPINE_COLORS = [
  '#1d4ed8','#7c3aed','#db2777','#ea580c',
  '#16a34a','#0891b2','#ca8a04','#be123c',
  '#0e7490','#4338ca','#065f46','#9333ea',
];


/* =============================================================================
   TERMINAL UTILITIES
============================================================================= */

/** Escape HTML to safely inject into innerHTML */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Append a "Executing…" spinner; returns the element so caller can remove it */
function addSpinner() {
  const el = document.createElement('div');
  el.className = 'term-spinner';
  el.innerHTML = '<div class="spinner"></div><span>Executing query…</span>';
  termBody.appendChild(el);
  scrollTerm();
  return el;
}

/** Remove the welcome placeholder on first real entry */
function clearWelcome() {
  if (termWelcome) termWelcome.remove();
}

/**
 * Append a complete SQL terminal entry.
 * @param {Object} opts
 *   method        {string}  HTTP verb: 'GET' | 'POST'
 *   endpoint      {string}  e.g. '/api/books'
 *   label         {string}  human description
 *   query         {string}  raw SQL string
 *   status        {string}  'ok' | 'err'
 *   rowCount      {number?} rows returned / affected
 *   error         {string?} error message if status === 'err'
 */
function addTerminalEntry({ method, endpoint, label, query, status, rowCount, error }) {
  clearWelcome();

  const now  = new Date();
  const time = now.toLocaleTimeString('en-PH', { hour12: false });

  const entry = document.createElement('div');
  entry.className = `term-entry ${status}`;

  const methodClass = `method-${method.toLowerCase()}`;
  const statusText  = status === 'ok' ? 'OK' : 'ERR';
  const statusClass = status === 'ok' ? 'status-ok' : 'status-err';

  const footerContent = status === 'ok'
    ? `<span class="entry-rows">${rowCount !== undefined ? `${rowCount} row(s)` : 'Done'}</span>`
    : `<span class="entry-err-msg">Error: ${esc(error)}</span>`;

  entry.innerHTML = `
    <div class="entry-header">
      <span class="entry-time">${time}</span>
      <span class="entry-method ${methodClass}">${method}</span>
      <span class="entry-endpoint">${esc(endpoint)}</span>
      ${label ? `<span class="entry-label">— ${esc(label)}</span>` : ''}
      <span class="entry-status ${statusClass}">${statusText}</span>
    </div>
    <pre class="language-sql"><code class="language-sql">${esc(query)}</code></pre>
    <div class="entry-footer">${footerContent}</div>
  `;

  termBody.appendChild(entry);

  // Syntax-highlight the newly added block
  if (window.Prism) {
    Prism.highlightAllUnder(entry);
  }

  scrollTerm();
}

function scrollTerm() {
  termBody.scrollTop = termBody.scrollHeight;
}


/* =============================================================================
   TOAST
============================================================================= */
function showToast(msg, type = 'success') {
  toastEl.textContent   = msg;
  toastEl.className     = `toast ${type} visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('visible'); }, 3500);
}


/* =============================================================================
   BOOKS
============================================================================= */

/** Fetch the full library inventory and render it */
async function fetchBooks() {
  // Keep skeleton cards visible while loading
  const spinner = addSpinner();

  try {
    const res  = await fetch('/api/books');
    const json = await res.json();
    spinner.remove();

    addTerminalEntry({
      method:   'GET',
      endpoint: '/api/books',
      label:    'Load Library Inventory',
      query:    json.executed_query,
      status:   json.success ? 'ok' : 'err',
      rowCount: json.row_count,
      error:    json.error,
    });

    if (json.success) {
      allBooks = json.data;
      renderBooks(allBooks);
      updateStats(allBooks);
    } else {
      booksList.innerHTML = `<div class="empty-state">Failed to load books: ${esc(json.error)}</div>`;
    }
  } catch (err) {
    spinner.remove();
    addTerminalEntry({
      method: 'GET', endpoint: '/api/books', label: 'Load Library Inventory',
      query:  '-- Network error — is the server running?',
      status: 'err', error: err.message,
    });
    booksList.innerHTML = `<div class="empty-state">Cannot reach server. Is Node running?</div>`;
  }
}

/** Render a list of book objects into .books-list */
function renderBooks(books) {
  if (!books.length) {
    booksList.innerHTML = '<div class="empty-state">No books match your search.</div>';
    return;
  }

  booksList.innerHTML = books.map((book, i) => {
    const color     = SPINE_COLORS[book.book_id % SPINE_COLORS.length];
    const initial   = book.title.charAt(0).toUpperCase();
    const available = book.available_copies > 0;

    return `
      <div class="book-card" data-id="${book.book_id}">
        <div class="book-spine" style="background:${color}"></div>
        <div class="book-thumb" style="background:linear-gradient(145deg,${color}cc,${color})">
          ${initial}
        </div>
        <div class="book-info">
          <div class="book-title" title="${esc(book.title)}">${esc(book.title)}</div>
          <div class="book-author">${esc(book.authors || 'Unknown Author')}</div>
          <div class="book-badges">
            <span class="badge badge-genre">${esc(book.genre)}</span>
            <span class="badge badge-year">${book.published_year}</span>
          </div>
        </div>
        <div class="book-actions">
          <div class="avail-label ${available ? 'available' : 'unavailable'}">
            ${available ? 'Available' : 'Checked Out'}
            <span class="avail-count">(${book.available_copies}/${book.total_copies})</span>
          </div>
          <button
            class="borrow-btn ${!available ? 'return-mode' : ''}"
            onclick="${available ? `borrowBook(${book.book_id}, this)` : `returnBook(${book.book_id}, this)`}"
            aria-label="${available ? 'Borrow' : 'Return'} ${esc(book.title)}"
          >
            ${available ? 'Borrow' : 'Return'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/** Update the header stat chips */
function updateStats(books) {
  const titles    = books.length;
  const totalAvail = books.reduce((acc, b) => acc + (b.available_copies || 0), 0);
  const totalBooks = books.reduce((acc, b) => acc + (b.total_copies || 0), 0);

  statTitles.textContent = titles;
  statAvail.textContent  = totalAvail;
  statOut.textContent    = totalBooks - totalAvail;
}


/* =============================================================================
   BORROW
============================================================================= */

/** Called when user clicks a Borrow button */
async function borrowBook(bookId, btn) {
  if (!selectedMember) {
    showToast('Select an active member first!', 'error');
    return;
  }

  // Optimistically disable button
  btn.disabled    = true;
  btn.textContent = 'Processing…';
  btn.classList.add('loading');

  const spinner = addSpinner();

  try {
    const res  = await fetch('/api/borrow', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ book_id: bookId, member_id: selectedMember.member_id }),
    });
    const json = await res.json();
    spinner.remove();

    addTerminalEntry({
      method:   'POST',
      endpoint: '/api/borrow',
      label:    json.message || 'Checkout Transaction',
      query:    json.executed_query,
      status:   json.success ? 'ok' : 'err',
      error:    json.error,
    });

    if (json.success) {
      showToast(`${json.message}`, 'success');
      // Refresh book list to reflect updated available_copies
      await fetchBooks();
    } else {
      showToast(`${json.error}`, 'error');
      btn.disabled    = false;
      btn.textContent = 'Borrow';
      btn.classList.remove('loading');
    }
  } catch (err) {
    spinner.remove();
    addTerminalEntry({
      method: 'POST', endpoint: '/api/borrow', label: 'Checkout Transaction',
      query:  '-- Network error',
      status: 'err', error: err.message,
    });
    showToast('Network error — check the server.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Borrow';
    btn.classList.remove('loading');
  }
}

/** Called when user clicks a Return button */
async function returnBook(bookId, btn) {
  if (!selectedMember) {
    showToast('Select a member to process return!', 'error');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Returning…';
  btn.classList.add('loading');

  const spinner = addSpinner();

  try {
    const res  = await fetch('/api/return', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ book_id: bookId, member_id: selectedMember.member_id }),
    });
    const json = await res.json();
    spinner.remove();

    addTerminalEntry({
      method:   'POST',
      endpoint: '/api/return',
      label:    json.message || 'Checkin Transaction',
      query:    json.executed_query,
      status:   json.success ? 'ok' : 'err',
      error:    json.error,
    });

    if (json.success) {
      showToast(`${json.message}`, 'success');
      await fetchBooks();
    } else {
      showToast(`${json.error}`, 'error');
      btn.disabled    = false;
      btn.textContent = 'Return';
      btn.classList.remove('loading');
    }
  } catch (err) {
    spinner.remove();
    addTerminalEntry({
      method: 'POST', endpoint: '/api/return', label: 'Checkin Transaction',
      query:  '-- Network error',
      status: 'err', error: err.message,
    });
    showToast('Network error — check connection.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Return';
    btn.classList.remove('loading');
  }
}


/* =============================================================================
   MEMBERS
============================================================================= */

async function fetchMembers() {
  try {
    const res  = await fetch('/api/members');
    const json = await res.json();

    if (json.success) {
      memberSelect.innerHTML =
        '<option value="">— Select a member —</option>' +
        json.data.map(m => {
          const disabled = m.membership_status !== 'active';
          return `<option value="${m.member_id}" data-name="${esc(m.full_name)}" ${disabled ? 'disabled' : ''}>
            ${esc(m.full_name)}${disabled ? ` [${m.membership_status}]` : ''}
          </option>`;
        }).join('');

      addTerminalEntry({
        method:   'GET',
        endpoint: '/api/members',
        label:    'Load Member Roster',
        query:    json.executed_query,
        status:   'ok',
        rowCount: json.row_count,
      });
    }
  } catch (err) {
    memberSelect.innerHTML = '<option value="">Failed to load members</option>';
  }
}

memberSelect.addEventListener('change', () => {
  const opt = memberSelect.selectedOptions[0];
  if (opt && opt.value) {
    selectedMember = { member_id: opt.value, full_name: opt.dataset.name };
  } else {
    selectedMember = null;
  }
});


/* =============================================================================
   REPORTS
============================================================================= */

async function runReport(type, pillEl) {
  // Update pill active state
  document.querySelectorAll('.report-pill').forEach(p => p.classList.remove('active'));
  pillEl.classList.add('active');

  const statusEl = document.getElementById('report-status');
  const outputEl = document.getElementById('report-output');

  statusEl.textContent = 'Running query…';
  outputEl.innerHTML   = '';

  const spinner = addSpinner();

  try {
    const res  = await fetch(`/api/reports?type=${type}`);
    const json = await res.json();
    spinner.remove();

    addTerminalEntry({
      method:   'GET',
      endpoint: `/api/reports?type=${type}`,
      label:    json.report || 'Advanced Report',
      query:    json.executed_query,
      status:   json.success ? 'ok' : 'err',
      rowCount: json.row_count,
      error:    json.error,
    });

    if (json.success && json.data.length > 0) {
      statusEl.textContent = `${json.report} — ${json.row_count} rows returned`;
      outputEl.innerHTML   = buildReportTable(json.data);
    } else if (json.success) {
      statusEl.textContent = `${json.report} — No data`;
      outputEl.innerHTML   = '<div class="empty-state">No data returned for this report.</div>';
    } else {
      statusEl.textContent = 'Query failed.';
      outputEl.innerHTML   = `<div class="empty-state" style="color:#dc2626">${esc(json.error)}</div>`;
    }
  } catch (err) {
    spinner.remove();
    statusEl.textContent = 'Network error.';
  }
}

/** Build an HTML table from an array of row objects */
function buildReportTable(rows) {
  const cols = Object.keys(rows[0]);
  const head = cols.map(c =>
    `<th>${c.replace(/_/g, ' ')}</th>`
  ).join('');

  const formatDate = (val) => {
    // Detect ISO string (contains T and ends with Z or matches date pattern)
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d)) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return val ?? '—';
  };

  const body = rows.map(row =>
    `<tr>${cols.map(c => `<td>${formatDate(row[c])}</td>`).join('')}</tr>`
  ).join('');

  return `
    <table class="report-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}


/* =============================================================================
   TABS
============================================================================= */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.remove('active');
      p.hidden = true;
    });

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const pane = document.getElementById(`tab-${btn.dataset.tab}`);
    pane.classList.add('active');
    pane.hidden = false;

    if (btn.dataset.tab === 'capstone') {
      document.querySelector('.app-grid').classList.add('capstone-active');
      if (window.Prism) Prism.highlightAllUnder(pane);
    } else {
      document.querySelector('.app-grid').classList.remove('capstone-active');
    }
  });
});


/* =============================================================================
   SEARCH  (client-side filter — no extra network call)
============================================================================= */

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    renderBooks(allBooks);
    return;
  }
  const filtered = allBooks.filter(b =>
    b.title.toLowerCase().includes(q)  ||
    (b.authors || '').toLowerCase().includes(q) ||
    (b.genre || '').toLowerCase().includes(q)
  );
  renderBooks(filtered);
});


/* =============================================================================
   REPORT PILLS
============================================================================= */

document.querySelectorAll('.report-pill').forEach(pill => {
  pill.addEventListener('click', () => runReport(pill.dataset.type, pill));
});


/* =============================================================================
   CLEAR TERMINAL
============================================================================= */

document.getElementById('clear-terminal').addEventListener('click', () => {
  termBody.innerHTML = `
    <div class="term-welcome" id="term-welcome">
      <span class="term-prompt">postgres=#</span>
      <span class="term-comment"> -- Library Management Dashboard</span><br/>
      <span class="term-prompt">postgres=#</span>
      <span class="term-comment"> -- PostgreSQL Live Query Terminal v1.0</span><br/>
      <span class="term-prompt">postgres=#</span>
      <span class="term-comment"> -- Terminal cleared. Interact with the UI to see new queries.</span><br/>
      <br/>
      <span class="term-cursor" aria-hidden="true">█</span>
    </div>`;
});


/* =============================================================================
   BOOT SEQUENCE
============================================================================= */

(async () => {
  // Load members first (populates selector), then books
  await fetchMembers();
  await fetchBooks();
})();
