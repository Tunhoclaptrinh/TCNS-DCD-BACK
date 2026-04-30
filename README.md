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

## 🔍 Hệ thống truy vấn API nâng cao (Universal Query Guide)

Hệ thống cung cấp một bộ tham số URL mạnh mẽ, giúp Frontend linh hoạt tuyệt đối trong việc lọc, sắp xếp và phân trang dữ liệu mà không cần Backend viết thêm code.

### 1. Phân trang & Điều hướng (Pagination)

| Tham số  | Ý nghĩa                           | Ví dụ              |
| :------- | :-------------------------------- | :----------------- |
| `_page`  | Trang cần lấy (mặc định: 1)       | `?_page=2`         |
| `_limit` | Số bản ghi/trang (mặc định: 10)   | `?_limit=50`       |
| `_sort`  | Trường sắp xếp                    | `?_sort=createdAt` |
| `_order` | Hướng (`asc` / `desc`)            | `?_order=desc`     |
| `_q`     | Tìm kiếm toàn văn (Global search) | `?_q=nguyen`       |

### 2. Các toán tử so sánh (Query Operators)

Bạn có thể kết hợp tên trường với các hậu tố để thực hiện lọc nâng cao:

- **`_like`**: Tìm kiếm chứa chuỗi (vd: `fullName_like=An`).
- **`_ilike`**: Tìm kiếm không phân biệt hoa thường (vd: `email_ilike=USER`).
- **`_gte` / `_lte`**: Lớn hơn hoặc bằng / Nhỏ hơn hoặc bằng (vd: `age_gte=18`).
- **`_gt` / `_lt`**: Lớn hơn hẳn / Nhỏ hơn hẳn.
- **`_ne`**: Khác (Not equal) (vd: `status_ne=deleted`).
- **`_in`**: Nằm trong danh sách (vd: `role_in=admin,manager`).
- **`_nin`**: Không nằm trong danh sách.

---

## 📖 Đặc tả Endpoint theo Module (Full API Spec)

### 1. Module Xác thực (Auth)

- `POST /api/auth/login`: Đăng nhập.
- `POST /api/auth/logout`: Đăng xuất.
- `GET /api/auth/me`: Lấy thông tin cá nhân.
- `PUT /api/auth/change-password`: Đổi mật khẩu.
- `POST /api/auth/forgot-password`: Yêu cầu OTP quên mật khẩu.
- `POST /api/auth/reset-password`: Đặt lại mật khẩu qua OTP.

### 2. Module Thành viên (Users)

- `GET /api/users`: Danh sách thành viên (Hỗ trợ full Query Operators).
- `POST /api/users`: Tạo thành viên mới (Admin).
- `GET /api/users/:id`: Xem profile chi tiết.
- `PUT /api/users/:id`: Cập nhật thông tin.
- `DELETE /api/users/:id`: Xóa mềm thành viên.
- `POST /api/users/import`: Nhập dữ liệu hàng loạt từ Excel.

### 3. Module Trực nhật (Duty)

- `GET /api/duty/week`: Lịch trực theo tuần.
- `POST /api/duty/slots`: Tạo ca trực mới.
- `PATCH /api/duty/slots/:id/register`: Đăng ký trực.
- `POST /api/duty/swaps`: Yêu cầu đổi ca trực.

### 4. Module Cuộc họp (Meetings)

- `GET /api/meetings`: Danh sách lịch họp.
- `POST /api/meetings`: Lên lịch họp mới.
- `PATCH /api/meetings/:id/rsvp`: Phản hồi tham gia (RSVP).
- `POST /api/meetings/:id/minutes`: Lưu biên bản cuộc họp.

---

## ⚡ Kiến trúc Real-time (Socket.io)

Hệ thống sử dụng Socket.io để đẩy thông báo tức thời đến Client.

### Các sự kiện chính (Events):

1. **`notification:new`**: Đẩy thông báo mới cho người dùng.
2. **`duty:slot_update`**: Cập nhật trạng thái ca trực khi có biến động.
3. **`meeting:reminder`**: Nhắc nhở lịch họp tự động.

---

## 🛡️ Bảo mật & Tiêu chuẩn (Security Hardening)

- **Password Hashing**: Bcrypt với salt rounds = 12.
- **Rate Limiting**: Chống brute-force cho các API nhạy cảm.
- **RBAC Guard**: Phân quyền chi tiết đến từng Resource và Action.
- **NoSQL Injection Protection**: Lọc dữ liệu đầu vào qua lớp Mongoose.
- **XSS Mitigation**: Chuẩn hóa và thoát chuỗi nguy hiểm trong Request Body.

