# University Admin Panel

A dashboard backend for managing university academic records — MoUs, courses, training
participants, and sector-specific programmes — with bulk import from Excel and an
email-approval flow for new administrator accounts.

Built with Node.js, Express, MongoDB/Mongoose, and JWT authentication.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Admin Registration Flow](#admin-registration-flow)

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

## Architecture

A single Express service backing a dashboard. Every read is a scoped query behind JWT
auth, and every write arrives either as one record or as a spreadsheet.

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD        six metric views, each drilling down       │
└──────────────────────────┬──────────────────────────────────┘
                           │  Bearer <jwt>
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  admin_routes/api.js                                        │
│                                                             │
│   authenticateToken ──► asyncHandler ──► route handler      │
│         (JWT)            (error trap)                       │
│                                                             │
│   upload.single('excelFile') ──► XLSX parse ──► bulk insert │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  models/   MOU · courses · fields · school · students        │
│            admin · pendingAdmin                              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
                        MongoDB
```

### The domain model

The six dashboard views are not six unrelated queries — they are projections of one small
graph of entities:

```
   School ──┬──< MOU
            │
   Field ───┴──< Course ──< Student (participant)
```

- A **School** signs **MoUs**; `/api/schools/active` lists only schools with at least one,
  and `/api/schools/:schoolId` drills into that school's agreements.
- A **Field** (sector such as Cybersecurity or AI) groups **Courses**;
  `/api/fields/:fieldId` drills into the courses taught in that sector.
- A **Course** is either running or completed, which is the only difference between
  `/api/courses/running` and `/api/courses/completed`.
- **Students** are participants attached to courses.

Every "drill-down" in the UI is therefore one parent list endpoint plus one child endpoint
keyed by the parent's id — a consistent pattern rather than bespoke queries per view.

### Bulk import

Three endpoints accept a spreadsheet instead of JSON, because the source data already
exists as departmental Excel files:

```
multipart/form-data
  excelFile
      │
      ▼
 multer (memoryStorage)      file held in RAM, never written to disk
      │
      ▼
 XLSX.read(buffer)           sheet → rows
      │
      ▼
 XLSX.utils.sheet_to_json    rows → objects   (raw:false, so dates arrive formatted)
      │
      ▼
 validate + insert           per-row, so one bad row does not void the batch
```

Keeping the upload in memory rather than on disk is deliberate: these files are small, are
consumed immediately, and nothing should persist once the rows are in Mongo.

### Administrator approval

Registration is not self-service. A request creates a `PendingAdmin`, and an email carries
two signed links — approve or reject. Only approval promotes the record into the `Admin`
collection, and only then can the account authenticate.

```
POST /api/admin/register
      │
      ▼
 ┌──────────────┐   email with two links
 │ PendingAdmin │ ──────┬────────────────┐
 └──────────────┘       │                │
                 verify/yes/:id    verify/no/:id
                        │                │
                        ▼                ▼
                   ┌───────┐         discarded
                   │ Admin │ ──► may log in
                   └───────┘
```

This means possession of the registration form is not enough to gain access — an existing
administrator has to act before the account exists at all.

### Error handling

Every route is wrapped in `asyncHandler`, so a rejected promise inside any handler is
forwarded to Express's error path instead of surfacing as an unhandled rejection. Handlers
are written as if failure simply throws.

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
├── frontend/               # React dashboard client
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
