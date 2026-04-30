# 📂 Project Structure Overview

Tài liệu này cung cấp cái nhìn tổng quan, nhanh chóng về cách tổ chức mã nguồn và vai trò của từng thành phần trong hệ thống.

## 1. Sơ đồ cây thư mục tổng quát

```text
base-backend/
├── src/                        # Thư mục mã nguồn chính
│   ├── server.ts               # Khởi tạo Express, middleware và cấu hình server
│   ├── routes/                 # Điểm tập kết các route từ tất cả các module
│   ├── middleware/             # Các bộ lọc trung gian (Auth, RBAC, Error handling)
│   ├── modules/                # Chứa logic nghiệp vụ chia theo từng Module
│   ├── shared/                 # Code dùng chung (Base classes, Shared logic)
│   ├── schemas/                # Định nghĩa các Schema dùng chung toàn cục
│   ├── types/                  # Định nghĩa kiểu dữ liệu TypeScript (Interfaces, Types)
│   ├── utils/                  # Các công cụ hỗ trợ (Logger, Helpers, Swagger)
│   ├── scripts/                # Các script chạy độc lập (Seed data, Migration)
│   └── database/               # Cấu hình kết nối và các Adapter cho DB
├── docs/                       # Hệ thống tài liệu kỹ thuật chuyên sâu
├── index.ts                    # File thực thi đầu vào (Entrypoint)
├── package.json                # Quản lý dependencies và scripts
├── tsconfig.json               # Cấu hình trình biên dịch TypeScript
└── .env                        # Biến môi trường (Secret keys, DB URIs)
```

---

## 2. Phân tích chi tiết các thư mục cốt lõi

### 🧩 `src/modules/` (Business Modules)

Đây là nơi quan trọng nhất của dự án, áp dụng kiến trúc đóng gói. Mỗi thư mục con đại diện cho một tính năng lớn:

- **`auth/`**: Xử lý Đăng nhập, Đăng ký, OTP, Quên mật khẩu.
- **`users/`**: Quản lý thông tin thành viên, phân quyền, hồ sơ cá nhân.
- **`duty/`**: Toàn bộ logic về kíp trực nhật, lịch trực, đổi ca.
- **`meetings/`**: Quản lý các cuộc họp, điểm danh, biên bản họp.
- **`bonus-campaigns/`**: Các đợt cộng điểm thưởng, xét duyệt hồ sơ.
- **`notifications/`**: Gửi và quản lý thông báo cho người dùng.

**Bên trong mỗi Module thường có:**

- `controllers/`: Tiếp nhận và phản hồi HTTP.
- `services/`: Xử lý logic nghiệp vụ.
- `repositories/`: Tương tác trực tiếp với Database.
- `routes/`: Định nghĩa Endpoint riêng của module.
- `schemas/`: Định nghĩa cấu trúc dữ liệu MongoDB cho module đó.

---

### 🛡️ `src/middleware/` (Security & Filters)

- `auth.middleware.ts`: Kiểm tra tính hợp lệ của Token.
- `rbac.middleware.ts`: Kiểm tra quyền hạn của người dùng.
- `error-transform.middleware.ts`: Chuyển đổi mọi lỗi hệ thống sang định dạng JSON chuẩn.
- `http-response.middleware.ts`: Chuẩn hóa dữ liệu trả về cho Client.

---

### 🏛️ `src/shared/` (Infrastructure)

- **`common/`**:
  - `base-controller.ts`: Lớp cha cho tất cả controllers.
  - `base-service.ts`: Lớp cha cung cấp logic CRUD, phân trang dùng chung.
- **`repositories/`**:
  - `base.repository.ts`: Lớp cha trừu tượng hóa các thao tác Mongoose cơ bản.

---

### 🛠️ `src/utils/` (Tooling)

- `swagger.ts`: Cấu hình toàn bộ tài liệu API OpenAPI 3.0.
- `logger.ts`: Hệ thống ghi log chuyên nghiệp (Winston/Pino).
- `helpers.ts`: Các hàm tiện ích xử lý chuỗi, ngày tháng, dữ liệu.

---

## 3. Các tệp tin cấu hình quan trọng

- **`.env.example`**: Mẫu các biến môi trường cần thiết để chạy dự án.
- **`nodemon.json`**: Cấu hình tự động khởi động lại server khi code thay đổi trong môi trường Dev.
- **`tsconfig.json`**: Thiết lập các quy tắc nghiêm ngặt cho TypeScript để đảm bảo chất lượng code.

---

_Project Management Team_
