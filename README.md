# University Admin Panel

A dashboard backend for managing university academic records — MoUs, courses, training
participants, and sector-specific programmes — with bulk import from Excel and an
email-approval flow for new administrator accounts.

Built with Node.js, Express, MongoDB/Mongoose, and JWT authentication.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Admin Registration Flow](#admin-registration-flow)
- [Known Gaps](#known-gaps)

---

## Overview

The dashboard answers six questions about the university's training and partnership
activity, each backed by its own endpoint:

| # | Metric | What it shows |
|---|---|---|
| 1 | **No. of MoUs** | Every Memorandum of Understanding the university has signed |
| 2 | **Ongoing Courses** | Courses currently running |
| 3 | **MoU Activities under Schools** | Schools with at least one MoU; drill into a school for its MoUs |
| 4 | **Total Courses** | All completed courses |
| 5 | **Participants Trained** | Everyone who has completed or is undergoing a course |
| 6 | **Sector-Specific Programmes** | Fields such as Cybersecurity or AI; drill into a sector for its courses |

---

## Features

- **JWT-authenticated API** — every data route requires a bearer token
- **Bulk Excel import** for MoUs, participants, and courses, so existing spreadsheets can
  be loaded without re-entry
- **Email-approved admin registration** — a new admin request must be confirmed via a
  link sent by email before the account becomes active
- **Drill-down queries** — schools expand into their MoUs, sectors into their courses
- **Centralised async error handling** via an `asyncHandler` wrapper

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 4 |
| Database | MongoDB + Mongoose 7 |
| Auth | JWT, `bcrypt` |
| Email | Nodemailer |
| Excel parsing | SheetJS (`xlsx`) |
| Uploads | Multer (in-memory buffers) |

---

## Project Structure

```
├── admin_routes/
│   └── api.js              # The entire Express app: routes, auth, import handlers
├── models/
│   ├── MOU.js              # Memoranda of Understanding
│   ├── admin.js            # Active administrators
│   ├── pendingAdmin.js     # Registrations awaiting email approval
│   ├── courses.js
│   ├── fields.js           # Sectors / subject areas
│   ├── school.js
│   └── students.js         # Training participants
├── frontend/               # React client (build output only — see Known Gaps)
├── instruction             # Original project brief
└── package.json
```

---

## Getting Started

**Prerequisites:** Node.js 14+ and a running MongoDB instance.

```bash
git clone https://github.com/TrinayanMahato/sitaics_project.git
cd sitaics_project
npm install
```

Two dependencies the code uses are missing from `package.json` — install them too:

```bash
npm install multer xlsx
```

Then start the server:

```bash
npm run dev    # nodemon
npm start      # production
```

---

## Environment Variables

Create a `.env` in the project root:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/university_admin
JWT_SECRET=<a long random string>
EMAIL_USER=<smtp account address>
EMAIL_PASS=<smtp app password>
BASE_URL=http://localhost:5000
```

`BASE_URL` is used to build the approve/reject links in admin-registration emails.

---

## API Reference

All data routes require `Authorization: Bearer <token>`.

### Auth & Registration

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/login` | — | Log in, returns a JWT |
| `POST` | `/api/admin/register` | — | Request a new admin account (triggers approval email) |
| `GET` | `/api/admin/verify/yes/:pendingAdminId` | — | Approve a pending admin |
| `GET` | `/api/admin/verify/no/:pendingAdminId` | — | Reject a pending admin |

### Dashboard Queries

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/mous` | All MoUs |
| `GET` | `/api/courses/running` | Ongoing courses |
| `GET` | `/api/courses/completed` | Completed courses |
| `GET` | `/api/schools/active` | Schools holding at least one MoU |
| `GET` | `/api/schools/:schoolId` | MoUs for a given school |
| `GET` | `/api/participants` | All training participants |
| `GET` | `/api/fields` | All sectors |
| `GET` | `/api/fields/:fieldId` | Courses within a sector |

### Create

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/mous` | Add a single MoU |
| `POST` | `/api/courses` | Add a single course |
| `POST` | `/api/participants` | Add a single participant |

### Bulk Import

Each takes a `multipart/form-data` request with an `excelFile` field.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/mous/import` | Import MoUs from a spreadsheet |
| `POST` | `/api/participants/import` | Import participants from a spreadsheet |
| `POST` | `/api/courses/import` | Import courses from a spreadsheet |

---

## Admin Registration Flow

New administrators are not self-service. A registration request creates a `PendingAdmin`
record and sends an approval email containing two links. Following the `verify/yes` link
promotes the record into the `Admin` collection; `verify/no` discards it. Only then can
the account log in.

---

## Known Gaps

Worth addressing before this is used or demonstrated:

- **Missing dependencies.** `api.js` uses `upload` (Multer) on the three import routes and
  `XLSX` in their handlers, but neither is required at the top of the file nor listed in
  `package.json`. Both are needed:
  ```js
  const multer = require('multer');
  const XLSX = require('xlsx');
  const upload = multer({ storage: multer.memoryStorage() });
  ```
  Without this, any call to an `/import` route throws a `ReferenceError`.
- **The frontend is not in the repository.** `frontend/build/` contains only
  `favicon.ico`, the logos, `manifest.json`, and `robots.txt` — there is no `index.html`,
  no JS bundle, and no React source. The client needs to be committed.
- **`validator` is declared but never used** — either use it for input validation or drop it.
- **Everything lives in one file.** `admin_routes/api.js` is over 1,000 lines; splitting
  routes, controllers, and the import logic would make it far easier to work on.
- **No tests**, and the `author` field in `package.json` is still `"Your Name"`.
