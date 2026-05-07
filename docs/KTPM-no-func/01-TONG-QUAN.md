# 📘 Chương 1: Tổng quan Kiến trúc Phần mềm

## 1.1 Kiến trúc phần mềm là gì?

**Kiến trúc phần mềm (Software Architecture)** là tập hợp các **quyết định thiết kế cấp cao** về cách tổ chức hệ thống phần mềm, bao gồm:

- **Cấu trúc** (Structure): Cách chia hệ thống thành các thành phần (component)
- **Giao tiếp** (Communication): Cách các thành phần trao đổi dữ liệu với nhau
- **Ràng buộc** (Constraints): Các quy tắc, nguyên lý mà hệ thống phải tuân thủ
- **Đặc tính chất lượng** (Quality Attributes): Hiệu năng, bảo mật, khả năng mở rộng...

> 💡 **Ví dụ thực tế:** Kiến trúc phần mềm giống như bản thiết kế của một tòa nhà — nó quyết định số tầng, vị trí phòng, hệ thống điện nước... trước khi xây dựng.

---

## 1.2 Tại sao cần kiến trúc phần mềm?

| Lý do                   | Giải thích                                           |
| ----------------------- | ---------------------------------------------------- |
| **Quản lý độ phức tạp** | Chia hệ thống lớn thành các phần nhỏ, dễ hiểu hơn    |
| **Dễ bảo trì**          | Thay đổi một phần không ảnh hưởng phần còn lại       |
| **Khả năng mở rộng**    | Thêm tính năng mới mà không phải viết lại toàn bộ    |
| **Tái sử dụng**         | Các component có thể dùng lại ở nhiều dự án          |
| **Giao tiếp nhóm**      | Đội ngũ có chung "bản vẽ" để thảo luận và phát triển |

---

## 1.3 Phân biệt các khái niệm

```
┌─────────────────────────────────────────────────────┐
│              Kiến trúc phần mềm                     │
│  (Software Architecture)                            │
│  → Quyết định CẤP CAO về tổ chức hệ thống          │
│                                                     │
│  ┌───────────────────────────────────────────┐      │
│  │        Mẫu kiến trúc                      │      │
│  │  (Architectural Patterns)                  │      │
│  │  → Giải pháp tổ chức CẤU TRÚC tổng thể   │      │
│  │  VD: MVC, N-Layered, Clean Architecture   │      │
│  │                                            │      │
│  │  ┌─────────────────────────────────┐      │      │
│  │  │     Mẫu thiết kế                │      │      │
│  │  │  (Design Patterns)              │      │      │
│  │  │  → Giải pháp cho vấn đề        │      │      │
│  │  │    thiết kế CỤ THỂ, lặp lại    │      │      │
│  │  │  VD: Singleton, Observer...     │      │      │
│  │  └─────────────────────────────────┘      │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

---

## 1.4 Các phong cách kiến trúc chính

### 🏗️ 3 phong cách kiến trúc phổ biến

| Phong cách       | Mô tả ngắn                                    | Khi nào dùng                           |
| ---------------- | --------------------------------------------- | -------------------------------------- |
| **Monolith**     | Toàn bộ ứng dụng trong 1 khối duy nhất        | Dự án nhỏ, đội ngũ nhỏ, MVP            |
| **SOA**          | Chia thành các service lớn, giao tiếp qua ESB | Doanh nghiệp lớn, tích hợp hệ thống cũ |
| **Microservice** | Chia thành nhiều service nhỏ, độc lập         | Hệ thống lớn, cần scale linh hoạt      |

### 🧩 4 mẫu kiến trúc phổ biến

| Mẫu                    | Ý tưởng chính                                                 |
| ---------------------- | ------------------------------------------------------------- |
| **N-Layered**          | Chia ứng dụng thành các tầng (Presentation → Business → Data) |
| **MVC**                | Tách Model - View - Controller                                |
| **CQRS**               | Tách Command (ghi) và Query (đọc)                             |
| **Clean Architecture** | Dependency hướng vào trong, domain ở trung tâm                |

### 🔧 3 nhóm mẫu thiết kế (GoF)

| Nhóm                      | Mục đích                 | Ví dụ                       |
| ------------------------- | ------------------------ | --------------------------- |
| **Tạo dựng** (Creational) | Cách tạo đối tượng       | Singleton, Factory, Builder |
| **Cấu trúc** (Structural) | Cách liên kết đối tượng  | Adapter, Decorator, Facade  |
| **Hành vi** (Behavioral)  | Cách đối tượng tương tác | Observer, Strategy, Command |

---

## 1.5 Flow tổng quan của việc chọn kiến trúc

```
   Yêu cầu dự án
        │
        ▼
  ┌─────────────┐     Nhỏ, đơn giản     ┌────────────┐
  │ Đánh giá    │ ──────────────────────▶│ Monolith   │
  │ quy mô      │                        └────────────┘
  │ & yêu cầu   │     Trung bình,        ┌────────────┐
  │              │ ──── tích hợp ────────▶│ SOA        │
  │              │     hệ thống cũ        └────────────┘
  │              │     Lớn, cần           ┌────────────┐
  │              │ ──── scale cao ───────▶│Microservice│
  └─────────────┘                         └────────────┘
        │
        ▼
  Chọn Mẫu kiến trúc (MVC, N-Layer, Clean, CQRS)
        │
        ▼
  Áp dụng Design Patterns phù hợp
        │
        ▼
  Triển khai & Đánh giá
```

---

> 📌 **Xem tiếp:** [Chương 2 - So sánh Monolith vs SOA vs Microservice](./02-SO-SANH-KIEN-TRUC.md)
