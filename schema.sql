-- =============================================================================
--  LIBRARY MANAGEMENT SYSTEM — PostgreSQL Schema
--  Capstone Project | Phase 1: DDL + DML + Advanced Queries
-- =============================================================================


-- =============================================================================
--  SECTION 1: TEARDOWN (safe re-runs)
-- =============================================================================
DROP TABLE IF EXISTS fines             CASCADE;
DROP TABLE IF EXISTS borrowing_records CASCADE;
DROP TABLE IF EXISTS book_authors      CASCADE;
DROP TABLE IF EXISTS books             CASCADE;
DROP TABLE IF EXISTS authors           CASCADE;
DROP TABLE IF EXISTS members           CASCADE;


-- =============================================================================
--  SECTION 2: DDL — TABLE DEFINITIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AUTHORS
-- -----------------------------------------------------------------------------
CREATE TABLE authors (
    author_id   SERIAL          PRIMARY KEY,
    first_name  VARCHAR(100)    NOT NULL,
    last_name   VARCHAR(100)    NOT NULL,
    nationality VARCHAR(100),
    birth_year  INT             CHECK (birth_year BETWEEN 1000 AND 2025)
);

-- -----------------------------------------------------------------------------
-- BOOKS
-- -----------------------------------------------------------------------------
CREATE TABLE books (
    book_id          SERIAL         PRIMARY KEY,
    title            VARCHAR(255)   NOT NULL,
    isbn             VARCHAR(20)    NOT NULL UNIQUE,
    published_year   INT            NOT NULL CHECK (published_year BETWEEN 1000 AND 2025),
    genre            VARCHAR(100)   NOT NULL,
    total_copies     INT            NOT NULL DEFAULT 1 CHECK (total_copies     >= 1),
    available_copies INT            NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
    CONSTRAINT copies_cannot_exceed_total CHECK (available_copies <= total_copies)
);

