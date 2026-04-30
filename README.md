# 🚀 Base Backend Project - Modular Architecture

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue.svg)

Hệ thống Backend quản lý toàn diện cho tổ chức, được xây dựng trên nền tảng **Node.js** và **TypeScript** với kiến trúc **Module-based** hiện đại, đảm bảo tính mở rộng và bảo mật cao.

---

## 🏛️ Kiến trúc hệ thống (System Architecture)

Dự án được thiết kế theo mô hình **Service-Repository Pattern** kết hợp với **Module-based Structure**. Mỗi tính năng nghiệp vụ được đóng gói hoàn chỉnh trong một thư mục module riêng biệt.

### Sơ đồ cấu trúc Module:

```mermaid
graph TD
    A[API Gateways / Routes] --> B[Middleware]
    B --> C[Controllers]
    C --> D[Services]
    D --> E[Repositories]
    E --> F[(MongoDB / Mongoose)]
    D --> G[External Services: Cloudinary, Mailer]
    D --> H[Real-time: Socket.io]
```

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

## 🚀 Hướng dẫn khởi chạy

### Yêu cầu hệ thống:

- Node.js >= 16.x
- MongoDB (Local hoặc Atlas)

### Các bước cài đặt:

1. **Cài đặt dependencies:**

   ```bash
   npm install
   ```

2. **Cấu hình môi trường:**
   Sao chép file `.env.example` thành `.env` và điền các thông số cần thiết (DB_URI, JWT_SECRET, CLOUDINARY_URL,...).

3. **Khởi chạy môi trường Phát triển:**

   ```bash
   npm run dev
   ```

4. **Biên dịch và Chạy Production:**
   ```bash
   npm run build
   npm start
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

Dự án được phát triển và duy trì bởi đội ngũ EduSentia.

---

_© 2026 EduSentia Team. All rights reserved._
