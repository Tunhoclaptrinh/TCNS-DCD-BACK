# Base Backend API

## Overview

Base Backend được xây dựng trên **Node.js + Express**, theo kiến trúc **MVC + Service Layer**. Phù hợp làm nền tảng cho bất kỳ dự án nào nhờ các tính năng sẵn có:

- **Authentication**: JWT (Access Token + Refresh Token), Change Password, Logout.
- **Authorization**: Permission-based RBAC (`resource:action`). Admin bypass toàn bộ với wildcard `*`.
- **Users**: CRUD đầy đủ, quản lý trạng thái, thống kê, activity log, cập nhật profile.
- **Notifications**: CRUD thông báo theo từng user.
- **Uploads**: Upload avatar & file, quản lý storage (admin).
- **Import / Export**: Import/Export dữ liệu CSV/XLSX, download template.
- **Database**: JSON file (dev, zero-config) hoặc MongoDB (production).
- **Swagger**: Tài liệu API tự động sinh từ code — xem `SWAGGER_AUTO.md`.

## Tài liệu sử dụng nhanh module cốt lõi

- Xem hướng dẫn thao tác đầy đủ tại: `CORE_MODULES_USAGE.md`

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm hoặc yarn

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd base-backend

# 2. Cài dependencies
npm install

# 3. Cấu hình môi trường
cp .env.example .env
# Chỉnh sửa .env theo nhu cầu

# 4. Chạy dev server
npm run dev
```

### Environment Variables (`.env`)

| Biến                | Mô tả                                     | Mặc định           |
| ------------------- | ----------------------------------------- | ------------------ |
| `PORT`              | Port server lắng nghe                     | `3000`             |
| `NODE_ENV`          | Môi trường (`development` / `production`) | `development`      |
| `JWT_SECRET`        | Secret key JWT (tối thiểu 32 ký tự)       | _(bắt buộc)_       |
| `JWT_EXPIRE`        | Thời hạn token                            | `30d`              |
| `DB_CONNECTION`     | Loại database (`json` / `mongodb`)        | `json`             |
| `DATABASE_URL`      | MongoDB connection string                 | \*(khi dùng mongo) |
| `CORS_ORIGIN`       | Allowed CORS origins                      | `*`                |
| `STORAGE_TOKEN_KEY` | Key lưu token trên client                 | `base_token`       |

---

## Project Structure

```
base-backend/
├── index.ts                        # Entrypoint
├── src/
│   ├── server.ts                   # Khởi tạo Express, middleware, routes
│   ├── config/                     # Cấu hình database abstraction
│   ├── controllers/                # HTTP Request Handlers
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── upload.controller.ts
│   │   └── importExport.controller.ts
│   ├── services/                   # Business Logic
│   │   ├── user.service.ts
│   │   └── common/
│   │       ├── notification.service.ts
│   │       ├── upload.service.ts
│   │       └── importExport.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT validation, protect, authorize
│   │   ├── rbac.middleware.ts       # checkPermission('resource:action')
│   │   ├── validation.middleware.ts # Schema validation
│   │   ├── query.middleware.ts      # Parsing filter/sort/pagination
│   │   ├── logger.middleware.ts     # Request logging
│   │   └── response.middleware.ts   # Chuẩn hoá response format
│   ├── routes/
│   │   ├── index.ts                # Route aggregator
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── notification.routes.ts
│   │   └── upload.routes.ts
│   ├── schemas/                    # Validation schemas
│   │   ├── index.ts
│   │   ├── user.schema.ts
│   │   └── notification.schema.ts
│   ├── types/                      # Express/Socket augmentation
│   ├── utils/
│   │   ├── base-service.ts         # CRUD generic service
│   │   ├── base-controller.ts      # Generic controller wrapper
│   │   ├── api-error.ts            # Custom error class
│   │   ├── helpers.ts              # JWT, password helpers
│   │   └── swagger.ts              # Swagger auto-generation
│   └── database/                   # JSON DB storage & uploads
```

---

## API Endpoints

### Auth — `/api/auth`

| Method | Path               | Auth | Mô tả                  |
| ------ | ------------------ | ---- | ---------------------- |
| POST   | `/register`        | ✗    | Đăng ký tài khoản      |
| POST   | `/login`           | ✗    | Đăng nhập, trả JWT     |
| GET    | `/me`              | ✓    | Lấy thông tin bản thân |
| POST   | `/logout`          | ✓    | Đăng xuất              |
| PUT    | `/change-password` | ✓    | Đổi mật khẩu           |
| POST   | `/refresh`         | ✗    | Refresh token          |

### Users — `/api/users`

| Method | Path             | Permission            | Mô tả                       |
| ------ | ---------------- | --------------------- | --------------------------- |
| GET    | `/`              | `users:list`          | Danh sách users (có filter) |
| POST   | `/`              | `users:create`        | Tạo user mới                |
| GET    | `/:id`           | ✓ (auth)              | Xem profile                 |
| PUT    | `/:id`           | `users:update`        | Cập nhật user               |
| DELETE | `/:id`           | `users:delete`        | Xoá mềm user                |
| DELETE | `/:id/permanent` | `users:delete`        | Xoá vĩnh viễn               |
| PATCH  | `/:id/status`    | `users:manage_status` | Bật/tắt trạng thái          |
| GET    | `/stats/summary` | `users:view_stats`    | Thống kê users              |
| GET    | `/:id/activity`  | ✓ (auth)              | Lịch sử hoạt động           |
| PUT    | `/profile`       | ✓ (auth)              | Tự cập nhật profile         |
| GET    | `/template`      | `users:import_export` | Download template import    |
| POST   | `/import`        | `users:import_export` | Import users từ file        |
| GET    | `/export`        | `users:import_export` | Export users ra file        |

### Notifications — `/api/notifications`

| Method | Path        | Auth | Mô tả                   |
| ------ | ----------- | ---- | ----------------------- |
| GET    | `/`         | ✓    | Lấy danh sách thông báo |
| PATCH  | `/:id/read` | ✓    | Đánh dấu đã đọc         |
| PATCH  | `/read-all` | ✓    | Đánh dấu tất cả đã đọc  |
| DELETE | `/:id`      | ✓    | Xoá một thông báo       |
| DELETE | `/`         | ✓    | Xoá tất cả thông báo    |

### Upload — `/api/upload`

| Method | Path         | Auth  | Mô tả                 |
| ------ | ------------ | ----- | --------------------- |
| POST   | `/avatar`    | ✓     | Upload avatar (ảnh)   |
| POST   | `/general`   | ✓     | Upload file tổng quát |
| DELETE | `/file`      | admin | Xoá file              |
| GET    | `/file/info` | admin | Thông tin file        |
| GET    | `/stats`     | admin | Thống kê storage      |
| POST   | `/cleanup`   | admin | Dọn dẹp file cũ       |

---

## Scripts

```bash
npm run dev      # Chạy dev server với nodemon
npm start        # Chạy production
npm run format   # Format code với Prettier
```

---

## License

MIT
