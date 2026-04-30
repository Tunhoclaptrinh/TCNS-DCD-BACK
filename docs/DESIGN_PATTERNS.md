# 🛠️ Design Patterns & Engineering Standards

Tài liệu này giải thích các mẫu thiết kế và tiêu chuẩn lập trình được áp dụng xuyên suốt dự án Backend.

## 1. Mô hình Service-Repository Pattern

Đây là kiến trúc cốt lõi giúp tách biệt hoàn toàn Logic nghiệp vụ và Logic truy cập dữ liệu.

### Tầng Repository (`src/modules/*/repositories`)

- **Nhiệm vụ:** Là lớp duy nhất tương tác trực tiếp với Mongoose Model.
- **Lợi ích:** Nếu tương lai hệ thống đổi từ MongoDB sang một DB khác, chúng ta chỉ cần sửa lớp Repository, tầng Service vẫn giữ nguyên.
- **BaseRepository:** Cung cấp các phương thức CRUD cơ bản (`find`, `create`, `update`, `delete`) giúp giảm thiểu code lặp lại.

### Tầng Service (`src/modules/*/services`)

- **Nhiệm vụ:** Chứa các quy tắc nghiệp vụ phức tạp. Gọi nhiều Repositories khác nhau để hoàn thành một tác vụ.
- **Ví dụ:** Khi một người dùng đăng ký kíp trực, `DutyService` sẽ gọi `DutyRepository` để cập nhật slot và gọi `NotificationService` để gửi thông báo.

---

## 2. Module-Based Structure (Tính đóng gói)

Dự án được chia theo các Module chức năng thay vì chia theo kỹ thuật (không dồn tất cả Controller vào một chỗ).

- **Cấu trúc mỗi Module:**
  - `controllers/`: Xử lý HTTP.
  - `services/`: Logic nghiệp vụ.
  - `repositories/`: Truy vấn dữ liệu.
  - `schemas/`: Định nghĩa dữ liệu.
  - `routes/`: Định nghĩa các Endpoint.

**Lợi ích:** Giúp nhiều lập trình viên làm việc song song trên các tính năng khác nhau mà không gây xung đột (Merge conflicts).

---

## 3. Base Classes & Inheritance

Để tối ưu hóa mã nguồn, hệ thống sử dụng các lớp cơ sở (Base Classes):

- **`BaseController`**: Chứa các phương thức chuẩn hóa phản hồi (Response formatting).
- **`BaseService`**: Chứa các logic dùng chung như phân trang (Pagination), tìm kiếm (Searching) và lọc (Filtering).

---

## 4. Middleware Pipeline Pattern

Xử lý yêu cầu thông qua một chuỗi các bước kiểm tra (Pipeline):
`Request` -> `Logger` -> `Auth` -> `Normalization` -> `Validation` -> `Controller`.

Cách tiếp cận này giúp code sạch sẽ và dễ dàng tái sử dụng các bộ lọc bảo mật.

---

## 5. DTO & Data Normalization

Hệ thống sử dụng các hàm chuẩn hóa (Mapping/Transform) trước khi trả dữ liệu về Client:

- Loại bỏ các trường nhạy cảm (như `password`).
- Chuyển đổi định dạng ngày tháng theo chuẩn ISO.
- Làm phẳng các cấu trúc Object phức tạp để Frontend dễ hiển thị.

---

_Project Architecture Team_