-- -----------------------------------------------------------------------------
-- BOOK_AUTHORS  (junction — many-to-many)
-- -----------------------------------------------------------------------------
CREATE TABLE book_authors (
    book_id   INT NOT NULL REFERENCES books   (book_id)   ON DELETE CASCADE,
    author_id INT NOT NULL REFERENCES authors (author_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

-- -----------------------------------------------------------------------------
-- MEMBERS
-- -----------------------------------------------------------------------------
CREATE TABLE members (
    member_id         SERIAL       PRIMARY KEY,
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    phone             VARCHAR(20),
    membership_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
    membership_status VARCHAR(20)  NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('active', 'suspended', 'expired'))
);

-- -----------------------------------------------------------------------------
-- BORROWING_RECORDS
-- -----------------------------------------------------------------------------
CREATE TABLE borrowing_records (
    record_id   SERIAL      PRIMARY KEY,
    book_id     INT         NOT NULL REFERENCES books   (book_id)   ON DELETE RESTRICT,
    member_id   INT         NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
    borrow_date DATE        NOT NULL DEFAULT CURRENT_DATE,
    due_date    DATE        NOT NULL,
    return_date DATE,
    status      VARCHAR(20) NOT NULL DEFAULT 'borrowed'
        CHECK (status IN ('borrowed', 'returned', 'overdue')),
    CONSTRAINT due_after_borrow    CHECK (due_date    >= borrow_date),
    CONSTRAINT return_after_borrow CHECK (return_date IS NULL OR return_date >= borrow_date)
);

-- -----------------------------------------------------------------------------
-- FINES
-- -----------------------------------------------------------------------------
CREATE TABLE fines (
    fine_id     SERIAL         PRIMARY KEY,
    record_id   INT            NOT NULL REFERENCES borrowing_records (record_id) ON DELETE CASCADE,
    member_id   INT            NOT NULL REFERENCES members           (member_id) ON DELETE CASCADE,
    amount      NUMERIC(10,2)  NOT NULL CHECK (amount >= 0),
    paid        BOOLEAN        NOT NULL DEFAULT FALSE,
    issued_date DATE           NOT NULL DEFAULT CURRENT_DATE,
    paid_date   DATE,
    CONSTRAINT paid_date_after_issued CHECK (paid_date IS NULL OR paid_date >= issued_date)
);


-- =============================================================================
--  SECTION 3: DML — SAMPLE DATA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AUTHORS  (10 rows)
-- -----------------------------------------------------------------------------
INSERT INTO authors (first_name, last_name, nationality, birth_year) VALUES
    ('George',    'Orwell',           'British',    1903),
    ('J.K.',      'Rowling',          'British',    1965),
    ('Frank',     'Herbert',          'American',   1920),
    ('Agatha',    'Christie',         'British',    1890),
    ('Gabriel',   'García Márquez',   'Colombian',  1927),
    ('Toni',      'Morrison',         'American',   1931),
    ('Stephen',   'King',             'American',   1947),
    ('Ursula K.', 'Le Guin',          'American',   1929),
    ('Isaac',     'Asimov',           'American',   1920),
    ('Margaret',  'Atwood',           'Canadian',   1939);

-- -----------------------------------------------------------------------------
-- BOOKS  (12 rows — available_copies reflects the active borrows below)
-- -----------------------------------------------------------------------------
INSERT INTO books (title, isbn, published_year, genre, total_copies, available_copies) VALUES
    ('1984',                                    '978-0451524935', 1949, 'Dystopian Fiction',  3, 2),
    ('Animal Farm',                             '978-0451526342', 1945, 'Political Satire',   2, 2),
    ('Harry Potter and the Philosopher''s Stone','978-0439708180', 1997, 'Fantasy',            4, 3),
    ('Dune',                                    '978-0441013593', 1965, 'Science Fiction',    3, 2),
    ('Murder on the Orient Express',            '978-0062073501', 1934, 'Mystery',            2, 2),
    ('One Hundred Years of Solitude',           '978-0060883287', 1967, 'Magical Realism',   2, 1),
    ('Beloved',                                 '978-1400033416', 1987, 'Historical Fiction', 2, 2),
    ('The Shining',                             '978-0307743657', 1977, 'Horror',             2, 1),
    ('The Left Hand of Darkness',               '978-0441478125', 1969, 'Science Fiction',   2, 2),
    ('Foundation',                              '978-0553293357', 1951, 'Science Fiction',   3, 2),
    ('The Handmaid''s Tale',                    '978-0385490818', 1985, 'Dystopian Fiction', 3, 2),
    ('It',                                      '978-1501142970', 1986, 'Horror',             2, 1);

-- -----------------------------------------------------------------------------
-- BOOK_AUTHORS  (junction rows)
-- -----------------------------------------------------------------------------
INSERT INTO book_authors (book_id, author_id) VALUES
    (1,  1),   -- 1984                         → Orwell
    (2,  1),   -- Animal Farm                  → Orwell
    (3,  2),   -- Harry Potter                 → Rowling
    (4,  3),   -- Dune                         → Herbert
    (5,  4),   -- Murder on the Orient Express → Christie
    (6,  5),   -- One Hundred Years            → García Márquez
    (7,  6),   -- Beloved                      → Morrison
    (8,  7),   -- The Shining                  → King
    (9,  8),   -- The Left Hand of Darkness    → Le Guin
    (10, 9),   -- Foundation                   → Asimov
    (11, 10),  -- The Handmaid's Tale          → Atwood
    (12, 7);   -- It                           → King

-- -----------------------------------------------------------------------------
-- MEMBERS  (10 rows — Grace is suspended)
-- -----------------------------------------------------------------------------
INSERT INTO members (first_name, last_name, email, phone, membership_date, membership_status) VALUES
    ('Alice',  'Santos',    'alice.santos@email.com',   '09171234561', '2024-01-15', 'active'),
    ('Ben',    'Reyes',     'ben.reyes@email.com',      '09171234562', '2024-02-20', 'active'),
    ('Clara',  'Mendoza',   'clara.mendoza@email.com',  '09171234563', '2024-03-10', 'active'),
    ('David',  'Cruz',      'david.cruz@email.com',     '09171234564', '2024-04-05', 'active'),
    ('Eva',    'Torres',    'eva.torres@email.com',     '09171234565', '2024-05-12', 'active'),
    ('Felix',  'Garcia',    'felix.garcia@email.com',   '09171234566', '2024-06-18', 'active'),
    ('Grace',  'Lim',       'grace.lim@email.com',      '09171234567', '2024-07-22', 'suspended'),
    ('Henry',  'Tan',       'henry.tan@email.com',      '09171234568', '2024-08-30', 'active'),
    ('Iris',   'Villanueva','iris.v@email.com',          '09171234569', '2024-09-14', 'active'),
    ('Jake',   'Navarro',   'jake.navarro@email.com',   '09171234570', '2024-10-01', 'active');

-- -----------------------------------------------------------------------------
-- BORROWING_RECORDS  (13 rows)
--   Records 1–5  : returned (clean history)
--   Records 6–10 : OVERDUE  (no return_date, due_date in the past)
--   Records 11–13: active / on-loan (due in the future)
-- -----------------------------------------------------------------------------
INSERT INTO borrowing_records (book_id, member_id, borrow_date, due_date, return_date, status) VALUES
    -- ── Returned ──
    (1,  1, '2026-01-10', '2026-01-24', '2026-01-22', 'returned'),  -- #1  Alice   / 1984
    (3,  2, '2026-01-15', '2026-01-29', '2026-01-28', 'returned'),  -- #2  Ben     / Harry Potter
    (5,  3, '2026-01-20', '2026-02-03', '2026-02-01', 'returned'),  -- #3  Clara   / Murder on Orient
    (2,  4, '2026-02-01', '2026-02-15', '2026-02-14', 'returned'),  -- #4  David   / Animal Farm
    (10, 5, '2026-02-05', '2026-02-19', '2026-02-18', 'returned'),  -- #5  Eva     / Foundation
    -- ── Overdue ──
    (1,  2, '2026-02-10', '2026-02-24', NULL,          'overdue'),   -- #6  Ben     / 1984            (37 days late)
    (6,  3, '2026-02-15', '2026-03-01', NULL,          'overdue'),   -- #7  Clara   / 100 Yrs Solitude(32 days late)
    (8,  7, '2026-02-20', '2026-03-06', NULL,          'overdue'),   -- #8  Grace   / The Shining     (27 days late)
    (11, 1, '2026-02-25', '2026-03-11', NULL,          'overdue'),   -- #9  Alice   / Handmaid's Tale (22 days late)
    (4,  8, '2026-03-01', '2026-03-15', NULL,          'overdue'),   -- #10 Henry   / Dune            (18 days late)
    -- ── Active / On-Loan ──
    (3,  6, '2026-03-20', '2026-04-10', NULL,          'borrowed'),  -- #11 Felix   / Harry Potter
    (10, 9, '2026-03-22', '2026-04-12', NULL,          'borrowed'),  -- #12 Iris    / Foundation
    (12, 10,'2026-03-25', '2026-04-15', NULL,          'borrowed');  -- #13 Jake    / It

-- -----------------------------------------------------------------------------
-- FINES  (5 rows — one paid, four outstanding)
--   Fine rate: ₱1.50 / day overdue  (calculated as of 2026-04-02)
-- -----------------------------------------------------------------------------
INSERT INTO fines (record_id, member_id, amount, paid, issued_date, paid_date) VALUES
    (6,  2, 55.50, FALSE, '2026-02-25', NULL),          -- Ben   / 1984            — 37 d × ₱1.50
    (7,  3, 48.00, FALSE, '2026-03-02', NULL),          -- Clara / 100 Yrs Solitude— 32 d × ₱1.50
    (8,  7, 40.50, TRUE,  '2026-03-07', '2026-03-20'),  -- Grace / The Shining     — 27 d × ₱1.50 (PAID)
    (9,  1, 33.00, FALSE, '2026-03-12', NULL),          -- Alice / Handmaid's Tale — 22 d × ₱1.50
    (10, 8, 27.00, FALSE, '2026-03-16', NULL);          -- Henry / Dune            — 18 d × ₱1.50


-- =============================================================================
--  SECTION 4: ADVANCED QUERIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Query A — Book Popularity Ranking
-- Technique: CTE  +  RANK() and DENSE_RANK() window functions
-- Shows total borrow count per book, ranked globally and within genre.
-- -----------------------------------------------------------------------------
WITH borrow_stats AS (
    SELECT
        b.book_id,
        b.title,
        b.genre,
        COUNT(br.record_id)                                          AS total_borrows,
        COUNT(CASE WHEN br.status != 'returned' THEN 1 END)         AS active_borrows
    FROM  books b
    LEFT JOIN borrowing_records br ON b.book_id = br.book_id
    GROUP BY b.book_id, b.title, b.genre
)
SELECT
    title,
    genre,
    total_borrows,
    active_borrows,
    RANK()       OVER (ORDER BY total_borrows DESC)                  AS popularity_rank,
    DENSE_RANK() OVER (PARTITION BY genre ORDER BY total_borrows DESC) AS genre_rank
FROM  borrow_stats
ORDER BY popularity_rank, genre;


-- -----------------------------------------------------------------------------
-- Query B — Member Fine Ledger
-- Technique: Two CTEs chained together  +  RANK() window function
-- Breaks down each member's borrowing activity and unpaid fine balance,
-- then ranks them by outstanding debt (highest → lowest).
-- -----------------------------------------------------------------------------
WITH member_activity AS (
    SELECT
        m.member_id,
        m.first_name || ' ' || m.last_name                          AS member_name,
        m.membership_status,
        COUNT(br.record_id)                                          AS total_borrows,
        COUNT(CASE WHEN br.status = 'overdue' THEN 1 END)           AS overdue_count
    FROM  members m
    LEFT JOIN borrowing_records br ON m.member_id = br.member_id
    GROUP BY m.member_id, member_name, m.membership_status
),
fine_summary AS (
    SELECT
        m.member_id,
        COALESCE(SUM(f.amount),                                   0) AS total_fines,
        COALESCE(SUM(CASE WHEN NOT f.paid THEN f.amount ELSE 0 END), 0) AS unpaid_fines,
        COUNT(f.fine_id)                                             AS fine_count
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
    RANK() OVER (ORDER BY s.unpaid_fines DESC)                      AS fine_rank
FROM  member_activity a
JOIN  fine_summary    s ON a.member_id = s.member_id
ORDER BY s.unpaid_fines DESC;


-- -----------------------------------------------------------------------------
-- Query C — Overdue Deep-Dive with Running Totals
-- Technique: CTE  +  SUM() window with PARTITION + frame clause
-- Lists every overdue book, the daily fine accrued, a running total
-- per member, and the grand total across the entire library.
-- -----------------------------------------------------------------------------
WITH overdue_detail AS (
    SELECT
        m.first_name || ' ' || m.last_name                          AS member_name,
        b.title                                                      AS book_title,
        b.genre,
        br.borrow_date,
        br.due_date,
        CURRENT_DATE - br.due_date                                   AS days_overdue,
        ROUND((CURRENT_DATE - br.due_date) * 1.50, 2)               AS calculated_fine
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
    -- Running sub-total of fines for this member (ordered by most overdue first)
    SUM(calculated_fine) OVER (
        PARTITION BY member_name
        ORDER BY days_overdue DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                                                AS running_member_total,
    -- Single grand-total across all overdue records
    SUM(calculated_fine) OVER ()                                     AS grand_total_overdue
FROM  overdue_detail
ORDER BY member_name, days_overdue DESC;
