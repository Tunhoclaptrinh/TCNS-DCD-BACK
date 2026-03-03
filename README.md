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
├── index.js                        # Entrypoint
├── src/
│   ├── server.js                   # Khởi tạo Express, middleware, routes
│   ├── config/                     # Cấu hình database abstraction
│   ├── controllers/                # HTTP Request Handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── notification.controller.js
│   │   ├── upload.controller.js
│   │   └── importExport.controller.js
│   ├── services/                   # Business Logic
│   │   ├── user.service.js
│   │   └── common/
│   │       ├── notification.service.js
│   │       ├── upload.service.js
│   │       └── importExport.service.js
│   ├── middleware/
│   │   ├── auth.middleware.js       # JWT validation, protect, authorize
│   │   ├── rbac.middleware.js       # checkPermission('resource:action')
│   │   ├── validation.middleware.js # Schema validation
│   │   ├── query.middleware.js      # Parsing filter/sort/pagination
│   │   ├── logger.middleware.js     # Request logging
│   │   └── response.middleware.js   # Chuẩn hoá response format
│   ├── routes/
│   │   ├── index.js                # Route aggregator
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── notification.routes.js
│   │   └── upload.routes.js
│   ├── schemas/                    # Validation schemas
│   │   ├── index.js
│   │   ├── user.schema.js
│   │   └── notification.schema.js
│   ├── utils/
│   │   ├── base-service.js         # CRUD generic service
│   │   ├── base-controller.js      # Generic controller wrapper
│   │   ├── api-error.js            # Custom error class
│   │   ├── helpers.js              # JWT, password helpers
│   │   └── swagger.js              # Swagger auto-generation
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
