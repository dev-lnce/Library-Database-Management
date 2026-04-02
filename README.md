# Live Query Library Database System

## About The Project
This project is a Full-Stack Relational Database Capstone designed to manage a library's core operations while visually demonstrating backend SQL execution in real-time. 

Instead of hiding the database logic behind a standard frontend, this application features a unique **Split-Screen Architecture**. The left panel operates as a modern, glassmorphism-styled Library UI, while the right panel acts as a Live Developer Terminal. Every time a user interacts with the UI (e.g., borrowing a book, loading inventory, generating reports), the exact PostgreSQL queries executing under the hood are instantly highlighted and displayed in the terminal.

### Key Features
* **Live SQL Terminal:** Real-time visibility into database transactions (`INSERT`, `UPDATE`, `SELECT` with complex `JOIN`s).
* **Advanced Relational Architecture:** Highly normalized database schema including junction tables (Many-to-Many relationships) and strict `CHECK` constraints.
* **Complex Data Retrieval:** Utilizes Window Functions and Common Table Expressions (CTEs) for advanced reporting (e.g., calculating overdue fines and popularity rankings).
* **Modern UI/UX:** Responsive CSS Grid layout featuring glassmorphism design principles, smooth hover states, and high-contrast Prism.js syntax highlighting.

## Tech Stack
* **Database:** PostgreSQL (with `pg` node-postgres client)
* **Backend:** Node.js, Express.js
* **Frontend:** Vanilla HTML5, CSS3, JavaScript (Fetch API)
* **Syntax Highlighting:** Prism.js (High-Contrast Theme)

## Database Schema (ERD)

The database, `library_db`, consists of the following core tables:
* `Books`: Stores inventory details (ISBN, total copies, available copies).
* `Authors` & `Book_Authors`: Junction setup allowing a single book to have multiple authors.
* `Members`: Tracks library user details and status.
* `Borrowing_Records`: Logs transactions with strict `borrow_date` and `due_date` constraints.
* `Fines`: Tracks financial penalties tied to overdue borrowing records.

## Getting Started

To run this project locally on your machine, follow these steps:

### Prerequisites
* [Node.js](https://nodejs.org/) installed
* [PostgreSQL](https://www.postgresql.org/) installed and running locally
