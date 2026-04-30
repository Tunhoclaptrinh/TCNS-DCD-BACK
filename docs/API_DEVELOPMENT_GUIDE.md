# 📖 API Development Guide (Standard Operating Procedures)

Tài liệu này hướng dẫn cách phát triển và thêm mới tính năng vào hệ thống Backend theo đúng chuẩn kiến trúc hiện tại.

## 1. Quy trình thêm một Module mới

Nếu bạn cần tạo module `vouchers`, hãy tuân thủ các bước sau:

1. **Khởi tạo thư mục:** Tạo `src/modules/vouchers`.
2. **Định nghĩa Schema:** Tạo `schemas/voucher.schema.ts`.
3. **Tạo Repository:** Tạo `repositories/vouchers.repository.ts` kế thừa từ `BaseRepository`.
4. **Viết Service:** Tạo `services/voucher.service.ts` xử lý logic nghiệp vụ.
5. **Tạo Controller:** Tạo `controllers/voucher.controller.ts` kế thừa từ `BaseController`.
6. **Định nghĩa Routes:** Tạo `routes/voucher.routes.ts` và đăng ký vào `src/routes/index.ts`.
7. **Đăng ký Swagger:** Bổ sung mô tả API vào `src/utils/swagger.ts`.

---

## 2. Quy tắc đặt tên (Naming Conventions)

- **Files:** Sử dụng `kebab-case` (ví dụ: `user-access.service.ts`).
- **Classes:** Sử dụng `PascalCase` (ví dụ: `UserService`).
- **Functions/Variables:** Sử dụng `camelCase` (ví dụ: `getUserById`).
- **Endpoints:** Sử dụng `kebab-case` và danh từ số nhiều (ví dụ: `/api/bonus-campaigns`).

---

## 3. Quản lý Lỗi & Phản hồi

### Ném lỗi (Throwing Errors)

Luôn sử dụng class `ApiError` để ném lỗi kèm mã trạng thái HTTP:

```typescript
throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher không tồn tại');
```

### Trả về phản hồi (Response)

Sử dụng các phương thức có sẵn trong `BaseController` để đảm bảo định dạng JSON đồng nhất:

```typescript
return this.success(res, data, 'Lấy dữ liệu thành công');
```

---

## 4. Ghi Log (Logging)

Sử dụng `logger` từ `src/utils/logger.ts` thay vì `console.log`:

- `logger.info()`: Thông tin thông thường.
- `logger.error()`: Lỗi hệ thống cần theo dõi.
- `logger.warn()`: Các cảnh báo về logic.

---

## 5. Kiểm tra & Định dạng Code

Trước khi tạo Pull Request, bắt buộc phải chạy:

```bash
npm run format  # Tự động định dạng code bằng Prettier
npm run lint    # Kiểm tra lỗi cú pháp và tiêu chuẩn code
```

---

_Project Developer Experience (DevEx) Team_
