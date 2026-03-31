# Kiến trúc hệ thống

## Kiến trúc được chọn

Dự án sử dụng **Modular Layered Architecture**.

Mỗi module nghiệp vụ là một khối độc lập tương đối, và bên trong module được chia thành các tầng rõ ràng:

```txt
Route -> Controller -> Service -> Repository -> Database
```

Trong phạm vi hiện tại của dự án, đây là lựa chọn phù hợp vì:

- Bám sát cấu trúc code đang có, không phải refactor cực lớn.
- Dễ đọc, dễ bảo trì, dễ onboarding cho người mới.
- Phù hợp với backend CRUD có thêm business rules, phân quyền, import/export, upload.
- Giúp tách rõ HTTP layer, nghiệp vụ, và truy cập dữ liệu.

## Nguyên tắc tổ chức

### 1. Chia theo module nghiệp vụ

Mỗi tính năng chính được đặt trong một module riêng:

- `auth`
- `users`
- `duty`
- `files`
- `notifications`
- `reward-penalties`
- `reports`

Mục tiêu là để logic của từng nghiệp vụ nằm gần nhau, thay vì tách toàn bộ controller/service/repository ra thành các thư mục toàn cục.

### 2. Bên trong module chia theo tầng

Một module chuẩn nên có các thư mục sau:

```txt
module/
  routes/
  controllers/
  services/
  repositories/
  schemas/
```

Ý nghĩa từng tầng:

- `routes`: khai báo endpoint và middleware cho từng API.
- `controllers`: nhận `req/res`, gọi service, không chứa business logic phức tạp.
- `services`: xử lý nghiệp vụ chính của module.
- `repositories`: truy cập dữ liệu, làm việc với database adapter.
- `schemas`: mô tả shape dữ liệu và validation rule.

## Trách nhiệm từng tầng

### Route

Route chỉ nên làm 3 việc:

- định nghĩa đường dẫn
- gắn middleware
- chuyển request sang controller

Route không nên chứa business logic.

### Controller

Controller chịu trách nhiệm:

- nhận input từ HTTP request
- gọi service tương ứng
- trả response

Controller không nên tự thao tác database và không nên chứa logic nghiệp vụ dài.

### Service

Service là nơi đặt nghiệp vụ chính:

- validate rule nghiệp vụ
- phối hợp nhiều repository
- xử lý before/after action
- thực hiện các flow như import, thống kê, cập nhật trạng thái, phân quyền nghiệp vụ

Trong codebase hiện tại, `BaseService` đang đóng vai trò service chung cho CRUD, còn từng module sẽ mở rộng thêm logic riêng khi cần.

### Repository

Repository là tầng truy cập dữ liệu:

- đọc dữ liệu
- ghi dữ liệu
- query/filter/count

Repository không nên chứa logic HTTP và không nên gánh nghiệp vụ cấp cao.

### Database

Database layer hiện tại đi qua `DatabaseAdapter`, với implementation MongoDB ở `src/database/`.

Điều này giúp repository không phụ thuộc trực tiếp vào chi tiết driver.

## Cấu trúc tổng thể hiện tại

```txt
src/
  server.ts
  routes/
    index.ts
  middleware/
  database/
  modules/
    auth/
    users/
    duty/
    files/
    notifications/
    reward-penalties/
    reports/
  shared/
    common/
    repositories/
    import-export/
    security/
  schemas/
  types/
  utils/
```

## Shared layer

Các thành phần dùng chung toàn hệ thống đặt trong `src/shared/`:

- `shared/common`: base classes như `BaseController`, `BaseService`
- `shared/repositories`: `BaseRepository`
- `shared/import-export`: logic dùng chung cho import/export
- `shared/security`: logic bảo mật dùng chung

Nguyên tắc:

- Chỉ đưa vào `shared` khi nó thực sự dùng lại ở nhiều module.
- Không đưa logic nghiệp vụ riêng của một module vào `shared`.

## Luồng xử lý chuẩn

Ví dụ với một API cập nhật người dùng:

```txt
users.routes.ts
  -> user.controller.ts
  -> user.service.ts
  -> users.repository.ts
  -> database adapter
```

Từng bước:

1. Route nhận request và gắn middleware `protect`, `checkPermission`, upload middleware nếu cần.
2. Controller đọc input và gọi service.
3. Service kiểm tra rule nghiệp vụ, chuẩn hoá dữ liệu, gọi repository.
4. Repository thao tác với database adapter.
5. Kết quả được trả ngược lên controller rồi trả về HTTP response.

## Quy ước phát triển tiếp theo

Để giữ đúng hướng `Modular Layered Architecture`, khi thêm mới hoặc refactor nên tuân theo các quy ước sau:

- Không đặt business logic dài trong controller.
- Không để route truy cập trực tiếp service của module khác theo kiểu chồng chéo khó kiểm soát.
- Không để repository gọi controller hoặc phụ thuộc vào HTTP layer.
- Mỗi module nên tự quản lý phần route/controller/service/repository của nó.
- Chỉ dùng `shared` cho các thành phần tái sử dụng thật sự.
- Nếu một service quá lớn, tách nhỏ theo nghiệp vụ con nhưng vẫn giữ trong tầng service của module đó.

## Định hướng cải tiến

Hiện tại kiến trúc đã phù hợp với hướng Modular Layered, nhưng có thể tiếp tục làm sạch theo các bước sau:

- Giảm bớt logic generic quá rộng trong `BaseService` nếu nó làm service con khó đọc.
- Tách service lớn thành các file nghiệp vụ nhỏ hơn trong cùng module.
- Chuẩn hoá DTO/request schema rõ ràng hơn ở từng module.
- Đồng bộ README, Swagger và cấu trúc thư mục thật để tài liệu không bị lệch so với code.

## Kết luận

Kiến trúc chuẩn của dự án là:

**Modular Layered Architecture**

Mỗi module nghiệp vụ được tổ chức theo các tầng:

**Route -> Controller -> Service -> Repository -> Database**

Đây là mẫu kiến trúc chính thức nên dùng để phát triển tiếp dự án.
