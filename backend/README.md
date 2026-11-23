# EHS & Safety AI Platform

Manufacturing Environment, Health & Safety platform: a multi-agent AI assistant (DomoGPT),
computer-vision video monitoring, an automated alert engine, data connectors and a 3D digital twin.

```
EHS/
├── frontend/   React + Vite + TypeScript + Tailwind UI
└── backend/    FastAPI service (managed with uv)
    ├── app/            agents, api, connectors, core, detection, models, repositories, schemas, services
    ├── docs/           architecture, design and data documentation
    ├── sql/            DDL + migrations
    ├── tests/
    └── vendor/OpenFall  third-party OpenFall fall-detection code (git-ignored)
```

## Backend
```bash
cd backend
cp .env.example .env        # set DATABASE_URL, DOMO_DEVELOPER_TOKEN, CONNECTOR_ENCRYPTION_KEY ...
uv sync                     # create .venv from pyproject.toml / uv.lock
uv run uvicorn app.main:app --reload   # http://127.0.0.1:8000
uv run pytest
```
Video detection needs the CV libraries (opencv, torch, ultralytics, mediapipe): `uv sync --group vision`. The detection workers run in this same uv environment (set `DETECTION_PYTHON` to use another interpreter). There is no login: all endpoints are open, so deploy behind your own network protection.

## Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api to http://127.0.0.1:8000
```
