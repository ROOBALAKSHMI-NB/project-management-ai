# 🚀 ProjectAI - AI-Powered Project Management System

Built with Next.js 14+, TypeScript, TailwindCSS, PostgreSQL, and Groq AI (llama-3.3-70b-versatile).

---

## ⚡ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values:
```
DATABASE_URL=postgresql://username:password@localhost:5432/project_mgmt
JWT_SECRET=your-secret-key-here
GROQ_API_KEY=your-groq-api-key
```

**Getting Groq API Key:** Visit https://console.groq.com and create a free API key.

### 3. Set Up PostgreSQL Database

Create database:
```sql
CREATE DATABASE project_mgmt;
```

Initialize tables:
```bash
node scripts/init-db.js
```

### 4. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

---

## 🏗️ Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/           # login, register, logout, me
│   │   ├── organizations/  # CRUD + invite members
│   │   ├── projects/       # CRUD + tasks
│   │   ├── tasks/          # CRUD + comments
│   │   └── ai/             # Groq AI integration
│   ├── auth/               # Login & Register pages
│   ├── dashboard/          # Org switcher
│   └── org/[orgId]/
│       ├── page.tsx         # Projects list
│       └── projects/[projectId]/
│           └── page.tsx     # Kanban board
├── lib/
│   ├── db.ts              # PostgreSQL connection
│   ├── auth.ts            # JWT auth utilities
│   └── groq.ts            # Groq AI functions
└── types/
    └── index.ts           # TypeScript types
```

---

## 🔑 Features

### ✅ Core Features
- **Multi-tenant**: Multiple organizations with isolated data
- **Authentication**: JWT-based login/register with httpOnly cookies
- **Kanban Board**: Drag-and-drop task management (Backlog → Todo → In Progress → Review → Done)
- **Task Management**: Full CRUD with priority, due dates, assignees, time estimates
- **Comments**: Threaded comments on tasks
- **Real-Time**: Auto-polling every 5 seconds (open in two tabs to see!)

### 🔐 Permission System
- **Org Roles**: Owner, Admin, Member, Guest
- **Project Roles**: Manager, Contributor, Viewer

### 🤖 AI Features (Groq llama-3.3-70b-versatile)
1. **Risk Analysis** - Analyzes project health, bottlenecks, timeline
2. **Task Suggestions** - Recommends next logical tasks
3. **Task Breakdown** - Splits high-level tasks into subtasks
4. **Natural Language** - Create tasks from plain English

---

## 🎯 Demo Flow

1. Register two accounts in different browser windows
2. Create an organization
3. Invite the second user to the org
4. Create a project and add tasks
5. Open project in two windows - drag tasks to see real-time updates
6. Click 🤖 AI Assistant to see AI features

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS |
| Database | PostgreSQL via `pg` |
| Auth | JWT + bcryptjs |
| AI | Groq SDK (llama-3.3-70b-versatile) |
| DnD | @hello-pangea/dnd |

---

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| GET/POST | /api/organizations | List/create orgs |
| GET | /api/organizations/:id | Get org details |
| POST | /api/organizations/:id/invite | Invite member |
| GET/POST | /api/projects | List/create projects |
| GET/PUT/DELETE | /api/projects/:id | Project CRUD |
| GET/POST | /api/projects/:id/tasks | List/create tasks |
| GET/PUT/DELETE | /api/tasks/:id | Task CRUD |
| GET/POST | /api/tasks/:id/comments | Comments |
| POST | /api/ai | AI operations |
