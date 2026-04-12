// =============================================================================
//  LIBRARY MANAGEMENT SYSTEM — Backend (Node.js / Express)
//  Capstone Project | Phase 2: server.js
//  Every endpoint returns: { success, data, executed_query, ... }
// =============================================================================

require('dotenv').config();
const express = require('express');
const { Pool }  = require('pg');
const path      = require('path');

const app  = express();
app.use(express.static(__dirname));
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public'))); // Redundant: everything is in root

// ─── PostgreSQL Connection Pool ───────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'library_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 10,                   // max pool size
  idleTimeoutMillis: 30000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('  Database connection failed:', err.message);
    console.error('    Check your .env values and that PostgreSQL is running.');
  } else {
    console.log('  Connected to PostgreSQL —', process.env.DB_NAME || 'library_db');
    release();
  }
});

// ─── Helper: build a "display" query string with values interpolated ──────────
// Used only for the terminal display — actual execution always uses $1,$2,... 
function interpolate(sql, params = []) {
  return params.reduce((q, val, i) => {
    const escaped = typeof val === 'string' ? `'${val}'` : val;
    return q.replace(`$${i + 1}`, escaped);
  }, sql);
}


// =============================================================================
//  ENDPOINT 1  —  GET /api/books
//  Fetches all books with author names (aggregated) and availability info.
// =============================================================================
app.get('/api/books', async (req, res) => {
  const sql = `
    SELECT
        b.book_id,
        b.title,
        b.isbn,
        b.published_year,
        b.genre,
        b.total_copies,
        b.available_copies,
        STRING_AGG(
            a.first_name || ' ' || a.last_name,
            ', '
            ORDER BY a.last_name
        ) AS authors
    FROM  books b
    LEFT JOIN book_authors ba ON b.book_id   = ba.book_id
    LEFT JOIN authors      a  ON ba.author_id = a.author_id
    GROUP BY
        b.book_id, b.title, b.isbn,
        b.published_year, b.genre,
        b.total_copies,   b.available_copies
    ORDER BY b.title;`.trim();

  try {
    const result = await pool.query(sql);
    return res.json({
      success:        true,
      data:           result.rows,
      executed_query: sql,
      row_count:      result.rowCount,
    });
  } catch (err) {
    return res.status(500).json({
      success:        false,
      error:          err.message,
      executed_query: sql,
    });
  }
});


// =============================================================================
//  ENDPOINT 2  —  GET /api/members
//  Returns all members for the member selector in the UI.
// =============================================================================
app.get('/api/members', async (req, res) => {
  const sql = `
    SELECT
        member_id,
        first_name || ' ' || last_name AS full_name,
        email,
        membership_status,
        TO_CHAR(membership_date, 'Mon DD, YYYY') AS member_since
    FROM  members
    ORDER BY last_name, first_name;`.trim();

  try {
    const result = await pool.query(sql);
    return res.json({
      success:        true,
      data:           result.rows,
      executed_query: sql,
      row_count:      result.rowCount,
    });
  } catch (err) {
    return res.status(500).json({
      success:        false,
      error:          err.message,
      executed_query: sql,
    });
  }
});