---

## 🏗️ Hướng dẫn mở rộng hệ thống (Developer SOP)

Để thêm một module mới đúng chuẩn Base, hãy thực hiện các bước sau:

1. **Schema**: Định nghĩa cấu trúc dữ liệu trong thư mục `schemas/`.
2. **Repository**: Kế thừa `BaseRepository` để sử dụng các hàm CRUD có sẵn.
3. **Service**: Viết logic nghiệp vụ, kế thừa `BaseService` để có sẵn tính năng Phân trang/Filter.
4. **Controller**: Kế thừa `BaseController` để chuẩn hóa Response.
5. **Route**: Khai báo và gắn vào `src/routes/index.ts`.

---

## ❓ Câu hỏi thường gặp (FAQ)

**Q: Làm sao để dùng DB JSON thay vì MongoDB?**
A: Chỉnh `DB_CONNECTION=json` trong `.env`. Hệ thống sẽ tự động chuyển sang lưu trữ file vật lý trong thư mục `database/data`.

**Q: Tại sao tôi không gửi được Mail?**
A: Hãy đảm bảo bạn đã bật "App Password" cho tài khoản Gmail và điền đúng vào `SMTP_PASS`.

---

## 📊 Hệ thống Định nghĩa Dữ liệu (Full Data Schemas)

Dưới đây là đặc tả cấu trúc dữ liệu của các thực thể cốt lõi trong hệ thống.

### 1. Thực thể Người dùng (User Schema)

| Trường        | Kiểu dữ liệu    | Mô tả                                   |
| :------------ | :-------------- | :-------------------------------------- |
| `id`          | `ObjectId`      | Định danh duy nhất.                     |
| `email`       | `String`        | Email đăng nhập (Unique).               |
| `fullName`    | `String`        | Họ và tên đầy đủ.                       |
| `role`        | `String`        | Vai trò (admin, member, manager).       |
| `status`      | `String`        | Trạng thái (active, inactive, deleted). |
| `permissions` | `Array<String>` | Danh sách mã quyền hạn bổ sung.         |
| `avatar`      | `String`        | URL ảnh đại diện (Cloudinary).          |

### 2. Thực thể Kíp trực (DutySlot Schema)

| Trường      | Kiểu dữ liệu      | Mô tả                            |
| :---------- | :---------------- | :------------------------------- |
| `startTime` | `Date`            | Thời gian bắt đầu kíp trực.      |
| `endTime`   | `Date`            | Thời gian kết thúc kíp trực.     |
| `capacity`  | `Number`          | Số lượng thành viên tối đa.      |
| `members`   | `Array<ObjectId>` | Danh sách thành viên đã đăng ký. |
| `location`  | `String`          | Địa điểm trực nhật.              |

### 3. Thực thể Cuộc họp (Meeting Schema)

| Trường        | Kiểu dữ liệu    | Mô tả                                                   |
| :------------ | :-------------- | :------------------------------------------------------ |
| `title`       | `String`        | Tiêu đề cuộc họp.                                       |
| `description` | `String`        | Nội dung chi tiết cuộc họp.                             |
| `startTime`   | `Date`          | Thời gian bắt đầu.                                      |
| `endTime`     | `Date`          | Thời gian kết thúc dự kiến.                             |
| `location`    | `String`        | Phòng họp hoặc Link họp online.                         |
| `type`        | `String`        | Loại cuộc họp (internal, external, urgent).             |
| `status`      | `String`        | Trạng thái (scheduled, happening, finished, cancelled). |
| `attendees`   | `Array<Object>` | Danh sách người tham gia và trạng thái RSVP.            |

### 4. Thực thể Thông báo (Notification Schema)

| Trường      | Kiểu dữ liệu | Mô tả                                         |
| :---------- | :----------- | :-------------------------------------------- |
| `recipient` | `ObjectId`   | Người nhận thông báo.                         |
| `title`     | `String`     | Tiêu đề ngắn gọn.                             |
| `content`   | `String`     | Nội dung đầy đủ của thông báo.                |
| `type`      | `String`     | Phân loại (system, duty, meeting, bonus).     |
| `isRead`    | `Boolean`    | Đã đọc hay chưa.                              |
| `link`      | `String`     | Đường dẫn điều hướng khi click vào thông báo. |

### 5. Thực thể Vai trò (Role Schema)

