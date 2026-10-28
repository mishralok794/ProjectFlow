# ProjectFlow

ProjectFlow is a microservice-based platform for managing academic software projects, tasks, evaluations, and GitHub integrations. It brings together a React frontend, an API gateway, and multiple backend services to support the full project lifecycle from team onboarding to completion and review.

## Overview

The application is designed around a modular architecture where each business domain is handled by a dedicated service:

- Authentication and user access
- Project management
- Task tracking
- Evaluation and review workflows
- GitHub integration
- Notifications
- API gateway routing

## Architecture

```text
projectflow/
├── client/                  # React + Vite frontend
├── gateway/                 # API gateway service
├── services/
│   ├── auth/                # Auth and user service
│   ├── project/             # Project management service
│   ├── task/                # Task and workflow service
│   ├── evaluation/          # Evaluation and scoring service
│   ├── integration/         # GitHub integration service
│   └── notification/        # Email/notification service
├── shared/                  # Shared utilities and middleware
├── docs/                   # SRS, UML, architecture, and API docs
├── scripts/                 # Startup and seed scripts
├── package.json             # Root Node.js project setup
├── docker-compose.yml       # Container orchestration config
├── .gitignore
├── README.md
└── package-lock.json
```

## Features

- User authentication and authorization
- Project creation and management
- Task assignment and tracking
- Evaluation and review workflows
- GitHub API integration for project monitoring
- Notification system for updates and alerts
- Centralized API entry point through the gateway
- Frontend dashboard for project operations

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- API Gateway: Express-based routing layer
- Database: MongoDB
- Messaging/async support: amqplib
- HTTP client: Axios
- Security: JWT-based authentication

## Project Structure

### Client
The frontend lives in `client/` and is powered by Vite. It provides the UI for interacting with the platform.

### Gateway
The gateway is the main API entry point and routes requests to the correct service.

### Services
Each domain-specific service runs independently and exposes its own endpoints.

- `services/auth`
- `services/project`
- `services/task`
- `services/evaluation`
- `services/integration`
- `services/notification`

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB instance running locally or in Docker

### Install dependencies

```bash
npm install
npm install --prefix client
```

### Start all services

```bash
npm start
```

This starts the microservices and gateway together using the scripts under `scripts/start-all.js`.

### Run the frontend separately

```bash
npm --prefix client run dev
```

The frontend usually runs on:

- http://localhost:3000

### Run individual services

```bash
npm run dev:gateway
npm run dev:auth
npm run dev:project
npm run dev:task
npm run dev:evaluation
npm run dev:integration
npm run dev:notification
```

## API Gateway

The gateway exposes routes such as:

- `/api/auth/*`
- `/api/projects*`
- `/api/criteria*`
- `/api/tasks*`
- `/api/evaluations*`
- `/api/github*`
- `/api/notifications*`

The gateway also performs token validation for protected routes and forwards requests to the appropriate microservice.

## Health Checks

The gateway exposes a health endpoint:

```bash
curl http://localhost:5000/health
```

## Netlify Deployment

This repository is pre-configured with `netlify.toml` and `_redirects` for turnkey deployment on Netlify:

1. **Import Repository**: In your Netlify dashboard, connect `mishralok794/ProjectFlow`.
2. **Build Settings**: Netlify automatically detects the configuration from `netlify.toml`:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist` (or `client/dist` if base is repository root)
3. **Client-Side Routing**: Handled automatically via `_redirects` and `netlify.toml` (`/* /index.html 200`).
4. **Demo data**: Netlify builds set `VITE_DEMO_MODE=true`, so the static site does not call a backend. Accounts, institutions, courses and demo changes are stored as JSON in the browser's local storage. This is intended for demonstrations on one browser; it is not shared with other visitors or devices. Coordinators can export or import the demo JSON from the coordinator dashboard.

For shared, multi-device use, deploy a backend separately and set `VITE_DEMO_MODE=false` and `VITE_API_URL` in Netlify.


## Documentation

Project documentation is organized in the `docs/` directory and includes:

- SRS
- UML
- API documentation
- Architecture design notes

## Notes

This repository is structured as a modular microservice platform for academic software lifecycle management and evaluation. It is intended to be extended with additional services, integrations, and UX improvements as the project evolves.

## Contributors

- **Alok Mishra** — Collaborator

## License

This project is currently configured without a specific license file in the repository root.
