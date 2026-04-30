---

## 📑 Mục lục (Table of Contents)

- [⚡ Khởi chạy nhanh (Quick Start)](#-khởi-chạy-nhanh-quick-start)
- [🏗️ Kiến trúc & Triết lý hệ thống](#️-kiến-trúc--triết-lý-hệ-thống)
- [🚀 Hướng dẫn cài đặt chi tiết](#-hướng-dẫn-cài-đặt-chi-tiết-setup-guide)
- [⚙️ Biến môi trường (.env)](#️-biến-môi-trường-env)
- [🔍 Hệ thống truy vấn API nâng cao](#-hệ-thống-truy-vấn-api-nâng-cao-universal-query-guide)
- [⚡ Kiến trúc Real-time (Socket.io)](#-kiến-trúc-real-time-socketio)
- [🏗️ Quy trình phát triển (Developer SOP)](#️-quy-trình-phát-triển-developer-sop)
- [🔐 Bảo mật & Quy chuẩn](#-bảo-mật--quy-chuẩn)
- [📚 Tra cứu & Thuật ngữ](#-tra-cứu--thuật-ngữ)

---

## 💡 Triết lý Dự án (Project Philosophy)

Dự án này không chỉ là một ứng dụng, mà là một **Bộ khung (Base Framework)** được thiết kế để giải quyết các vấn đề kinh điển của Backend:

- **Ngăn chặn "Fat Controller":** Đẩy toàn bộ logic vào Service, Controller chỉ làm nhiệm vụ điều phối.
- **Tối ưu hóa Database:** Mọi truy vấn đều qua tầng Repository để dễ dàng chuyển đổi DB hoặc tối ưu Indexing.
- **Tư duy Modular:** "Mọi thứ là một Module". Nếu bạn muốn xóa một tính năng, bạn chỉ cần xóa một thư mục mà không làm hỏng toàn bộ app.

---

## ⚡ Khởi chạy nhanh (Quick Start)

Dành cho các nhà phát triển đã cài đặt sẵn Node.js và MongoDB/JSON:

```bash
# 1. Cài đặt phụ thuộc
npm install

# 2. Cấu hình môi trường
cp .env.example .env

# 3. Khởi tạo dữ liệu hệ thống (Quyền hạn & Admin)
# Lệnh này sẽ chạy seed-rbac và create-user tự động
npm run seed:all

# 4. Chạy môi trường phát triển
npm run dev
```

---

## 🏗️ Kiến trúc Hệ thống (System Architecture)

Dự án được xây dựng theo mô hình **Modular Monolith**, đảm bảo tính đóng gói của từng module nghiệp vụ:

```mermaid
graph TD
    Client[Frontend / Mobile] -->|HTTPS / WSS| Nginx{Nginx Reverse Proxy}
    Nginx -->|Load Balancing| Node[Node.js Cluster]
    Node -->|Auth & RBAC| Middleware[Middleware Layers]
    Middleware -->|Modular Logic| Modules[Business Modules]
    Modules -->|Query Helper| Shared[Shared Base Classes]
    Shared -->|Adapter| DB[(MongoDB / JSON Storage)]
    Modules -->|Real-time| Socket[Socket.io Engine]
    Socket -->|Push| Client
```

---

## 🚀 Hướng dẫn cài đặt chi tiết (Setup Guide)

### 1. Yêu cầu hệ thống:

- **Node.js**: Phiên bản 18.x hoặc cao hơn.
- **Database**: MongoDB (Atlas hoặc Local) hoặc đơn giản là dùng JSON file (mặc định).
- **Package Manager**: NPM hoặc Yarn.

### 2. Các bước cài đặt:

```bash
# Clone dự án
git clone <repository-url>

# Vào thư mục dự án
cd base-backend

# Cài đặt thư viện
npm install

# Cấu hình môi trường (Cập nhật DATABASE_URL nếu dùng MongoDB)
cp .env.example .env
```

### 3. Thiết lập dữ liệu ban đầu:

Hệ thống yêu cầu một số dữ liệu nền tảng để hoạt động (Quyền hạn, Vai trò, Tài khoản Admin).

- **Khởi tạo RBAC:** `npx ts-node src/scripts/seed-rbac.ts`
- **Tạo Admin:** `npx ts-node src/scripts/create-user.ts`

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

### 📊 Sơ đồ quan hệ thực thể (ERD Simplified)

```mermaid
erDiagram
    USER ||--o{ ROLE : has
    USER ||--o{ GENERATION : belongs_to
    USER ||--o{ DUTY_SLOT : registers
    USER ||--o{ MEETING_RSVP : responds
    USER ||--o{ NOTIFICATION : receives
    ROLE ||--o{ PERMISSION : contains
    MEETING ||--o{ USER : organizes
    DUTY_SLOT }|--|| SEMESTER : part_of
    REWARD_PENALTY }|--|| USER : applied_to
```

---

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
| **Mail / SMTP**               | (Dùng cho tính năng Quên mật khẩu)                 |                        |
| `SMTP_HOST`                   | Host của Mail Server (ví dụ: smtp.gmail.com).      | `smtp.gmail.com`       |
| `SMTP_PORT`                   | Cổng kết nối (thường là 587 hoặc 465).             | `587`                  |
| `SMTP_USER`                   | Tài khoản email dùng để gửi tin.                   | _(Bắt buộc)_           |
| `SMTP_PASS`                   | Mật khẩu ứng dụng (App Password 16 ký tự).         | _(Bắt buộc)_           |
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

---

## 🔍 Hệ thống truy vấn API nâng cao (Universal Query Guide)

Hệ thống cung cấp một bộ tham số URL mạnh mẽ, giúp Frontend linh hoạt tuyệt đối trong việc lọc, sắp xếp và phân trang dữ liệu mà không cần Backend viết thêm code.

### 1. Phân trang & Điều hướng (Pagination)

Hệ thống linh hoạt hỗ trợ cả định dạng tiêu chuẩn và định dạng có tiền tố `_`. Nếu truyền cả hai, hệ thống sẽ ưu tiên tham số có tiền tố `_`.

| Tham số chính | Tham số thay thế | Ý nghĩa                           | Ví dụ             |
| :------------ | :--------------- | :-------------------------------- | :---------------- |
| `_page`       | `page`           | Trang cần lấy (mặc định: 1)       | `?page=2`         |
| `_limit`      | `limit`          | Số bản ghi/trang (mặc định: 10)   | `?_limit=50`      |
| `_sort`       | `sort`           | Trường cần sắp xếp                | `?sort=createdAt` |
| `_order`      | `order`          | Hướng (`asc` / `desc`)            | `?order=desc`     |
| `_q`          | `q`              | Tìm kiếm toàn văn (Global search) | `?q=keyword`      |

### 2. Các toán tử so sánh nâng cao (Query Operators)

Bạn có thể kết hợp tên trường với các hậu tố để thực hiện lọc dữ liệu phức tạp ngay trên URL:

- **`_like`**: Tìm kiếm chứa chuỗi (vd: `fullName_like=An`).
- **`_ilike`**: Tìm kiếm không phân biệt hoa thường (vd: `email_ilike=USER`).
- **`_gte` / `_lte`**: Lớn hơn hoặc bằng / Nhỏ hơn hoặc bằng (vd: `age_gte=18`).
- **`_gt` / `_lt`**: Lớn hơn hẳn / Nhỏ hơn hẳn.
- **`_ne`**: Khác (Not equal) (vd: `status_ne=deleted`).
- **`_in`**: Nằm trong danh sách (vd: `role_in=admin,manager`).
- **`_nin`**: Không nằm trong danh sách.

> [!TIP]
> **Cơ chế Ưu tiên:** Hệ thống ưu tiên tham số có tiền tố `_` (vd: `_page`) hơn tham số không có tiền tố (`page`). Điều này giúp tránh xung đột với các trường dữ liệu có tên trùng với từ khóa hệ thống.

### 3. Ví dụ thực tế kết hợp (Advanced Examples)

**Lọc người dùng đang hoạt động, thuộc khóa K65, sắp xếp theo tên tăng dần, lấy trang 2:**

```text
GET /api/users?status=active&generation_code=K65&_sort=fullName&_order=asc&_page=2&_limit=10
```

**Tìm kiếm toàn văn các ca trực có từ khóa "sảnh", lọc theo ngày lớn hơn hiện tại:**

```text
GET /api/duty/slots?_q=sảnh&date_gte=2024-05-01T00:00:00Z
```

**Lọc nâng cao với toán tử so sánh (Ví dụ: Điểm thưởng từ 10 đến 50):**

```text
GET /api/reward-penalties?points_gte=10&points_lte=50
```

---

## ⚡ Kiến trúc Real-time (Socket.io)

Hệ thống sử dụng Socket.io để đẩy thông báo tức thời đến Client.

### 1. Các sự kiện chính (Events):

1. **`notification:new`**: Đẩy thông báo mới cho người dùng.
2. **`duty:slot_update`**: Cập nhật trạng thái ca trực khi có biến động.
3. **`meeting:reminder`**: Nhắc nhở lịch họp tự động.

### 2. Cơ chế Xác thực (Socket Authentication)

Để đảm bảo an toàn, Socket.io yêu cầu gửi Token ngay trong bước bắt tay (Handshake).

**Client-side (React/Vue):**

```javascript
const socket = io(process.env.BACKEND_URL, {
  auth: {
    token: `Bearer ${localStorage.getItem('token')}`,
  },
});
```

**Server-side:** Middleware `auth.middleware.ts` sẽ tự động giải mã token và gán `socket.user` để bạn sử dụng trong các logic tiếp theo.

### 3. Tham gia phòng (Room Subscription)

```javascript
// Đăng ký nhận cập nhật từ một phòng cụ thể
socket.emit('room:join', 'duty_updates');
```

---

## 🛡️ Bảo mật & Tiêu chuẩn (Security Hardening)

- **Password Hashing**: Bcrypt với salt rounds = 12.
- **Rate Limiting**: Chống brute-force cho các API nhạy cảm.
- **RBAC Guard**: Phân quyền chi tiết đến từng Resource và Action.
- **NoSQL Injection Protection**: Lọc dữ liệu đầu vào qua lớp Mongoose.
- **XSS Mitigation**: Chuẩn hóa và thoát chuỗi nguy hiểm trong Request Body.

---

## 🏗️ Hướng dẫn mở rộng hệ thống (Developer SOP)

Để thêm một module mới (ví dụ: `Module Tài sản`), hãy tuân thủ quy trình 5 bước:

1. **Schema (`schemas/asset.schema.ts`):**
   - Định nghĩa Mongoose Schema. `src/schemas/`
   - Xuất Interface cho TypeScript để đảm bảo kiểm soát kiểu.
2. **Repository (`repositories/asset.repository.ts`):**
   - Kế thừa `BaseRepository`. `src/repositories/`
   - Thêm các hàm truy vấn đặc thù (nếu các hàm CRUD cơ bản không đủ).
3. **Service (`services/asset.service.ts`):**
   - Kế thừa `BaseService`. `src/services/`
   - Đây là nơi xử lý Logic: kiểm tra trùng lặp, tính toán, gọi Socket thông báo.
4. **Controller (`controllers/asset.controller.ts`):**
   - Kế thừa `BaseController`. `src/controllers/`
   - Chỉ chứa logic điều hướng và gọi Service.
5. **Route (`asset.routes.ts`):**
   - Khai báo các đường dẫn API. `src/routes/`
   - Gắn Middleware `auth` và `rbac` (vd: `rbac('assets:create')`). `src/middleware/`
   - Đăng ký vào `src/routes/index.ts`.

> [!IMPORTANT]
> Luôn luôn sử dụng `ApiError` để ném lỗi từ tầng Service. Hệ thống Middleware sẽ tự động "bắt" và định dạng lại lỗi cho bạn.

---

## 📕 Danh mục Mã lỗi & Xử lý (Extended Error Catalog)

Dưới đây là bảng tra cứu chi tiết các lỗi nghiệp vụ thường gặp trong hệ thống:

| HTTP Code | Error Message               | Nguyên nhân & Giải pháp                                                          |
| :-------- | :-------------------------- | :------------------------------------------------------------------------------- |
| `400`     | `VALIDATION_ERROR`          | Dữ liệu không khớp với Schema. Kiểm tra lại định dạng email, độ dài mật khẩu,... |
| `400`     | `INVALID_FILE_TYPE`         | Bạn đang upload file không được hỗ trợ (chỉ nhận JPG, PNG, PDF).                 |
| `401`     | `TOKEN_EXPIRED`             | Access Token đã hết hạn. Hãy sử dụng Refresh Token để lấy token mới.             |
| `401`     | `INVALID_CREDENTIALS`       | Sai email hoặc mật khẩu đăng nhập.                                               |
| `403`     | `INSUFFICIENT_PERMISSIONS`  | Tài khoản của bạn không được cấp quyền thực hiện hành động này.                  |
| `404`     | `USER_NOT_FOUND`            | ID người dùng cung cấp không tồn tại trong hệ thống.                             |
| `404`     | `SLOT_NOT_FOUND`            | Ca trực nhật bạn đang tìm kiếm đã bị xóa hoặc không tồn tại.                     |
| `409`     | `EMAIL_ALREADY_EXISTS`      | Email này đã được sử dụng cho một tài khoản khác.                                |
| `409`     | `DUTY_ALREADY_REGISTERED`   | Bạn đã đăng ký ca trực này rồi, không thể đăng ký thêm.                          |
| `429`     | `RATE_LIMIT_EXCEEDED`       | Bạn gửi yêu cầu quá nhanh. Hãy đợi 15 phút trước khi thử lại.                    |
| `500`     | `DATABASE_CONNECTION_ERROR` | Server mất kết nối với MongoDB. Hãy kiểm tra lại DATABASE_URL.                   |
| `500`     | `MAIL_SERVER_ERROR`         | Lỗi khi gửi OTP qua SMTP. Hãy kiểm tra lại cấu hình mail.                        |

---

## 💎 Cẩm nang Payload API (Request/Response Snippets)

Dưới đây là ví dụ thực tế về cấu trúc dữ liệu khi giao tiếp với API:

### 1. Đăng nhập (Auth Login)

**Request:**

```json
{
  "email": "admin@gmail.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "65f1a2b3c4d5e6f7g8h9",
      "fullName": "Nguyen Van Admin",
      "email": "admin@gmail.com",
      "role": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Đăng ký kíp trực (Duty Registration)

**Request:**

```json
{
  "note": "Tôi xin trực thay cho bạn A"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Đăng ký kíp trực thành công",
  "data": {
    "slotId": "65f2b3c4d5e6f7g8h9i0",
    "status": "confirmed",
    "registeredAt": "2024-05-01T08:00:00.000Z"
  }
}
```

### 3. Tạo thông báo mới (Admin Notification)

**Request:**

```json
{
  "recipient": "all",
  "title": "Thông báo họp khẩn",
  "content": "Toàn thể thành viên có mặt tại văn phòng lúc 14h chiều nay.",
  "type": "urgent"
}
```

---

## 💎 Cẩm nang Payload API mở rộng (Full Module Snippets)

Dưới đây là các bộ Payload chuẩn cho các module nâng cao, giúp Frontend tích hợp nhanh chóng:

### 4. Quản lý Học kỳ (Create Semester)

```json
{
  "name": "Học kỳ 1 - 2024",
  "startDate": "2024-09-01",
  "endDate": "2025-01-15",
  "isDefault": true
}
```

### 5. Khóa / Thế hệ (Create Generation)

```json
{
  "name": "Khóa 65",
  "code": "K65",
  "description": "Thành viên nhập học năm 2024"
}
```

### 6. Chấm điểm thi đua (Reward/Penalty)

```json
{
  "userId": "65f1a2b3...",
  "points": 10,
  "reason": "Hoàn thành xuất sắc nhiệm vụ tuần 12",
  "category": "discipline"
}
```

### 7. Xuất báo cáo (Export Request)

```json
{
  "module": "duty",
  "format": "excel",
  "filter": {
    "semesterId": "65f2b3c4...",
    "type": "summary"
  }
}
```

### 8. Cập nhật quyền hạn vai trò (Role Permissions)

```json
{
  "permissions": ["users:list", "users:view", "duty:register", "meetings:rsvp"]
}
```

---

Hệ thống cung cấp khả năng giao tiếp hai chiều. Để lắng nghe thông báo, Client cần thực hiện:

1. **Kết nối:**
   ```javascript
   const socket = io('http://localhost:3000', {
     auth: { token: 'YOUR_ACCESS_TOKEN' },
   });
   ```
2. **Lắng nghe thông báo cá nhân:**
   ```javascript
   socket.on('notification:new', (data) => {
     console.log('Bạn có thông báo mới:', data.title);
     // Hiển thị toast hoặc cập nhật UI
   });
   ```
3. **Tham gia Room theo Module:**
   ```javascript
   socket.emit('room:join', 'duty_updates');
   ```

## 🔐 Cơ chế Bảo mật chuyên sâu (Security Architecture)

Hệ thống được thiết kế với tư duy **Security-by-Design**:

- **JWT Rotation**: Sử dụng Access Token ngắn hạn và Refresh Token dài hạn để giảm thiểu rủi ro khi bị lộ token.
- **CSRF Protection**: Áp dụng cho các route nhạy cảm để ngăn chặn tấn công giả mạo yêu cầu.
- **SQL/NoSQL Injection**: Toàn bộ tham số URL và Body đều được sanitize qua Mongoose ODM.
- **XSS Mitigation**: Sử dụng các header bảo mật (Helmet.js) để ngăn chặn mã độc thực thi trên trình duyệt.
- **Sensitive Data Masking**: Tự động ẩn các trường nhạy cảm như `password` trong các phản hồi API.

## 🤝 Quy chuẩn Đóng góp (Contributor Guide)

### 1. Git Workflow

- Nhánh `main`: Chứa mã nguồn ổn định nhất (Production).
- Nhánh `develop`: Nơi tập kết code từ các tính năng mới.
- Nhánh `feature/*`: Phát triển tính năng mới.
- Nhánh `hotfix/*`: Sửa lỗi khẩn cấp.

### 2. Commit Naming (Conventional Commits)

- `feat`: Tính năng mới.
- `fix`: Sửa lỗi.
- `docs`: Thay đổi tài liệu.
- `refactor`: Tối ưu hóa code.
- `chore`: Cập nhật build, dependencies.

## 📚 Từ điển Thuật ngữ & Khái niệm (Comprehensive Glossary)

Bảng tra cứu các thuật ngữ kỹ thuật và nghiệp vụ sử dụng trong toàn bộ hệ thống:

| Thuật ngữ         | Ý nghĩa kỹ thuật              | Ứng dụng trong dự án                                                |
| :---------------- | :---------------------------- | :------------------------------------------------------------------ |
| **RBAC**          | Role-Based Access Control     | Phân quyền dựa trên Vai trò (Admin, Member).                        |
| **JWT**           | JSON Web Token                | Phương thức truyền tin bảo mật giữa Client và Server.               |
| **Payload**       | Phần dữ liệu hữu ích          | Dữ liệu gửi đi trong Request hoặc nhận về trong Response.           |
| **Endpoint**      | Điểm cuối của API             | Đường dẫn URL để truy cập một tài nguyên (vd: `/api/users`).        |
| **Middleware**    | Phần mềm trung gian           | Các bộ lọc xử lý Request trước khi vào Controller.                  |
| **Schema**        | Lược đồ dữ liệu               | Định nghĩa cấu trúc của một thực thể trong MongoDB.                 |
| **ODM**           | Object Data Modeling          | Thư viện ánh xạ Object trong code vào Document trong DB (Mongoose). |
| **Repository**    | Kho lưu trữ                   | Tầng trừu tượng hóa các thao tác với Cơ sở dữ liệu.                 |
| **Service**       | Tầng nghiệp vụ                | Nơi chứa logic xử lý chính của ứng dụng.                            |
| **Controller**    | Tầng điều khiển               | Tiếp nhận Request, điều phối Service và trả về Response.            |
| **Sanitization**  | Làm sạch dữ liệu              | Loại bỏ các ký tự nguy hiểm để chống tấn công XSS/Injection.        |
| **Bearer Token**  | Token mang theo               | Loại token gắn vào Header `Authorization` để xác thực.              |
| **Refresh Token** | Token làm mới                 | Dùng để lấy Access Token mới mà không cần đăng nhập lại.            |
| **Audit Log**     | Nhật ký kiểm toán             | Lưu vết các hành động nhạy cảm để phục vụ hậu kiểm.                 |
| **CORS**          | Cross-Origin Resource Sharing | Cơ chế cho phép/chặn các domain khác truy cập API.                  |
| **Bcrypt**        | Thuật toán băm                | Dùng để mã hóa mật khẩu một chiều một cách an toàn.                 |
| **Slot**          | Ca/Kíp                        | Đơn vị thời gian nhỏ nhất trong hệ thống Trực nhật.                 |
| **RSVP**          | Xác nhận tham gia             | Trạng thái phản hồi cho các lời mời họp.                            |

---

## 🔄 Hướng dẫn di chuyển dữ liệu (Migration Guide)

Hệ thống cho phép chuyển đổi linh hoạt giữa lưu trữ file JSON và MongoDB Atlas mà không thay đổi code nghiệp vụ.

### Chuyển từ JSON sang MongoDB:

1. **Dọn dẹp dữ liệu:** Kiểm tra file trong `database/data/*.json`.
2. **Cập nhật .env:**
   ```env
   DB_CONNECTION=mongodb
   DATABASE_URL=mongodb+srv://user:pass@cluster0.mongodb.net/dbname
   ```
3. **Chạy script đồng bộ:**
   ```bash
   npm run db:sync
   ```
   _Script này sẽ đọc toàn bộ JSON và đẩy vào MongoDB Atlas theo đúng cấu trúc Schema._

---

## 🧪 Quy chuẩn Kiểm thử (Testing Strategy)

Mọi tính năng quan trọng đều cần được bao phủ bởi Unit Test để đảm bảo tính ổn định lâu dài.

- **Vị trí:** `src/modules/<module_name>/tests/`
- **Công cụ:** Jest kết hợp với Supertest.
- **Quy tắc:**
  - Test tầng **Service**: Mock Repository để kiểm tra logic nghiệp vụ.
  - Test tầng **Controller**: Sử dụng Supertest để kiểm tra Endpoint và Middleware.

```typescript
// Ví dụ test Service
describe('UserService', () => {
  it('should hash password before creating user', async () => {
    const userData = { email: 'test@gmail.com', password: '123' };
    const user = await userService.create(userData);
    expect(user.password).not.toBe('123');
  });
});
```

---

## 📜 Nhật ký Thay đổi (Project Changelog)

### Version 2.0.0 (Hiện tại)

- **Kiến trúc:** Chuyển đổi hoàn toàn sang Modular Layered Architecture.
- **Tính năng:** Tích hợp Socket.io cho thông báo thời gian thực.
- **Bảo mật:** Triển khai hệ thống RBAC động (Dynamic RBAC).
- **Tối ưu:** Dọn dẹp 300k dòng code rác và tối ưu Git History.
- **Tài liệu:** Tự động hóa Swagger Documentation cho 100% Endpoints.

### Version 1.5.0

- **Database:** Hỗ trợ song song JSON và MongoDB qua lớp Adapter.
- **Mail:** Tích hợp hệ thống gửi OTP qua Gmail SMTP.
- **Files:** Hỗ trợ upload ảnh trực tiếp lên Cloudinary.

---

## 🛠️ Đặc tả chi tiết từng tệp tin hạ tầng (Full File Spec)

Dưới đây là bản danh sách "phẫu thuật" toàn bộ mã nguồn Base của dự án:

### Thư mục `src/shared/common/`

- `base-controller.ts`: Định nghĩa các phương thức trả về dữ liệu đồng nhất.
- `base-service.ts`: Chứa logic lõi về xử lý phân trang và toán tử lọc URL.
- `entity-schema.service.ts`: Dịch vụ hỗ trợ xử lý các Schema động và validation.

### Thư mục `src/middleware/`

- `auth.middleware.ts`: Giải mã JWT, xác thực người dùng và gán vào `req.user`.
- `rbac.middleware.ts`: Đối soát quyền hạn của user với yêu cầu của endpoint.
- `error-transform.middleware.ts`: Bắt mọi ngoại lệ và chuyển đổi thành JSON chuẩn.
- `http-response.middleware.ts`: Tự động đóng gói kết quả trả về vào object `success: true`.

### Thư mục `src/utils/`

- `api-error.ts`: Định nghĩa lớp lỗi có kèm mã trạng thái HTTP.
- `query-helpers.ts`: Phân tích chuỗi query trên URL thành object truy vấn MongoDB.
- `logger.ts`: Cấu hình Winston để ghi log theo file và console chuyên nghiệp.

### Thư mục `src/types/` (Hệ thống định nghĩa kiểu)

- `common.ts`: Chứa các Interface dùng chung như `IPagination`, `IQueryOptions`.
- `express.d.ts`: Mở rộng Interface `Request` của Express để hỗ trợ `req.user`, `req.role`.
- `database.ts`: Định nghĩa các kiểu dữ liệu liên quan đến kết nối và adapter DB.
- `schema.ts`: Các Interface mô tả cấu trúc dữ liệu cho Mongoose.

### Thư mục `src/database/` (Tầng dữ liệu)

- `db.adapter.ts`: Lớp trừu tượng cho phép chuyển đổi giữa JSON và MongoDB.
- `json-adapter.ts`: Xử lý lưu trữ dữ liệu dưới dạng file vật lý.
- `mongo-adapter.ts`: Quản lý kết nối và pool của MongoDB Atlas.

### Thư mục `src/scripts/` (Tự động hóa)

- `seed-rbac.ts`: Script khởi tạo hệ thống quyền hạn phức tạp cho lần đầu chạy.
- `create-user.ts`: Công cụ CLI hỗ trợ tạo tài khoản Admin nhanh chóng.
- `sync-mongo-to-json.ts`: Hỗ trợ di chuyển dữ liệu giữa các môi trường khác nhau.

---

## ⚡ Kiến trúc Real-time Chuyên sâu (Socket.io Deep-Dive)

Hệ thống Real-time không chỉ đơn thuần là gửi tin nhắn, mà là một hạ tầng đồng bộ trạng thái:

### 1. Quản lý Phòng (Room Management)

- **User Room (`user_<id>`)**: Mỗi thành viên khi kết nối sẽ tự động tham gia vào phòng cá nhân. Mọi thông báo riêng tư sẽ được đẩy vào đây.
- **Role Room (`role_<name>`)**: Các phòng dành cho từng vai trò (Admin, Manager) để đẩy thông báo quản trị hàng loạt.
- **Feature Room (`duty_global`, `meeting_update`)**: Các phòng dành cho tính năng cụ thể để cập nhật dữ liệu UI ngay lập tức.

### 2. Luồng xử lý sự kiện (Event Lifecycle)

- **Emit từ Server:** Khi một bản ghi được tạo (vd: Slot trực nhật), `BaseService` sẽ gọi `SocketService` để phát tín hiệu.
- **Lắng nghe từ Client:** Frontend cập nhật Store (Redux/Zustand) mà không cần người dùng tải lại trang.

---

## 📐 Quy chuẩn Lập trình & Sạch hóa mã nguồn (Coding Standards)

Dự án tuân thủ nghiêm ngặt các quy tắc để đảm bảo bất kỳ lập trình viên nào cũng có thể đọc hiểu code của nhau:

- **Nguyên tắc SOLID:** Đảm bảo mỗi lớp, mỗi hàm chỉ làm một nhiệm vụ duy nhất.
- **DRY (Don't Repeat Yourself):** Tận dụng tối đa các lớp Base và Shared Utils.
- **Fail-Fast:** Kiểm tra dữ liệu đầu vào ngay tại Middleware, nếu sai thì ngắt Request và báo lỗi ngay.
- **Naming Standard:**
  - Biến/Hàm: `camelCase` (vd: `calculateBonusPoints`).
  - Lớp/Giao diện: `PascalCase` (vd: `UserService`).
  - Tệp tin: `kebab-case` (vd: `auth-middleware.ts`).
- **Comments:** Chỉ comment vào các logic nghiệp vụ phức tạp, code phải tự mang tính giải thích (Self-explanatory).

---

## 📖 Tài liệu API Chi tiết (Swagger UI)

Thay vì liệt kê thủ công các Endpoint (vốn rất dễ bị thiếu sót khi hệ thống cập nhật), dự án sử dụng **Swagger UI** để tự động tạo tài liệu API tương tác. Tại đây, bạn có thể xem đầy đủ Method, Path, Request Body và Response Schema của **100% các Module** trong hệ thống.

- **Đường dẫn truy cập:** `http://localhost:<PORT>/api-docs`
- **Tính năng:** Thử nghiệm API trực tiếp, xem ví dụ Payload chuẩn, tra cứu Permission yêu cầu cho từng Endpoint.

---

---

## 🛠️ Danh mục Khắc phục sự cố (Troubleshooting)

| Vấn đề                       | Nguyên nhân phổ biến                                        | Giải pháp                                                                   |
| :--------------------------- | :---------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **Socket connection failed** | Sai cấu hình CORS hoặc thiếu Handshake Token.               | Kiểm tra `CORS_ORIGIN` và đảm bảo Client gửi Token trong `auth`.            |
| **JSON Data lost**           | Tiến trình Node.js bị tắt đột ngột khi đang ghi file.       | Đảm bảo server chạy qua PM2 và cân nhắc chuyển sang MongoDB cho Production. |
| **JWT Invalid Signature**    | `JWT_SECRET` bị thay đổi hoặc không khớp giữa các instance. | Kiểm tra lại file `.env` và đảm bảo Secret đủ độ phức tạp.                  |
| **Rate Limit Triggered**     | Client gửi quá nhiều request OTP/Login.                     | Đợi hết thời gian `windowMs` hoặc điều chỉnh tham số trong `.env`.          |

---

## 🏗️ Đặc tả hạ tầng tệp tin (Infrastructure Deep-Dive)

### 📂 Lớp Shared (src/shared/common)

Tầng này đảm bảo tính thống nhất của toàn bộ hệ thống:

- `base-controller.ts`: Chứa logic chuẩn hóa `success: true/false` và mã trạng thái HTTP.
- `base-service.ts`: "Trái tim" xử lý dữ liệu, nơi tích hợp tự động phân trang và lọc dữ liệu.
- `base-repository.ts`: Lớp trừu tượng giúp bạn gọi `this.model.find()` một cách an toàn.

### 📂 Lớp Middleware (src/middleware)

- `auth.middleware.ts`: Bảo vệ Endpoint, chỉ cho phép người dùng có Token hợp lệ đi qua.
- `rbac.middleware.ts`: "Cánh cửa" cuối cùng, kiểm tra xem User có quyền thực hiện hành động cụ thể không.
- `error-transform.middleware.ts`: Chuyển đổi mọi lỗi hệ thống thành định dạng JSON thân thiện với Frontend.

---

## 👥 Đóng góp & Bản quyền
