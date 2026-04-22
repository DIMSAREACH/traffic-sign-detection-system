# Deploying this project from GitHub

This document describes the minimal steps to push this repository to GitHub, enable CI, and publish a Docker image to GitHub Container Registry (GHCR).

1) Create a GitHub repository and push the repo

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

2) Add repository secrets

- On GitHub → Settings → Secrets → Actions add any required secrets (SMTP credentials, DB credentials for production). The workflow uses `GITHUB_TOKEN` (provided automatically) for GHCR pushes.

3) CI behaviour

- On PRs and pushes to `main` the workflow defined in `.github/workflows/ci.yml` will:
  - Run backend tests (`pytest`)
  - Build the frontend (`npm run build`)
  - Build and push a Docker image to GHCR tagged with the commit SHA and `latest`.

4) Deploying the image

- You can deploy the pushed GHCR image to your hosting provider (Render, Fly.io, DigitalOcean, Kubernetes, etc.). Use the image URL:

```
ghcr.io/OWNER/REPO:COMMIT_SHA
```

5) Production environment

- Do NOT commit `.env` — use environment variables in your hosting platform.
- Ensure `DJANGO_DEBUG=False`, `ALLOWED_HOSTS` set, and production security settings in `backend/traffic_system/settings.py` are active.

If you want, I can also:
- Create a `deploy` workflow that automatically runs DB migrations and restarts the service on a hosting provider.
- Create a small Kubernetes manifest or Render/Railway configuration file.
