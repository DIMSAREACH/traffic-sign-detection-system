# Traffic Violation Expert System

An AI-powered traffic violation management platform built with **Django 5** (REST API) and **React 18 + Vite** frontend. Features a purple themed UI with dark mode, i18n (English/Khmer), role-based access control, and full settings interactivity.

## Features

- **Dashboard** — Real-time stats, charts (violations by type, severity, monthly trend, fine status, AI accuracy), auto-refresh
- **Violations** — List, filter, search, paginate; admin can update status
- **Fines** — Track payments, mark paid, overdue detection
- **Vehicles** — Registered vehicles and violation history
- **Reports** — Analytics, trends and data export
- **AI Detection** — Upload images/video for AI analysis
- **Notifications** — Real-time bell + full page, mark read/delete, server-side pagination
- **User Management** — Admin CRUD for accounts, roles and access control
- **Profile** — Avatar upload, personal info
- **Settings** — 8 interactive sections, all connected to the app:
  - Appearance (theme, sidebar, compact mode)
  - Notifications (email, push, violation/fine/system alerts, sound)
  - Display & Data (page size, date format, timezone, language)
  - Security (2FA, session timeout, change password, account info)
  - Privacy & Data (activity log, data sharing, auto-delete, export format)
  - Accessibility (font size, reduce motion, high contrast, keyboard shortcuts)
  - Dashboard Customization (default view, auto-refresh, stat cards, chart animations)
  - About / System (version info, system health, logs, update check)
- **i18n** — English and Khmer (Battambang font) with real-time language switching

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Django 5, Django REST Framework   |
| Frontend | React 18, Vite 5, Bootstrap 5    |
| Charts   | Chart.js + react-chartjs-2       |
| Auth     | JWT (SimpleJWT), Google OAuth     |
| Database | SQLite (dev) / PostgreSQL (prod)  |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv ../.venv
../.venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env        # edit values
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_URL=http://localhost:8000
npm run dev
```

### VS Code Tasks

A [.vscode/tasks.json](.vscode/tasks.json) is provided with three tasks:

- **Start Backend (Django)** — runs `manage.py runserver`
- **Start Frontend (Vite)** — runs `npm run dev`
- **Start Full Stack** — runs both in parallel (default build task)

Press `Ctrl+Shift+B` to launch the full stack.

## Docker

Use `docker-compose.yml` to start database, backend, and frontend services.

## Keyboard Shortcuts

| Shortcut | Action              |
|----------|---------------------|
| Ctrl+D   | Go to Dashboard     |
| Ctrl+V   | Go to Violations    |
| Ctrl+F   | Go to Fines         |
| Ctrl+N   | Go to Notifications |

Shortcuts can be enabled/disabled in Settings > Accessibility.
