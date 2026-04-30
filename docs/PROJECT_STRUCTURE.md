# 📂 Full Directory & File Specification (Base Framework)

Tài liệu này cung cấp mô tả chi tiết đến từng tệp tin thuộc thành phần "Base" (hạ tầng) của hệ thống. Các tệp tin nghiệp vụ (Module-specific) sẽ được lược bớt để tập trung vào kiến trúc cốt lõi.

---

## 1. Cấu trúc thư mục Gốc (Root)

| Tệp tin         | Vai trò & Ý nghĩa                                                                                           |
| :-------------- | :---------------------------------------------------------------------------------------------------------- |
| `index.ts`      | **Entry Point:** Điểm khởi đầu của ứng dụng. Thực hiện import `server.ts` và bắt đầu lắng nghe cổng (Port). |
| `package.json`  | **Manifest:** Khai báo toàn bộ thư viện (dependencies), scripts vận hành và thông tin dự án.                |
| `tsconfig.json` | **Compiler Config:** Quy định cách TypeScript biên dịch sang JavaScript (strict mode, path alias,...).      |
| `.env`          | **Environment:** Lưu trữ các biến môi trường nhạy cảm (JWT Secret, MongoDB URI).                            |
| `.cursorrules`  | **AI Rules:** Tập hợp các quy tắc dành riêng cho AI assistant để đảm bảo code luôn đúng chuẩn của bạn.      |
| `nodemon.json`  | **Dev Watcher:** Cấu hình nodemon để tự động reload server khi phát hiện thay đổi trong `src`.              |

---

## 2. Thư mục Lõi (`src/`)

### 🛰️ Khởi tạo Hệ thống

- **`server.ts`**: Tệp tin quan trọng nhất. Nơi khởi tạo ứng dụng Express, kết nối Database, đăng ký các Middleware toàn cục và gắn các Routes chính.

### 🛡️ Thư mục `src/middleware/` (Các bộ lọc)

- **`auth.middleware.ts`**: Kiểm tra JWT. Nếu hợp lệ, giải mã payload và gắn vào `req.user`.
- **`rbac.middleware.ts`**: Kiểm tra quyền hạn (Role-based). Ngăn chặn truy cập nếu người dùng không có Permission Key tương ứng.
- **`error-transform.middleware.ts`**: "Màng lọc" lỗi cuối cùng. Chuyển đổi mọi Exception thành định dạng JSON đồng nhất trả về Client.
- **`http-response.middleware.ts`**: Chuẩn hóa cấu trúc Response thành công (Success wrapper).
- **`request-logger.middleware.ts`**: Ghi lại mọi Request đi qua Server vào console/log file để theo dõi (audit).
- **`normalize-request-body.middleware.ts`**: Xử lý và chuẩn hóa dữ liệu thô từ Client (trims, escapes).

---

### 🏛️ Thư mục `src/shared/` (Bộ khung kế thừa)

#### `shared/common/`

- **`base-controller.ts`**: Lớp trừu tượng (Abstract class) cung cấp các phương thức trả về dữ liệu chuẩn (`success`, `error`, `pagination`).
- **`base-service.ts`**: Chứa logic CRUD dùng chung, xử lý tìm kiếm (`search`), sắp xếp (`sort`) và phân trang (`paginate`) cho mọi module.
- **`entity-schema.service.ts`**: Dịch vụ hỗ trợ xử lý các Schema động.

#### `shared/repositories/`

- **`base.repository.ts`**: Trái tim của tầng dữ liệu. Chứa các hàm Mongoose bọc sẵn (`find`, `findById`, `create`, `update`, `delete`) giúp các Repository con không phải viết lại code truy vấn cơ bản.

#### `shared/import-export/`

- **`import-export.service.ts`**: Logic lõi để đọc/ghi file Excel/CSV, mapping dữ liệu từ file vào Database và ngược lại.

---

### 🛠️ Thư mục `src/utils/` (Công cụ hỗ trợ)

- **`swagger.ts`**: Khai báo và cấu hình Swagger UI. Chứa định nghĩa `ROUTE_DOCS` để tự động tạo tài liệu API.
- **`api-error.ts`**: Class tùy chỉnh kế thừa từ `Error`, cho phép ném lỗi kèm `statusCode`.
- **`logger.ts`**: Cấu hình thư viện Winston để ghi log ra file hoặc console theo level (info, error, warn).
- **`helpers.ts`**: Tập hợp các hàm nhỏ dùng nhiều nơi (format date, generate random string,...).
- **`schema-utils.ts`**: Các tiện ích hỗ trợ validate và chuyển đổi dữ liệu dựa trên Schema.
- **`query-helpers.ts`**: Hỗ trợ xây dựng các câu truy vấn MongoDB phức tạp từ URL Query parameters.

---

### 📝 Thư mục `src/types/` (Định nghĩa kiểu)

- **`express.d.ts`**: **Declaration Merging:** Mở rộng Interface `Request` của Express để có thể chứa thêm trường `user`, `role`, `semester`.
- **`database.ts`**: Định nghĩa các kiểu dữ liệu liên quan đến MongoDB và Models.
- **`common.ts`**: Các kiểu dữ liệu dùng chung toàn hệ thống (Pagination, Sort params).
- **`service.ts`**: Định nghĩa các Interface cho tầng Service.

---

### 🚀 Thư mục `src/scripts/` (Tự động hóa)

- **`seed-rbac.ts`**: Script khởi tạo danh sách vai trò và quyền hạn mặc định vào Database.
- **`create-user.ts`**: Script hỗ trợ tạo nhanh tài khoản Admin qua dòng lệnh.
- **`sync-mongo-to-json.ts`**: Công cụ đồng bộ dữ liệu giữa MongoDB và file JSON (phục vụ backup/dev).

---

## 🛣️ Luồng Routes (`src/routes/index.ts`)

Đây là "bảng điều khiển trung tâm" về định tuyến. Tệp này import mọi Routes từ các Modules (`auth.routes`, `user.routes`,...) và gắn chúng vào các tiền tố URL tương ứng (ví dụ `/api/v1/auth`).

---

_Bản đặc tả kỹ thuật - Cập nhật ngày 01/05/2026_