// =============================================================================
//  ENDPOINT 3  —  POST /api/borrow
//  Checks out a book for a member inside an atomic transaction.
//
//  Body: { book_id: number, member_id: number }
//
//  Steps (all or nothing):
//    1. SELECT … FOR UPDATE  — lock the row, verify availability
//    2. INSERT borrowing_record
//    3. UPDATE books.available_copies  -=  1
// =============================================================================
app.post('/api/borrow', async (req, res) => {
  const { book_id, member_id } = req.body;

  if (!book_id || !member_id) {
    return res.status(400).json({
      success: false,
      error:   'Both book_id and member_id are required.',
      executed_query: '-- Aborted: missing required fields.',
    });
  }

  // Build the display strings for each step (shown in the terminal)
  const step1_display = `-- Step 1: Lock row & verify availability
SELECT title, available_copies
FROM   books
WHERE  book_id = ${book_id}
FOR UPDATE;`;

  const step2_display = `-- Step 2: Create borrowing record (14-day loan period)
INSERT INTO borrowing_records
    (book_id, member_id, borrow_date, due_date, status)
VALUES
    (${book_id}, ${member_id}, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'borrowed')
RETURNING *;`;

  const step3_display = `-- Step 3: Decrement available copies
UPDATE books
SET    available_copies = available_copies - 1
WHERE  book_id = ${book_id}
RETURNING book_id, title, available_copies;`;

  const fullDisplayQuery =
    `BEGIN;\n\n${step1_display}\n\n${step2_display}\n\n${step3_display}\n\nCOMMIT;`;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // ── Step 1: check availability ──────────────────────────────────────────
    const checkResult = await client.query(
      'SELECT title, available_copies FROM books WHERE book_id = $1 FOR UPDATE',
      [book_id]
    );
    if (checkResult.rows.length === 0) throw new Error(`Book ID ${book_id} not found.`);
    const book = checkResult.rows[0];
    if (book.available_copies <= 0) {
      throw new Error(`"${book.title}" has no copies available right now.`);
    }

    // ── Step 2: insert borrowing record ────────────────────────────────────
    const insertResult = await client.query(
      `INSERT INTO borrowing_records
           (book_id, member_id, borrow_date, due_date, status)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'borrowed')
       RETURNING *`,
      [book_id, member_id]
    );

    // ── Step 3: decrement available copies ────────────────────────────────
    const updateResult = await client.query(
      `UPDATE books
       SET    available_copies = available_copies - 1
       WHERE  book_id = $1
       RETURNING book_id, title, available_copies`,
      [book_id]
    );

    await client.query('COMMIT');

    return res.json({
      success:        true,
      message:        `"${book.title}" successfully checked out! Due in 14 days.`,
      data: {
        borrowing_record: insertResult.rows[0],
        book:             updateResult.rows[0],
      },
      executed_query: fullDisplayQuery,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({
      success:        false,
      error:          err.message,
      executed_query: `BEGIN;\n\n${step1_display}\n\n-- ROLLBACK triggered: ${err.message}\n\nROLLBACK;`,
    });
  } finally {
    if (client) client.release();
  }
});


// =============================================================================
//  ENDPOINT 4  —  GET /api/reports?type=<popularity|fines|overdue>
//  Runs one of the three advanced CTE / Window Function queries.
// =============================================================================
const REPORTS = {

  popularity: {
    label: 'Book Popularity Ranking',
    sql: `
-- Report: Book Popularity Ranking
-- Uses: CTE + RANK() + DENSE_RANK() window functions
WITH borrow_stats AS (
    SELECT
        b.book_id,
        b.title,
        b.genre,
        COUNT(br.record_id)                                       AS total_borrows,
        COUNT(CASE WHEN br.status != 'returned' THEN 1 END)       AS active_borrows
    FROM  books b
    LEFT JOIN borrowing_records br ON b.book_id = br.book_id
    GROUP BY b.book_id, b.title, b.genre
)
SELECT
    title,
    genre,
    total_borrows,
    active_borrows,
    RANK()       OVER (ORDER BY total_borrows DESC)                       AS popularity_rank,
    DENSE_RANK() OVER (PARTITION BY genre ORDER BY total_borrows DESC)    AS genre_rank
FROM  borrow_stats
ORDER BY popularity_rank, genre;`.trim(),
  },

  fines: {
    label: 'Member Fine Ledger',
    sql: `
-- Report: Member Fine Ledger
-- Uses: Two chained CTEs + RANK() window function
WITH member_activity AS (
    SELECT
        m.member_id,
        m.first_name || ' ' || m.last_name                        AS member_name,
        m.membership_status,
        COUNT(br.record_id)                                        AS total_borrows,
        COUNT(CASE WHEN br.status = 'overdue' THEN 1 END)         AS overdue_count
    FROM  members m
    LEFT JOIN borrowing_records br ON m.member_id = br.member_id
    GROUP BY m.member_id, member_name, m.membership_status
),
fine_summary AS (
    SELECT
        m.member_id,
        COALESCE(SUM(f.amount),                                 0) AS total_fines,
        COALESCE(SUM(CASE WHEN NOT f.paid THEN f.amount
                          ELSE 0 END),                          0) AS unpaid_fines,
        COUNT(f.fine_id)                                           AS fine_count
    FROM  members m
    LEFT JOIN fines f ON m.member_id = f.member_id
    GROUP BY m.member_id
)
SELECT
    a.member_name,
    a.membership_status,
    a.total_borrows,
    a.overdue_count,
    s.total_fines,
    s.unpaid_fines,
    s.fine_count,
    RANK() OVER (ORDER BY s.unpaid_fines DESC)                    AS fine_rank
FROM  member_activity a
JOIN  fine_summary    s ON a.member_id = s.member_id
ORDER BY s.unpaid_fines DESC;`.trim(),
  },

  overdue: {
    label: 'Overdue Analysis with Running Totals',
    sql: `
-- Report: Overdue Analysis with Running Totals
-- Uses: CTE + SUM() window with PARTITION BY + frame clause
WITH overdue_detail AS (
    SELECT
        m.first_name || ' ' || m.last_name                        AS member_name,
        b.title                                                    AS book_title,
        b.genre,
        br.borrow_date,
        br.due_date,
        CURRENT_DATE - br.due_date                                 AS days_overdue,
        ROUND((CURRENT_DATE - br.due_date) * 1.50, 2)             AS calculated_fine
    FROM  borrowing_records br
    JOIN  members m ON br.member_id = m.member_id
    JOIN  books   b ON br.book_id   = b.book_id
    WHERE br.return_date IS NULL
      AND br.due_date < CURRENT_DATE
)
SELECT
    member_name,
    book_title,
    genre,
    due_date,
    days_overdue,
    calculated_fine,
    SUM(calculated_fine) OVER (
        PARTITION BY member_name
        ORDER BY days_overdue DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                                              AS running_member_total,
    SUM(calculated_fine) OVER ()                                   AS grand_total_overdue
FROM  overdue_detail
ORDER BY member_name, days_overdue DESC;`.trim(),
  },
};

app.get('/api/reports', async (req, res) => {
  const type     = req.query.type || 'popularity';
  const report   = REPORTS[type];

  if (!report) {
    return res.status(400).json({
      success: false,
      error:   `Unknown report type "${type}". Valid options: ${Object.keys(REPORTS).join(', ')}`,
      executed_query: `-- Invalid report type: "${type}"`,
    });
  }

  try {
    const result = await pool.query(report.sql);
    return res.json({
      success:        true,
      report:         report.label,
      data:           result.rows,
      executed_query: report.sql,
      row_count:      result.rowCount,
    });
  } catch (err) {
    return res.status(500).json({
      success:        false,
      error:          err.message,
      executed_query: report.sql,
    });
  }
});


// =============================================================================
//  ENDPOINT 5  —  POST /api/return
//  Returns a borrowed book for a specific member.
//
//  Body: { book_id: number, member_id: number }
//
//  Steps (all or nothing):
//    1. Verify the selected member actually has this book checked out (status='borrowed')
//    2. Update borrowing_record (status='returned', return_date=CURRENT_DATE)
//    3. Update books.available_copies  +=  1
// =============================================================================
app.post('/api/return', async (req, res) => {
  const { book_id, member_id } = req.body;

  if (!book_id || !member_id) {
    return res.status(400).json({
      success: false,
      error:   'Both book_id and member_id are required.',
      executed_query: '-- Aborted: missing required fields.',
    });
  }

  // Display strings for terminal
  const step1_display = `-- Step 1: Verify member has this book checked out
SELECT record_id, b.title
FROM   borrowing_records br
JOIN   books b USING(book_id)
WHERE  br.book_id = ${book_id}
  AND  br.member_id = ${member_id}
  AND  br.status = 'borrowed'
FOR UPDATE;`;

  const step2_display = `-- Step 2: Update borrowing record to 'returned'
UPDATE borrowing_records
SET    return_date = CURRENT_DATE,
       status = 'returned'
WHERE  record_id = <record_id>
RETURNING *;`;

  const step3_display = `-- Step 3: Increment available copies
UPDATE books
SET    available_copies = available_copies + 1
WHERE  book_id = ${book_id}
RETURNING book_id, title, available_copies;`;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Verify existence of active loan for THIS member
    const checkResult = await client.query(
      `SELECT record_id, b.title
       FROM   borrowing_records br
       JOIN   books b USING(book_id)
       WHERE  br.book_id = $1
         AND  br.member_id = $2
         AND  br.status = 'borrowed'
       FOR UPDATE`,
      [book_id, member_id]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('The selected member does not currently have this book checked out.');
    }

    const { record_id, title } = checkResult.rows[0];

    // 2. Update record
    const updateRecordResult = await client.query(
      `UPDATE borrowing_records
       SET    return_date = CURRENT_DATE,
              status = 'returned'
       WHERE  record_id = $1
       RETURNING *`,
      [record_id]
    );

    // 3. Increment availability
    const updateBookResult = await client.query(
      `UPDATE books
       SET    available_copies = available_copies + 1
       WHERE  book_id = $1
       RETURNING book_id, title, available_copies`,
      [book_id]
    );

    await client.query('COMMIT');

    const fullDisplayQuery =
      `BEGIN;\n\n${step1_display}\n\n${step2_display.replace('<record_id>', record_id)}\n\n${step3_display}\n\nCOMMIT;`;

    return res.json({
      success:        true,
      message:        `"${title}" successfully returned!`,
      data: {
        borrowing_record: updateRecordResult.rows[0],
        book:             updateBookResult.rows[0],
      },
      executed_query: fullDisplayQuery,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({
      success:        false,
      error:          err.message,
      executed_query: `BEGIN;\n\n${step1_display}\n\n-- ROLLBACK triggered: ${err.message}\n\nROLLBACK;`,
    });
  } finally {
    if (client) client.release();
  }
});


// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.path} not found.` });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`  ATHENAEUM CORE → http://localhost:${PORT}`);
  console.log('='.repeat(60));
  console.log(`  Endpoints:`);
  console.log(`    [GET]  /api/books   - Fetch inventory`);
  console.log(`    [GET]  /api/members - Fetch member roster`);
  console.log(`    [POST] /api/borrow  - Process book checkout`);
  console.log(`    [POST] /api/return  - Process book check-in`);
  console.log(`    [GET]  /api/reports - Advanced analytics`);
  console.log('='.repeat(60) + '\n');
});
