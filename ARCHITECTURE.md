# 🏗️ Base Backend - Architecture & System Design

**Version:** 2.1.0  
**Design Pattern:** MVC + Service Layer  
**Last Updated:** February 20, 2026

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Directory Structure](#directory-structure)
4. [Architectural Patterns](#architectural-patterns)
5. [Data Flow](#data-flow)
6. [Module Design](#module-design)
7. [Database Layer](#database-layer)
8. [Error Handling](#error-handling)
9. [Security](#security)

---

## 🎯 System Overview

### Core Technologies

- **Runtime:** Node.js v18+
- **Framework:** Express.js 4.x
- **Database:** JSON File (Development) / MongoDB (Supported)
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** Internal Schema Validation
- **File Upload:** Multer
- **Password Hashing:** bcryptjs

### System Characteristics

- **Architecture Style:** Layered (MVC + Service Layer)
- **API Style:** RESTful
- **Authentication:** Token-based (JWT)
- **Authorization:** Granular Permission-Based Access Control

---

## 📐 Architecture Diagram

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                      │
│                (Web Browser, Mobile App)                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                    HTTP/HTTPS (REST API)
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    EXPRESS.JS SERVER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              MIDDLEWARE STACK                          │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ • CORS & Security Headers                              │ │
│  │ • Request Logging                                      │ │
│  │ • Body Parser (JSON)                                   │ │
│  │ • Query Parser (Advanced Filters)                      │ │
│  │ • Authentication (JWT)                                 │ │
│  │ • Authorization (Dynamic Permissions)                  │ │
│  │ • Request Validation (Schema)                          │ │
│  │ • Error Handling (Global)                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              ROUTING LAYER                             │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Public Routes:                                         │ │
│  │ • /api/auth/*           Authentication                 │ │
│  │                                                        │ │
│  │ Protected Routes (Require Auth):                       │ │
│  │ • /api/users/*          User Management & Profiles     │ │
│  │ • /api/notifications/*  User Notifications             │ │
│  │ • /api/upload/*         File Uploads                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Directory Structure

### Complete Project Organization

```
base-backend/
│
├── 📁 config/                      # Configuration Files
│   └── database.ts                 # Database abstraction & CRUD
│
├── 📁 controllers/                 # HTTP Request Handlers
│   ├── auth.controller.ts          # Authentication (Login, Register)
│   ├── user.controller.ts          # User management
│   ├── notification.controller.ts  # Notifications
│   ├── upload.controller.ts        # File uploads
│   └── importExport.controller.ts  # Data Import/Export
│
├── 📁 middleware/                  # Express Middleware
│   ├── auth.middleware.ts          # JWT validation
│   ├── rbac.middleware.ts          # Permission-based control
│   ├── query.middleware.ts         # Query parsing
│   └── validation.middleware.ts    # Schema validation
│
├── 📁 routes/                      # Express Routes
│   ├── index.ts                    # Route aggregator
│   ├── auth.routes.ts              # Auth endpoints
│   ├── user.routes.ts              # User endpoints
│   ├── notification.routes.ts      # Notifications
│   └── upload.routes.ts            # Upload endpoints
│
├── 📁 services/                    # Business Logic Layer
│   ├── user.service.ts             # User logic
│   ├── notification.service.ts     # Notification logic
│   ├── upload.service.ts           # File logic
│   └── importExport.service.ts     # Data logic
│
├── 📁 schemas/                     # Data Validation Schemas
│   ├── user.schema.ts              # User validation
│   └── notification.schema.ts      # Notification validation
│
├── 📁 utils/                       # Utility Functions
│   └── helpers.ts                  # JWT, password helpers
│
├── 📁 database/                    # Data Storage
│   ├── db.json                     # Main database (Dev)
│   └── uploads/                    # Physical files
│
└── 📄 server.ts                    # Entry point
```

---

## 🏛️ Architectural Patterns

### MVC + Service Layer Pattern

1. **Route**: Matches the incoming URL.
2. **Middleware**: Handles cross-cutting concerns (Auth, Validation, Filtering).
3. **Controller**: Parses the request, calls services, sends formatted response.
4. **Service**: Core business logic, coordinates multiple database calls.
5. **Database**: Direct data manipulation and relationship handling.

---

## 🔐 Authentication & Authorization

### Dynamic Permission System

Unlike static role-based systems, this backend uses a granular permission model:

- **Keys**: Format `resource:action` (e.g., `users:create`).
- **Middleware**: `checkPermission('resource:action')` validates current user permissions.
- **Admin**: Automatically bypasses all checks with a wildcard `*` permission.
