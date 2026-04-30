# 🚀 Base Backend Project - Modular Architecture

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue.svg)

Hệ thống Backend quản lý toàn diện cho tổ chức, được xây dựng trên nền tảng **Node.js** và **TypeScript** với kiến trúc **Module-based** hiện đại, đảm bảo tính mở rộng và bảo mật cao.

---

## 🏛️ Kiến trúc hệ thống (System Architecture)

Dự án được thiết kế theo mô hình **Service-Repository Pattern** kết hợp với **Module-based Structure**. Mỗi tính năng nghiệp vụ được đóng gói hoàn chỉnh trong một thư mục module riêng biệt.

### 📂 Cấu trúc thư mục (Project Structure)

```text
base-backend/
├── src/                        # Thư mục mã nguồn chính
│   ├── server.ts               # Khởi tạo Express & Middleware
│   ├── routes/                 # Điểm tập kết các route toàn hệ thống
│   ├── middleware/             # Bộ lọc bảo mật (Auth, RBAC, Error handling)
│   ├── modules/                # Logic nghiệp vụ chia theo Module (Auth, Users, Duty...)
│   ├── shared/                 # Hạ tầng dùng chung (Base classes, Shared logic)
│   ├── types/                  # Định nghĩa kiểu dữ liệu TypeScript
│   ├── utils/                  # Tiện ích (Swagger, Logger, Helpers)
│   └── database/               # Cấu hình kết nối Database
├── docs/                       # Hệ thống tài liệu kỹ thuật chuyên sâu
├── index.ts                    # Entrypoint ứng dụng
└── .env                        # Biến môi trường
```

#### Phân tích các phân khu chính:

- **`src/modules/`**: Trái tim của hệ thống, nơi áp dụng tính đóng gói. Mỗi module chứa đầy đủ Controller, Service, Repository và Schema riêng.
- **`src/shared/`**: Chứa các lớp Base giúp chuẩn hóa toàn bộ mã nguồn và giảm thiểu lặp code.
- **`src/middleware/`**: Hệ thống phòng vệ đa tầng, đảm bảo mọi request đều được kiểm tra an toàn.

_Xem đặc tả chi tiết từng tệp tin tại: [📄 Full Project Spec](./docs/PROJECT_STRUCTURE.md)_

---

## 📚 Hệ thống tài liệu chuyên sâu

Để tìm hiểu chi tiết về từng khía cạnh kỹ thuật, vui lòng tham khảo các tài liệu chuyên biệt:

| Tài liệu                                        | Nội dung                                       |
| :---------------------------------------------- | :--------------------------------------------- |
| [🏗️ Architecture](./docs/ARCHITECTURE.md)       | Bản đồ kiến trúc hệ thống tổng thể.            |
| [📂 Structure](./docs/DIRECTORY_OVERVIEW.md)    | Tóm tắt cấu trúc thư mục & vai trò module.     |
| [📄 Full Spec](./docs/PROJECT_STRUCTURE.md)     | Đặc tả chi tiết đến từng tệp tin của hệ thống. |
| [🗄️ Database](./docs/DATABASE_DESIGN.md)        | Sơ đồ ERD và chiến lược lưu trữ dữ liệu.       |
| [🔒 Security](./docs/SECURITY_PROTOCOL.md)      | Cơ chế bảo mật JWT, RBAC và bảo vệ dữ liệu.    |
| [🛠️ Patterns](./docs/DESIGN_PATTERNS.md)        | Các mẫu thiết kế và tiêu chuẩn lập trình.      |
| [⚡ Real-time](./docs/REALTIME_ARCHITECTURE.md) | Kiến trúc Socket.io và xử lý sự kiện.          |
| [📖 SOP Guide](./docs/API_DEVELOPMENT_GUIDE.md) | Hướng dẫn phát triển và mở rộng hệ thống.      |
| [📊 Evaluation](./docs/PROJECT_EVALUATION.md)   | Báo cáo đánh giá chất lượng và tối ưu hóa.     |

