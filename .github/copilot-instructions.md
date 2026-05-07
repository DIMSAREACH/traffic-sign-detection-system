# Traffic Violation Expert System — Copilot Instructions

## Project Overview
- **Backend**: Django 5 REST API at `backend/`
- **Frontend**: React 18 + Vite 5 at `frontend/`
- **Theme**: Purple (`#7c3aed`), dark mode support
- **i18n**: English + Khmer (Battambang font), files in `frontend/src/i18n/`
- **Auth**: JWT (SimpleJWT) + Google OAuth
- **Venv**: `backend/.venv/` (lives inside the backend folder)

## Key Conventions
- Purple constants: `PU = "#7c3aed"`, `PA = (a) => \`rgba(124,58,237,${a})\``
- Settings stored in localStorage with `settings.*` prefix
- Settings sync via custom event: `window.dispatchEvent(new CustomEvent("settings-change", { detail: { key, value } }))`
- Translation function: `const { t } = useLanguage()` — keys like `"set.theme"`, `"nav.dashboard"`
- Page size is dynamic via `getPageSize()` reading from `settings.pageSize`
- Data attributes on `<html>`: `data-theme`, `data-lang`, `data-fontsize`, `data-contrast`, `data-reduce-motion`, `data-compact`

## Project Structure
- `backend/` — Django project (models, views, serializers, urls)
- `frontend/src/pages/` — All page components (Dashboard, Violations, Fines, Vehicles, Reports, AIUpload, Notifications, Settings, Profile, Users, Login, Register, ForgotPassword)
- `frontend/src/layouts/MainLayout.jsx` — Sidebar + header + Outlet
- `frontend/src/context/AuthContext.jsx` — Auth provider
- `frontend/src/i18n/` — LanguageContext, en.js, km.js
- `frontend/src/services/` — API service modules
- `frontend/src/styles/global.css` — Global styles, font rules, accessibility CSS
- `backend/.venv/` — Python virtual environment
- `.vscode/tasks.json` — Tasks to run backend, frontend, or both

## Development
- Start both servers: `Ctrl+Shift+B` (runs "Start Full Stack" task)
- Backend: `python manage.py runserver` (port 8000)
- Frontend: `npm run dev` (Vite, auto-assigns port)
- Build: `npm run build` from `frontend/`
