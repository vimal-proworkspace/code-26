# Coding Event Platform 2026

A modern platform for hosting competitive coding events and challenges.

## Repository Structure

```text
coding-event-platform/
│
├── frontend/         # React + TypeScript + Vite client application
├── backend/          # Node.js + TypeScript + Express server application
├── database/         # PostgreSQL schema & seed system
│   └── prisma/
│       ├── schema.prisma
│       └── seed/
│           └── seed.ts
├── docs/             # Technical specifications & documentation
├── .gitignore
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (Local or Supabase)

### Environment Configuration
Copy `.env.example` to `.env` and set your PostgreSQL connection credentials:
```bash
cp .env.example .env
```

### Database Setup & Seeding
```bash
# Navigate to backend directory
cd backend

# Validate Prisma schema
npx prisma validate --schema=../database/prisma/schema.prisma

# Generate Prisma Client
npm run prisma:generate

# Execute database seed (Admin, 60 Students, Event & 3 Rounds)
npm run db:seed
```

### Development Servers

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Seeded Development Credentials
- **Admin**: `admin@it.com` / `admin@it` (stored as bcrypt hash)
- **Students**: `SARA-001` through `SARA-060` / `welcome@sara` (stored as bcrypt hashes)
- **Batch**: `284001`