### Các Module cốt lõi:

- **Auth & Security:** Hệ thống xác thực JWT, RBAC (Role-Based Access Control) phân quyền đến từng hành động.
- **Duty Management:** Quản lý kíp trực nhật, đổi ca, và đăng ký tự động.
- **Meetings:** Quản lý lịch họp, RSVP và biên bản họp trực tuyến.
- **Reward & Penalties:** Hệ thống chấm điểm thi đua, thưởng phạt minh bạch.
- **Bonus Campaigns:** Quản lý các đợt cộng điểm Ưu tú/Rèn luyện.
- **Notifications:** Hệ thống thông báo đa kênh (Real-time, Email).

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Ngôn ngữ:** TypeScript (đảm bảo Type-safety)
- **Framework:** Express.js
- **Database:** MongoDB với Mongoose ODM
- **Real-time:** Socket.io
- **Storage:** Cloudinary (Quản lý tệp tin & hình ảnh)
- **Documentation:** Swagger UI (OpenAPI 3.0)
- **Tooling:** Prettier, ESLint, Husky

---

## 🛠️ Hướng dẫn cài đặt (Installation)

### 1. Yêu cầu hệ thống

- **Node.js**: Phiên bản 18.x trở lên.
- **Package Manager**: npm hoặc yarn.
- **Cơ sở dữ liệu**: MongoDB (Local hoặc Atlas) hoặc chế độ JSON (chỉ dùng cho Dev).

### 2. Các bước thiết lập

```bash
# Clone dự án
git clone <your-repo-url>
cd Base/Backend

# Cài đặt thư viện
npm install

# Cấu hình môi trường
cp .env.example .env
```

---

## ⚙️ Biến môi trường (`.env`)

Bạn cần cấu hình các tham số trong file `.env` để hệ thống hoạt động chính xác:

| Biến                          | Mô tả                                              | Mặc định               |
| :---------------------------- | :------------------------------------------------- | :--------------------- |
| **Server**                    |                                                    |                        |
| `PORT`                        | Cổng lắng nghe của Server.                         | `3000`                 |
| `LOG_LEVEL`                   | Mức độ ghi log (`info`, `error`, `debug`).         | `info`                 |
| `NODE_ENV`                    | Môi trường chạy (`development` / `production`).    | `development`          |
| **Authentication**            |                                                    |                        |
| `JWT_SECRET`                  | Khóa bí mật để ký Access Token (Cần > 32 ký tự).   | _(Bắt buộc)_           |
| `JWT_EXPIRE`                  | Thời hạn của Access Token.                         | `30d`                  |
| `JWT_REFRESH_SECRET`          | Khóa bí mật cho Refresh Token.                     | _(Bắt buộc)_           |
| `JWT_REFRESH_EXPIRE`          | Thời hạn của Refresh Token.                        | `30d`                  |
| `OTP_SENDER_NAME`             | Tên người gửi hiển thị trong Email OTP.            | `Hệ thống TCNS`        |
| `OTP_EXPIRE_MINUTES`          | Thời gian hết hạn của mã OTP (phút).               | `10`                   |
| `OTP_MAX_VERIFY_ATTEMPTS`     | Số lần thử nhập sai OTP tối đa.                    | `5`                    |
| `OTP_RESEND_COOLDOWN_SECONDS` | Thời gian chờ giữa 2 lần gửi lại OTP.              | `60`                   |
| **Rate Limiting**             |                                                    |                        |
| `AUTH_RATE_LIMIT_ENABLED`     | Bật/tắt giới hạn tần suất đăng nhập.               | `false`                |
| `AUTH_RATE_LIMIT_WINDOW_MS`   | Khoảng thời gian giới hạn (ms).                    | `900000`               |
| `AUTH_RATE_LIMIT_MAX`         | Số lần yêu cầu tối đa trong khoảng thời gian trên. | `5`                    |
| **Email Gateway**             |                                                    |                        |
| `OTP_EMAIL_API_URL`           | URL của dịch vụ gửi Email OTP.                     | _(Tùy chọn)_           |
| `OTP_EMAIL_API_TOKEN`         | Token xác thực của dịch vụ Email.                  | _(Tùy chọn)_           |
| **Storage Keys**              | (Cấu hình key lưu trữ phía Client)                 |                        |
| `STORAGE_TOKEN_KEY`           | Tên key lưu Access Token.                          | `base_token`           |
| `STORAGE_USER_KEY`            | Tên key lưu thông tin User.                        | `base_user`            |
| `STORAGE_REFRESH_TOKEN_KEY`   | Tên key lưu Refresh Token.                         | `base_refresh_token`   |
| **Database**                  |                                                    |                        |
| `DB_CONNECTION`               | Loại DB sử dụng (`json` hoặc `mongodb`).           | `json`                 |
| `DATABASE_URL`                | Chuỗi kết nối MongoDB (khi dùng mongodb).          | _(Cần khi dùng Mongo)_ |
| **Cloudinary**                | (Yêu cầu cho module Upload)                        |                        |
| `CLOUDINARY_CLOUD_NAME`       | Tên Cloud trên Cloudinary.                         | _(Bắt buộc)_           |
| `CLOUDINARY_API_KEY`          | API Key từ dashboard Cloudinary.                   | _(Bắt buộc)_           |
| `CLOUDINARY_API_SECRET`       | API Secret từ dashboard Cloudinary.                | _(Bắt buộc)_           |
| `CLOUDINARY_FOLDER`           | Thư mục lưu trữ trên Cloudinary.                   | `tcns`                 |
| **CORS**                      |                                                    |                        |
| `CORS_ORIGIN`                 | Danh sách domain được phép truy cập.               | `*`                    |
| `CORS_CREDENTIALS`            | Cho phép gửi credentials qua CORS hay không.       | `false`                |

