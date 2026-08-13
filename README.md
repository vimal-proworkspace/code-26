# Coding Event Platform 2026

A robust, real-time platform for hosting multi-round competitive coding events, quizzes, debugging hunts, and programming challenges.

---

## Architecture Overview

```
Frontend (React + Vite + TypeScript)
    ↓  HTTP (credentials: include) / Socket.IO
Backend (Node.js + Express + TypeScript + Socket.IO)
    ↓  Direct parameterized SQL via node-postgres (pg)
PostgreSQL Database (Supabase / Managed Postgres)
```

- **Frontend**: Single Page Application with real-time Socket.IO synchronization, responsive dark UI, and anti-cheating tab/fullscreen monitoring.
- **Backend**: Express REST API + Socket.IO server utilizing direct parameterized SQL queries (`pg`) connected to Supabase PostgreSQL.
- **Database Layer**: Clean, high-performance `pg` connection pool with SSL support, transactions, and parametrized safety.

---

## Repository Structure

```text
coding-event-platform/
├── frontend/             # React 18 + Vite + TypeScript single-page app
│   ├── src/
│   │   ├── components/  # Modals, navigation, protected routes, tabs
│   │   ├── context/     # AuthContext & SocketContext state providers
│   │   ├── hooks/       # Custom hooks (useAuth, useAntiCheating)
│   │   ├── pages/       # Student & Admin dashboards, login, register
│   │   ├── services/    # Typed REST API & Socket.IO client services
│   │   └── types/       # TypeScript contract interfaces
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/              # Express + TypeScript + Socket.IO server
│   ├── src/
│   │   ├── config/      # DB pool (`db.ts`), env validation (`env.ts`), types (`types.ts`)
│   │   ├── controllers/ # REST endpoint controllers
│   │   ├── middleware/  # JWT auth, role validation, centralized error handling
│   │   ├── routes/      # API router declarations
│   │   ├── services/    # Business logic & native multi-language code execution
│   │   ├── socket/      # Real-time event handlers & background deadline checker
│   │   ├── scripts/     # Database seed script (`seed.ts`)
│   │   └── tests/       # Integration & load verification test suite
│   ├── package.json
│   └── tsconfig.json
│
├── database/             # Reference PostgreSQL schema & legacy Prisma files
└── README.md
```

---

## Quick Start Guide

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database (Supabase or local instance)

### 1. Environment Setup

#### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/postgres"
JWT_SECRET=your_secure_jwt_secret_key
FRONTEND_URL=http://localhost:3000
DEFAULT_ADMIN_USERNAME=admin@it.com
DEFAULT_ADMIN_PASSWORD=admin@it
DEFAULT_STUDENT_PASSWORD=welcome@sara
INVIGILATOR_PASSWORD=admin@sara
```

#### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:4000
```

---

## Installation & Build Commands

### Backend Commands
```bash
cd backend

# Install dependencies
npm install

# Run database seed script (Seeds Admin, Students SARA-001..SARA-060, Event & Rounds)
npm run seed

# Build TypeScript production bundle
npm run build

# Start production server
npm start

# Development mode (hot reload)
npm run dev
```

### Frontend Commands
```bash
cd frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Preview production build locally
npm run preview

# Development server (Port 3000)
npm run dev
```

---

## Default Credentials

- **Admin Account**: Username `admin@it.com` / Password `admin@it`
- **Student Accounts**: IDs `SARA-001` through `SARA-060` / Password `welcome@sara`
- **Invigilator Continuation Password**: `admin@sara`
- **Batch Number Requirement**: Accepts any 6-digit numeric string (e.g. `284001`)

---

## Key Features

1. **Multi-Round Competition Flow**:
   - **Round 1 (MCQ & Output Prediction)**: Multiple choice and code output questions with automated scoring.
   - **Round 2 (Bug Hunt)**: Source code debugging challenges with multi-bug award tracking.
   - **Round 3 (Code Sprint)**: Multi-language programming challenges with visible and hidden test cases executed locally via native compilers (`gcc`, `g++`, `javac`, `python`).

2. **Anti-Cheating & Violation Enforcement**:
   - Monitored during LIVE rounds (fullscreen exit, tab switches, window blur).
   - Instant lock at 3 violations with invigilator continuation password unlock.
   - 2-second event deduplication and pause safety protection.

3. **Real-time Socket.IO Updates**:
   - Live round state synchronization (`ROUND_STARTED`, `ROUND_PAUSED`, `ROUND_RESUMED`, `ROUND_ENDED`).
   - Admin metrics dashboard broadcasting online student counts and live violation alerts.
   - Background deadline checker running safely with log throttling.

4. **Production Deployment Ready**:
   - Zero Prisma dependencies in runtime backend or test suite.
   - CORS origin dynamically configured via `FRONTEND_URL`.
   - Cookie & Bearer JWT authentication support.
   - Parameterized SQL preventing SQL injection.

---

## Deployment Architecture

- **Frontend**: Deploy on **Vercel**, **Netlify**, or **Cloudflare Pages** (set `VITE_API_BASE_URL` environment variable).
- **Backend**: Deploy on **Render**, **Railway**, or **Fly.io** (set `PORT`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`).
- **Database**: Host on **Supabase PostgreSQL**.
