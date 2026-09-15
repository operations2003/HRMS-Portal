# HRMS Portal — Employee & Organization Management System

[![Phase](https://img.shields.io/badge/Phase-1%20Production--Ready-indigo)](https://github.com/operations2003/HRMS-Portal)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A clean, modular, and scalable **Enterprise Human Resource Management System (HRMS)** featuring complete Role-Based Access Control (RBAC), Organization hierarchies, and centralized Employee Directory management.

---

## 👥 Team Responsibilities & Architecture

| Team Member | Domain | Tech Stack | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Shubham** | **Backend + Frontend** | Node.js, Express, React, Tailwind CSS | APIs, JWT Authentication, RBAC middleware, UI library, forms, tables, modals, layouts, dashboard |
| **Sakshi** | **Frontend** | React, Tailwind CSS | Additional frontend screens & responsive polish (on leave today, covered by Shubham) |
| **Ajay** | **Database & Testing** | PostgreSQL, Supabase | Database architecture, tables, relationships, seed data, and testing suite |

### Tech Stack Overview
- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, Express, JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), Helmet, Morgan, CORS
- **Database (Ajay's Scope)**: PostgreSQL / Supabase
- **Deployment Targets**: Frontend → Vercel, Backend → Render, Database → Supabase

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### 1. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

Or from the root directory:
```bash
npm run install:all
```

### 2. Start the Servers

In separate terminal windows:

**Backend Server (Port 5000):**
```bash
cd backend
npm run dev
# Running at http://localhost:5000 (Health Check: http://localhost:5000/api/health)
```

**Frontend Application (Port 5173):**
```bash
cd frontend
npm run dev
# Open in browser: http://localhost:5173
```

---

## 🔐 Default Test Credentials (RBAC)

The system comes pre-configured with test accounts covering all 4 system roles:

| Role | Email | Password | Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **SuperAdmin** | `admin@hrms.local` | `Admin@123` | System-wide administrative control across all organizations, users, and employees |
| **OrgAdmin** | `orgadmin@techcorp.local` | `OrgAdmin@123` | Organization administrator; full organization and employee management |
| **HRManager** | `hr@techcorp.local` | `Hr@123` | Employee lifecycle management, department viewing, user viewing |
| **Employee** | `emp@techcorp.local` | `Emp@123` | Standard staff access: view dashboard, self-profile, and employee directory |

*💡 Tip: The login screen includes a 1-click **Quick Test Credentials** panel to test each role instantly.*

---

## 📂 Project Structure

```text
HRMS-Portal/
├── backend/
│   ├── src/
│   │   ├── config/              # Centralized environment configuration
│   │   ├── controllers/         # Express controllers (auth, org, employee, user, dashboard)
│   │   ├── middleware/          # Auth JWT, RBAC authorization, validation, error handler
│   │   ├── repositories/        # Repository abstraction layer (Ajay's DB integration point)
│   │   │   ├── dataStore.js     # In-memory relational store for Phase 1
│   │   │   ├── orgRepository.js
│   │   │   ├── employeeRepository.js
│   │   │   ├── userRepository.js
│   │   │   └── roleRepository.js
│   │   ├── routes/              # Express API route modules
│   │   ├── services/            # Business logic layer
│   │   ├── utils/               # Password hashing (bcrypt), JWT, standardized responses
│   │   ├── validators/          # Input schema validations
│   │   ├── app.js               # Express application configuration
│   │   └── server.js            # Server entry point
│   ├── test-api.js              # Automated backend test suite (24 tests)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/          # Reusable UI: Button, Input, Select, PasswordInput,
│   │   │   │                    # Badge, Alert, Modal, ConfirmDialog, DataTable,
│   │   │   │                    # LoadingSpinner, EmptyState
│   │   │   └── rbac/            # Declarative <Can> permission component
│   │   ├── context/             # AuthContext (state, token, login, logout, RBAC checks)
│   │   ├── layouts/             # AppLayout, Navbar, Sidebar (with RBAC visibility)
│   │   ├── pages/
│   │   │   ├── auth/            # Professional Login screen with role selector
│   │   │   ├── dashboard/       # Dashboard with KPI cards & stats
│   │   │   ├── organizations/   # Organization list, create/edit modal, delete confirm
│   │   │   ├── employees/       # Employee directory, create/edit modal, profile viewer
│   │   │   ├── users/           # User accounts & role permissions list
│   │   │   └── common/          # 403 Forbidden & 404 Not Found pages
│   │   ├── services/            # Centralized API service layer (Axios/fetch client)
│   │   ├── styles/              # Tailwind CSS configuration and design tokens
│   │   ├── App.jsx              # Routing & Route Guards (ProtectedRoute, PermissionRoute)
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── package.json                 # Root monorepo scripts
└── README.md
```

---

## 🔌 API Reference

All API responses strictly adhere to the unified format:
```json
// Success Response
{
  "success": true,
  "message": "Readable success message",
  "data": { ... }
}

// Error Response
{
  "success": false,
  "message": "Readable error message",
  "errors": ["Specific field error or constraint violation"]
}
```

### Authentication Endpoints
- `POST /api/v1/auth/login` — Authenticate and receive JWT Bearer token
- `POST /api/v1/auth/logout` — Revoke session
- `GET  /api/v1/auth/me` — Retrieve authenticated user profile, roles, and permissions

### Organization Endpoints
- `GET    /api/v1/organizations` — List organizations (supports `?search=` and `?status=`)
- `GET    /api/v1/organizations/:id` — Get single organization with department/employee counts
- `POST   /api/v1/organizations` — Create organization (*Requires `org:write`*)
- `PUT    /api/v1/organizations/:id` — Update organization (*Requires `org:write`*)
- `DELETE /api/v1/organizations/:id` — Deactivate/delete organization (*Requires `org:delete`*)

### Employee Endpoints
- `GET    /api/v1/employees` — List employees (supports `?search=`, `?deptId=`, `?status=`, `?page=`, `?limit=`)
- `GET    /api/v1/employees/metadata` — Get form metadata (organizations, departments, designations)
- `GET    /api/v1/employees/:id` — Get employee details
- `POST   /api/v1/employees` — Create employee (*Requires `employee:write`*)
- `PUT    /api/v1/employees/:id` — Update employee profile (*Requires `employee:write`*)
- `DELETE /api/v1/employees/:id` — Deactivate/delete employee (*Requires `employee:delete`*)

### User & RBAC Endpoints
- `GET  /api/v1/users` — List system user accounts (*Requires `user:read`*)
- `GET  /api/v1/users/meta/roles` — List available system roles and permissions
- `POST /api/v1/users` — Create user account (*Requires `user:write`*)

### Dashboard Endpoints
- `GET /api/v1/dashboard/stats` — Aggregated metrics, headcount, and department breakdown

---

## 🛠️ Instructions for Ajay (Database & Testing)

The backend code was architected with a decoupled **Repository Layer** (`backend/src/repositories/`):
- `orgRepository.js`
- `employeeRepository.js`
- `userRepository.js`
- `roleRepository.js`

To connect PostgreSQL / Supabase:
1. Configure your PostgreSQL connection pool or Supabase JS client in `backend/src/db/` or `backend/src/config/`.
2. Implement SQL queries inside the matching methods in `backend/src/repositories/` (e.g. `findAll`, `findById`, `create`, `update`, `delete`).
3. Controllers, middleware, validators, and the frontend will automatically work with PostgreSQL without requiring any changes.
4. Run the automated verification suite:
   ```bash
   node backend/test-api.js
   ```

---

## 📄 License
MIT License. Built for Phase 1 of HRMS Portal.
