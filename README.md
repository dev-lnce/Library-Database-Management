# Live Query Library Database System

## About The Project
This project is a **Full-Stack Relational Database Capstone** designed to manage a library's core operations while visually demonstrating backend SQL execution in real-time. 

Instead of hiding the database logic behind a standard frontend, this application features a unique **Split-Screen Architecture**. The left panel operates as a modern, glassmorphism-styled Library UI, while the right panel acts as a **Live SQL Terminal**. Every time a user interacts with the UI (e.g., borrowing a book, loading inventory, generating reports), the exact PostgreSQL queries executing under the hood are instantly highlighted and displayed in the terminal.

### Key Features
* **Live SQL Terminal:** Real-time visibility into database transactions (`INSERT`, `UPDATE`, `SELECT` with complex `JOIN`s).
* **Capstone Documentation Tab:** Integrated project documentation featuring the Problem Description, Entity-Relationship Diagram (ERD), and DDL/DML code blocks.
* **Advanced Relational Architecture:** Highly normalized database schema including junction tables (Many-to-Many relationships) and strict `CHECK` constraints.
* **Complex Data Retrieval:** Utilizes Window Functions and Common Table Expressions (CTEs) for advanced reporting (e.g., calculating overdue fines and popularity rankings).
* **Modern UI/UX:** Responsive CSS Grid layout featuring glassmorphism design principles, smooth hover states, and high-contrast Prism.js syntax highlighting.

## Tech Stack
* **Database:** PostgreSQL (with `pg` node-postgres client)
* **Backend:** Node.js, Express.js
* **Frontend:** Vanilla HTML5, CSS3 (Grid/Flexbox), JavaScript (Fetch API)
* **Design:** Google Fonts (Syne, DM Sans, JetBrains Mono)
* **Syntax Highlighting:** Prism.js (One Dark Theme)

## Database Schema (ERD)
The database, `library_db`, consists of the following core tables:
* `Books`: Stores inventory details (ISBN, total copies, available copies).
* `Authors` & `Book_Authors`: Junction setup allowing a single book to have multiple authors.
* `Members`: Tracks library user details and membership status.
* `Borrowing_Records`: Logs transactions with strict `borrow_date` and `due_date` constraints.
* `Fines`: Tracks financial penalties (₱1.50/day) tied to overdue borrowing records.

## Getting Started

To run this project locally, follow these steps:

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* [PostgreSQL](https://www.postgresql.org/) installed and running locally

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/library-database-management.git
   cd library-database-management
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and add your PostgreSQL credentials:
   ```env
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=library_db
   PORT=3000
   ```

4. **Database Initialization:**
   Run the following command in your terminal (or import `schema.sql` via pgAdmin/psql):
   ```bash
   psql -U your_username -d library_db -f schema.sql
   ```

### Running the App

Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Author
**Lance Derick De Villa**

---
*Developed as a Database Management Systems Capstone Project.*