| Trường        | Kiểu dữ liệu    | Mô tả                                            |
| :------------ | :-------------- | :----------------------------------------------- |
| `name`        | `String`        | Tên vai trò (vd: Admin, Moderator).              |
| `code`        | `String`        | Mã định danh vai trò (vd: `admin`).              |
| `permissions` | `Array<String>` | Tập hợp các Permission Keys gắn với vai trò này. |
| `description` | `String`        | Mô tả trách nhiệm của vai trò.                   |

### 6. Thực thể Đợt cộng điểm (BonusCampaign Schema)

| Trường      | Kiểu dữ liệu    | Mô tả                                |
| :---------- | :-------------- | :----------------------------------- |
| `name`      | `String`        | Tên chiến dịch (vd: Đợt ưu tú kỳ 1). |
| `semester`  | `ObjectId`      | Thuộc học kỳ nào.                    |
| `startDate` | `Date`          | Ngày bắt đầu nhận hồ sơ.             |
| `endDate`   | `Date`          | Ngày kết thúc xét duyệt.             |
| `criteria`  | `Array<Object>` | Danh sách các tiêu chí chấm điểm.    |

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

## 🏗️ Phân tích hạ tầng tệp tin (Project Infrastructure Spec)

Mô tả chi tiết vai trò của từng tệp tin cốt lõi trong bộ khung (Base) của hệ thống:

### Lõi khởi chạy (Core)

- **`src/index.ts`**: Nạp biến môi trường, bắt đầu lắng nghe cổng và quản lý vòng đời Server.
- **`src/server.ts`**: Cấu hình các middleware hệ thống như CORS, Body Parser, Helmet và tập kết Routes.
- **`src/routes/index.ts`**: "Bảng điều khiển trung tâm" định tuyến, kết nối URL với các module nghiệp vụ.

### Tầng Shared (Dùng chung)

- **`base-controller.ts`**: Chứa các phương thức `sendSuccess`, `sendError` giúp chuẩn hóa mọi phản hồi JSON.
- **`base-service.ts`**: Xử lý logic chung cho mọi module: Phân trang, Tìm kiếm, Sắp xếp và Lọc dữ liệu qua URL.
- **`base.repository.ts`**: Tầng giao tiếp Database, bọc lại các hàm Mongoose để bảo vệ dữ liệu và tái sử dụng code.

### Tiện ích & Công cụ (Utils)

- **`swagger.ts`**: Tự động tạo tài liệu API.
- **`logger.ts`**: Hệ thống ghi log (Winston) phân loại theo màu sắc và cấp độ (Info, Warn, Error).
- **`api-error.ts`**: Class xử lý lỗi tùy chỉnh, cho phép ném lỗi từ bất kỳ đâu trong code với mã HTTP tương ứng.
- **`query-helpers.ts`**: Bộ não đằng sau hệ thống lọc dữ liệu linh hoạt trên URL.

### 7. Thực thể Học kỳ (Semester Schema)

| Trường      | Kiểu dữ liệu | Mô tả                                      |
| :---------- | :----------- | :----------------------------------------- |
| `name`      | `String`     | Tên học kỳ (vd: Học kỳ 1 - 2024).          |
| `isDefault` | `Boolean`    | Có phải là học kỳ mặc định hiện tại không. |
| `startDate` | `Date`       | Ngày bắt đầu học kỳ.                       |
| `endDate`   | `Date`       | Ngày kết thúc học kỳ.                      |

### 8. Thực thể Khóa/Thế hệ (Generation Schema)

| Trường        | Kiểu dữ liệu | Mô tả                          |
| :------------ | :----------- | :----------------------------- |
| `name`        | `String`     | Tên khóa (vd: Khóa 65).        |
| `code`        | `String`     | Mã định danh khóa (vd: `K65`). |
| `description` | `String`     | Mô tả về thế hệ thành viên.    |

### 9. Thực thể Thưởng Phạt (RewardPenalty Schema)

| Trường     | Kiểu dữ liệu | Mô tả                                      |
| :--------- | :----------- | :----------------------------------------- |
| `user`     | `ObjectId`   | Thành viên bị áp dụng.                     |
| `points`   | `Number`     | Số điểm (Dương là thưởng, âm là phạt).     |
| `reason`   | `String`     | Lý do cụ thể.                              |
| `category` | `String`     | Phân loại (chuyên cần, kỷ luật, đóng góp). |
| `date`     | `Date`       | Ngày ghi nhận.                             |

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

## ⚡ Hướng dẫn tích hợp Real-time (Socket.io Guide)

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

---

### 1. Cấu hình Nginx (Reverse Proxy)

