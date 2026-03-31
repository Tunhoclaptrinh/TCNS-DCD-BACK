# Base Backend API

## Overview

Base Backend được xây dựng trên **Node.js + Express**, theo kiến trúc **Modular Layered Architecture**. Dự án được tổ chức theo từng module nghiệp vụ như `auth`, `users`, `duty`, `files`, mỗi module có các tầng rõ ràng như `routes -> controllers -> services -> repositories`.

Kiến trúc chi tiết xem tại: [`docs/architecture.md`](docs/architecture.md)

Phù hợp làm nền tảng cho bất kỳ dự án nào nhờ các tính năng sẵn có:

- **Authentication**: JWT (Access Token + Refresh Token), Change Password, Logout.
- **Authorization**: Permission-based RBAC (`resource:action`). Admin bypass toàn bộ với wildcard `*`.
- **Users**: CRUD đầy đủ, quản lý trạng thái, thống kê, activity log, cập nhật profile.
- **Notifications**: CRUD thông báo theo từng user.
- **Uploads**: Upload avatar & file lên Cloudinary, quản lý asset từ admin endpoint.
- **Import / Export**: Import/Export dữ liệu CSV/XLSX, download template.
- **Database**: JSON file (dev, zero-config) hoặc MongoDB (production).
- **Swagger**: Tài liệu API khai báo tĩnh, bám sát tài liệu mong muốn của hệ thống.

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

| Biến                    | Mô tả                                     | Mặc định                     |
| ----------------------- | ----------------------------------------- | ---------------------------- |
| `PORT`                  | Port server lắng nghe                     | `3000`                       |
| `NODE_ENV`              | Môi trường (`development` / `production`) | `development`                |
| `JWT_SECRET`            | Secret key JWT (tối thiểu 32 ký tự)       | _(bắt buộc)_                 |
| `JWT_EXPIRE`            | Thời hạn token                            | `30d`                        |
| `DB_CONNECTION`         | Loại database (`json` / `mongodb`)        | `json`                       |
| `DATABASE_URL`          | MongoDB connection string                 | \*(khi dùng mongo)           |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name cho upload          | _(bắt buộc khi dùng upload)_ |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                        | _(bắt buộc khi dùng upload)_ |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                     | _(bắt buộc khi dùng upload)_ |
| `CLOUDINARY_FOLDER`     | Thư mục gốc trên Cloudinary               | `tcns`                       |
| `CORS_ORIGIN`           | Allowed CORS origins                      | `*`                          |
| `STORAGE_TOKEN_KEY`     | Key lưu token trên client                 | `base_token`                 |

---

## Project Structure

```
base-backend/
├── index.ts                        # Entrypoint
├── src/
│   ├── server.ts                   # Khởi tạo Express, middleware, routes
│   ├── database/                   # Mongo adapter và entrypoint database
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── api-query.middleware.ts
│   │   ├── http-response.middleware.ts
│   │   └── ...
│   ├── modules/                    # Chia theo module nghiệp vụ
│   │   ├── auth/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── repositories/
│   │   ├── users/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   └── schemas/
│   │   ├── duty/
│   │   ├── files/
│   │   ├── notifications/
│   │   ├── reward-penalties/
│   │   └── reports/
│   ├── routes/
│   │   └── index.ts                # Mount tất cả module routes
│   ├── schemas/                    # Schema dùng chung/toàn cục
│   ├── shared/
│   │   ├── common/                 # BaseController, BaseService
│   │   ├── repositories/           # BaseRepository
│   │   ├── import-export/
│   │   └── security/
│   ├── types/                      # Kiểu dùng chung và Express augmentation
│   ├── utils/
│   │   ├── api-error.ts
│   │   ├── helpers.ts
│   │   └── swagger.ts
├── docs/
│   └── architecture.md             # Tài liệu kiến trúc hệ thống
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

| Method | Path         | Auth  | Mô tả                                        |
| ------ | ------------ | ----- | -------------------------------------------- |
| POST   | `/avatar`    | ✓     | Upload avatar (ảnh)                          |
| POST   | `/general`   | ✓     | Upload ảnh tổng quát lên Cloudinary          |
| DELETE | `/file`      | admin | Xoá file theo `publicId` hoặc `url`          |
| GET    | `/file/info` | admin | Thông tin file từ Cloudinary                 |
| GET    | `/stats`     | admin | Thống kê storage theo folder trên Cloudinary |
| POST   | `/cleanup`   | admin | Dọn asset cũ trên Cloudinary                 |

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
