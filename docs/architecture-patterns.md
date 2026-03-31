# Mẫu kiến trúc và mẫu thiết kế

## 1. Phân biệt hai khái niệm

### Mẫu kiến trúc là gì?

Mẫu kiến trúc (architectural pattern) là cách tổ chức **toàn hệ thống** ở mức cao:

- hệ thống chia thành những phần nào
- các phần phụ thuộc vào nhau ra sao
- luồng xử lý chính đi theo hướng nào
- trách nhiệm của từng tầng hoặc từng khối là gì

Mẫu kiến trúc trả lời câu hỏi:

> Toàn bộ backend này nên được tổ chức như thế nào?

### Mẫu thiết kế là gì?

Mẫu thiết kế (design pattern) là cách giải quyết **một vấn đề lặp lại ở mức lớp, module hoặc thành phần nhỏ**.

Ví dụ:

- truy cập dữ liệu nên bọc như thế nào
- luồng CRUD chung nên tái sử dụng ra sao
- cách tách phần phụ thuộc vào database thế nào

Mẫu thiết kế trả lời câu hỏi:

> Một bài toán kỹ thuật cụ thể trong code nên giải như thế nào?

## 2. Mẫu kiến trúc của dự án

### Mẫu chính thức

Dự án này sử dụng:

**Modular Layered Architecture**

Luồng chuẩn:

```txt
Route -> Controller -> Service -> Repository -> Database
```

### Ý nghĩa trong codebase hiện tại

- `modules/*`: chia theo từng nghiệp vụ như `auth`, `users`, `duty`, `files`
- `routes`: định nghĩa endpoint và middleware
- `controllers`: xử lý giao tiếp HTTP
- `services`: chứa logic nghiệp vụ
- `repositories`: đọc/ghi dữ liệu
- `database`: chi tiết implementation của database adapter

### Vì sao chọn mẫu này?

Mẫu này phù hợp với repo hiện tại vì:

- đúng với cấu trúc code đang có
- đủ rõ ràng cho backend CRUD có thêm business rule
- dễ maintain hơn việc nhảy ngay sang Clean Architecture đầy đủ
- dễ onboarding cho team

### Dự án này không phải gì?

Hiện tại dự án **không phải**:

- Clean Architecture hoàn chỉnh
- Hexagonal Architecture hoàn chỉnh
- Domain-Driven Design đầy đủ

Lý do là dependency flow và cách tổ chức code vẫn đang thiên về kiến trúc phân tầng theo module, chưa tách domain/application/infrastructure một cách chặt chẽ như các mô hình trên.

## 3. Các mẫu thiết kế đang dùng trong code

### 3.1 Repository Pattern

**Mục tiêu**:

- che giấu chi tiết truy cập dữ liệu
- tránh để service làm việc trực tiếp với database driver

**Áp dụng trong repo**:

- `src/shared/repositories/base.repository.ts`
- các repository theo module kế thừa hoặc dùng lại base này

**Vai trò**:

- service gọi repository
- repository gọi database adapter

Điều này giúp tầng nghiệp vụ không phụ thuộc trực tiếp vào Mongo hoặc JSON store.

### 3.2 Service Layer Pattern

**Mục tiêu**:

- tập trung business logic vào service
- giữ controller mỏng

**Áp dụng trong repo**:

- `src/shared/common/base-service.ts`
- các service trong `src/modules/*/services`

**Vai trò**:

- validate rule nghiệp vụ
- phối hợp repository
- xử lý flow create/update/delete/import/export/thống kê

Đây là pattern rất quan trọng trong dự án hiện tại.

### 3.3 Template Method Pattern

**Mục tiêu**:

- định nghĩa một khung xử lý chuẩn ở base class
- cho phép class con override từng bước nhỏ khi cần

**Áp dụng trong repo**:

- `src/shared/common/base-service.ts`

Ví dụ luồng `create/update/delete` trong `BaseService` có khung xử lý cố định:

```txt
validate schema
-> validate custom
-> before action
-> repository action
-> after action
```

Service con có thể override các hook như:

- `validateCreate`
- `validateUpdate`
- `validateDelete`
- `beforeCreate`
- `beforeUpdate`
- `beforeDelete`
- `afterCreate`
- `afterUpdate`
- `afterDelete`

Pattern này phù hợp cho CRUD dùng chung, nhưng không nên lạm dụng cho mọi nghiệp vụ phức tạp.

### 3.4 Adapter Pattern

**Mục tiêu**:

- tách code nghiệp vụ khỏi implementation cụ thể của database

**Áp dụng trong repo**:

- `src/types/database.ts` định nghĩa `DatabaseAdapter`
- các implementation trong `src/database/`

**Ý nghĩa**:

- repository chỉ cần biết interface adapter
- có thể thay implementation mà không buộc service phải đổi theo

### 3.5 Base Class Reuse ở Controller

Đây là cách tái sử dụng qua base class, không cần xem là mẫu thiết kế cốt lõi của hệ thống.

**Áp dụng trong repo**:

- `src/shared/common/base-controller.ts`

`BaseController` hiện cung cấp:

- CRUD handler mặc định
- `handle()` để gom `try/catch`
- `ok()` và `created()` để chuẩn hóa response cơ bản

Mục tiêu ở đây là giảm lặp trong HTTP layer, chứ không phải biến controller thành nơi chứa nghiệp vụ.

## 4. Bản đồ pattern trong dự án

| Cấp độ      | Pattern                      | Áp dụng ở đâu                                         | Mục tiêu chính                         |
| ----------- | ---------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Hệ thống    | Modular Layered Architecture | Toàn bộ `src/`                                        | Tổ chức backend theo module và tầng    |
| Module/lớp  | Repository Pattern           | `shared/repositories`, `modules/*/repositories`       | Tách truy cập dữ liệu                  |
| Module/lớp  | Service Layer                | `shared/common/base-service.ts`, `modules/*/services` | Gom business logic vào service         |
| Lớp         | Template Method              | `BaseService`                                         | Tái sử dụng flow CRUD có hook          |
| Hạ tầng     | Adapter Pattern              | `types/database.ts`, `database/*`                     | Tách repository khỏi DB implementation |
| HTTP helper | Base class reuse             | `BaseController`                                      | Giảm lặp trong controller              |

## 5. Cách áp dụng đúng khi phát triển tiếp

### Khi thêm API mới

- khai báo route trong `routes`
- controller chỉ đọc request và gọi service
- service xử lý nghiệp vụ
- repository xử lý truy cập dữ liệu

### Khi thêm logic mới

- nếu là nghiệp vụ: đặt trong service
- nếu là query đọc/ghi dữ liệu: đặt trong repository
- nếu là xử lý dùng lại nhiều nơi trong HTTP layer: xem xét thêm vào `BaseController`
- nếu là xử lý schema dùng chung: đặt trong `shared/common` hoặc service chuyên trách

### Khi không nên dùng base generic

Không nên cố ép mọi nghiệp vụ vào `BaseService` hoặc `BaseController` nếu:

- flow quá đặc thù
- logic riêng nhiều hơn logic chung
- việc kế thừa làm code khó đọc hơn viết thẳng

Nguyên tắc là:

> Chỉ generic hóa phần thật sự lặp lại.

## 6. Kết luận ngắn gọn

Nếu cần mô tả ngắn nhất về dự án này, có thể dùng câu sau:

> Dự án sử dụng **Modular Layered Architecture** ở cấp hệ thống, và dùng các design pattern chính gồm **Repository Pattern**, **Service Layer**, **Template Method** và **Adapter Pattern** để tổ chức code bên trong.