Sử dụng Nginx để điều hướng và bảo mật cho server Node.js:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Quản lý tiến trình bằng PM2

```bash
# Khởi chạy ứng dụng
pm2 start dist/index.js --name "base-backend"

# Theo dõi log
pm2 logs base-backend

# Tự động khởi chạy cùng hệ thống
pm2 startup
pm2 save
```

---

## 🔐 Cơ chế Bảo mật chuyên sâu (Security Architecture)

Hệ thống được thiết kế với tư duy **Security-by-Design**:

- **JWT Rotation**: Sử dụng Access Token ngắn hạn và Refresh Token dài hạn để giảm thiểu rủi ro khi bị lộ token.
- **CSRF Protection**: Áp dụng cho các route nhạy cảm để ngăn chặn tấn công giả mạo yêu cầu.
- **SQL/NoSQL Injection**: Toàn bộ tham số URL và Body đều được sanitize qua Mongoose ODM.
- **XSS Mitigation**: Sử dụng các header bảo mật (Helmet.js) để ngăn chặn mã độc thực thi trên trình duyệt.
- **Sensitive Data Masking**: Tự động ẩn các trường nhạy cảm như `password` trong các phản hồi API.

---

## 📚 Thuật ngữ Dự án (Glossary)

| Thuật ngữ      | Định nghĩa                                                      |
| :------------- | :-------------------------------------------------------------- |
| **RBAC**       | Role-Based Access Control - Phân quyền dựa trên vai trò.        |
| **JWT**        | JSON Web Token - Phương thức xác thực an toàn qua chuỗi mã hóa. |
| **OTP**        | One-Time Password - Mật khẩu sử dụng một lần để xác minh.       |
| **RSVP**       | Répondez s'il vous plaît - Xác nhận tham gia sự kiện/cuộc họp.  |
| **Audit Log**  | Nhật ký lưu vết mọi thay đổi dữ liệu nhạy cảm.                  |
| **Middleware** | Các bộ phận xử lý trung gian nằm giữa Request và Response.      |

---

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

### 4. Tạo cuộc họp mới (Create Meeting)

**Request:**

```json
{
  "title": "Họp chiến lược Quý 2",
  "startTime": "2024-06-01T09:00:00.000Z",
  "endTime": "2024-06-01T11:00:00.000Z",
  "location": "Phòng họp A1",
  "type": "internal"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "65f3c4d5e6f7g8h9i0j1",
    "title": "Họp chiến lược Quý 2",
    "status": "scheduled"
  }
}
```

---

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

## 🌐 Hướng dẫn Triển khai Production (Ops Manual)

### 1. Cấu hình Nginx tối ưu

```nginx
upstream backend_cluster {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name api.yoursite.com;

    location / {
        proxy_pass http://backend_cluster;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 2. Chiến lược Sao lưu (Backup Strategy)

Hệ thống khuyến nghị sao lưu tự động hàng ngày lúc 2h sáng:

- Sử dụng `mongodump` để nén dữ liệu.
- Đẩy file backup lên S3 hoặc Google Drive qua `rclone`.
- Lưu trữ tối thiểu 30 phiên bản gần nhất để có khả năng phục hồi thảm họa.

---

## 📚 Danh mục Quyền hạn (Full Permission Dictionary)

Hệ thống sở hữu danh sách quyền hạn chi tiết đến từng hành động nhỏ nhất:

| Mô-đun         | Mã quyền (Code)   | Mô tả chức năng                             |
| :------------- | :---------------- | :------------------------------------------ |
| **Thành viên** | `users:list`      | Xem danh sách toàn bộ thành viên.           |
|                | `users:create`    | Thêm thành viên mới vào tổ chức.            |
|                | `users:update`    | Chỉnh sửa thông tin cá nhân của người khác. |
|                | `users:delete`    | Quyền xóa thành viên (Admin cao cấp).       |
| **Trực nhật**  | `duty:view`       | Xem lịch trực toàn tổ chức.                 |
|                | `duty:register`   | Tự đăng ký kíp trực cho bản thân.           |
|                | `duty:manage`     | Tạo kíp trực, xóa kíp trực, duyệt đổi ca.   |
| **Họp hành**   | `meetings:create` | Lên lịch họp cho các nhóm.                  |
|                | `meetings:rsvp`   | Xác nhận tham gia và điểm danh.             |
|                | `meetings:admin`  | Quản lý biên bản và hủy cuộc họp.           |

---

Dự án được phát triển và duy trì bởi đội ngũ Project Team.

---

_© 2026 Project Team. All rights reserved._