---

## 🚀 Khởi chạy & Vận hành

### Các lệnh NPM chính:

- `npm run dev`: Chạy server trong môi trường phát triển (tự động reload).
- `npm run build`: Biên dịch TypeScript sang JavaScript.
- `npm start`: Chạy server production sau khi build.
- `npm run format`: Tự động định dạng code bằng Prettier.
- `npm run lint`: Kiểm tra lỗi cú pháp và tiêu chuẩn code.

### 🏁 Thiết lập dữ liệu ban đầu (Initial Setup):

Sau khi cài đặt xong, bạn cần chạy các lệnh sau để khởi tạo dữ liệu:

1. **Khởi tạo quyền hạn (RBAC):**
   ```bash
   npx ts-node src/scripts/seed-rbac.ts
   ```
2. **Tạo tài khoản Admin đầu tiên:**
   ```bash
   npx ts-node src/scripts/create-user.ts
   ```

---

## 📖 Tài liệu API (Swagger)

Hệ thống hỗ trợ tài liệu API tương tác trực tiếp qua Swagger. Sau khi khởi chạy, bạn có thể truy cập tại:
`http://localhost:<PORT>/api-docs`

---

## 📈 Đánh giá & Phân tích hệ thống

### Ưu điểm nổi bật:

- **Tính Module hóa (Modularity):** Dễ dàng thêm mới tính năng mà không ảnh hưởng đến code cũ.
- **Hiệu năng:** Git history đã được tối ưu (Purged junk files), Repo nhẹ nhàng (~15k dòng logic).
- **Bảo mật:** Middleware phân quyền (RBAC) chặt chẽ, tự động chuyển đổi lỗi (Error Transform).

### Lộ trình phát triển (Roadmap):

- [ ] Tích hợp Microservices cho các tác vụ xử lý báo cáo nặng.
- [ ] Nâng cấp hệ thống Logs bằng ELK Stack hoặc Grafana.
- [ ] Triển khai Unit Test cho các Service cốt lõi.

---

## 👥 Đóng góp

Dự án được phát triển và duy trì bởi đội ngũ Project Team.

---

_© 2026 Project Team. All rights reserved._
