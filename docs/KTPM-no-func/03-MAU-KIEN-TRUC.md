# 📘 Chương 3: Mẫu kiến trúc (Architectural Patterns)

## 3.1 N-Layered Architecture (Kiến trúc phân tầng)

### Khái niệm

Chia ứng dụng thành **các tầng (layer) xếp chồng**, mỗi tầng có trách nhiệm riêng. Tầng trên chỉ gọi tầng ngay bên dưới.

```
┌─────────────────────────────────────┐
│       Presentation Layer            │  ← UI, API Controller
│       (Tầng trình bày)              │
├─────────────────────────────────────┤
│       Business Logic Layer          │  ← Xử lý nghiệp vụ
│       (Tầng nghiệp vụ)             │
├─────────────────────────────────────┤
│       Data Access Layer             │  ← Repository, ORM
│       (Tầng truy cập dữ liệu)      │
├─────────────────────────────────────┤
│       Database                      │  ← SQL, NoSQL
│       (Cơ sở dữ liệu)              │
└─────────────────────────────────────┘
```

### Flow hoạt động

```
Client Request
     │
     ▼
Presentation (Controller nhận request)
     │ gọi
     ▼
Business Logic (Service xử lý nghiệp vụ)
     │ gọi
     ▼
Data Access (Repository truy vấn DB)
     │
     ▼
Database (trả về dữ liệu)
     │
     ▼ (ngược lên)
Response trả về Client
```

### Ưu điểm ✅

- Dễ hiểu, dễ tổ chức code
- Tách biệt rõ ràng trách nhiệm
- Dễ test từng tầng
- Phù hợp đa số ứng dụng CRUD

### Nhược điểm ❌

- Phụ thuộc từ trên xuống → khó thay đổi tầng dưới
- Mọi request đều phải đi qua tất cả tầng (kể cả không cần)
- Tight coupling giữa Business và Data layer

---

## 3.2 MVC (Model - View - Controller)

### Khái niệm

Tách ứng dụng thành 3 thành phần:

- **Model**: Dữ liệu và nghiệp vụ
- **View**: Giao diện hiển thị
- **Controller**: Điều phối giữa Model và View

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │ Request
                           ▼
                    ┌──────────────┐
                    │  Controller  │──── Nhận input, điều phối
                    └──┬───────┬───┘
                       │       │
              Cập nhật │       │ Lấy dữ liệu
                       ▼       ▼
                ┌──────────┐  ┌──────────┐
                │  Model   │  │  View    │
                │ (Data +  │  │ (Giao   │
                │ Logic)   │  │  diện)   │
                └──────────┘  └──────────┘
```

### Flow hoạt động

```
1. User gửi request     → Controller nhận
2. Controller           → Gọi Model để xử lý dữ liệu
3. Model                → Trả kết quả về Controller
4. Controller           → Chọn View phù hợp
5. View                 → Render HTML/JSON trả về User
```

### Ưu điểm ✅

- Tách biệt UI và Logic rõ ràng
- Hỗ trợ nhiều View cho cùng 1 Model
- Phổ biến, nhiều framework hỗ trợ (Express, Spring MVC, ASP.NET MVC)
- Dễ bảo trì và phát triển song song (frontend/backend)

### Nhược điểm ❌

- Controller dễ bị phình to ("Fat Controller")
- View và Model có thể coupling ngầm
- Không phù hợp ứng dụng phức tạp với nhiều business logic

---

## 3.3 CQRS (Command Query Responsibility Segregation)

### Khái niệm

**Tách riêng** thao tác **đọc (Query)** và **ghi (Command)** thành 2 model riêng biệt, thậm chí có thể dùng 2 database riêng.

```
                    ┌─────────────┐
                    │   Client    │
                    └──┬──────┬───┘
                       │      │
              Command  │      │ Query
              (Ghi)    │      │ (Đọc)
                       ▼      ▼
            ┌──────────┐    ┌──────────┐
            │ Command  │    │  Query   │
            │  Model   │    │  Model   │
            │(Write DB)│    │(Read DB) │
            └────┬─────┘    └────┬─────┘
                 │               │
            ┌────▼─────┐   ┌────▼─────┐
            │ Write DB │   │ Read DB  │
            │ (Master) │──▶│(Replica) │
            └──────────┘   └──────────┘
                      Sync
```

### Flow hoạt động

**Command Flow (Ghi):**

```
User tạo đơn hàng → Command Handler → Validate → Write to Master DB → Publish Event
```

**Query Flow (Đọc):**

```
User xem danh sách → Query Handler → Read from Read DB → Return DTO
```

### Ưu điểm ✅

- **Tối ưu hiệu suất đọc/ghi riêng**: Read DB có thể dùng cấu trúc khác (denormalized)
- **Scale độc lập**: Scale read nhiều hơn write
- **Model đơn giản hơn**: Mỗi model chỉ phục vụ 1 mục đích
- **Kết hợp tốt với Event Sourcing**

### Nhược điểm ❌

- **Phức tạp hơn nhiều**: 2 model, sync dữ liệu giữa 2 DB
- **Eventual consistency**: Dữ liệu đọc có thể chưa cập nhật ngay
- **Overkill cho ứng dụng CRUD đơn giản**
- **Khó debug**: Trace qua cả command và query path

### Khi nào nên dùng CQRS?

- Hệ thống có **tỷ lệ đọc >> ghi** (VD: trang tin tức, e-commerce catalog)
- Cần **hiệu suất đọc cực cao**
- Kết hợp với **Event Sourcing** hoặc **Domain-Driven Design**

---

## 3.4 Clean Architecture

### Khái niệm

Kiến trúc do **Robert C. Martin (Uncle Bob)** đề xuất. Nguyên tắc cốt lõi: **dependency hướng vào trong** — tầng ngoài phụ thuộc tầng trong, tầng trong **không biết** tầng ngoài.

```
    ┌───────────────────────────────────────────────┐
    │              Frameworks & Drivers              │  ← Web, DB, UI
    │  ┌───────────────────────────────────────┐    │
    │  │         Interface Adapters             │    │  ← Controllers,
    │  │  ┌───────────────────────────────┐    │    │    Gateways,
    │  │  │       Application Layer       │    │    │    Presenters
    │  │  │  ┌───────────────────────┐   │    │    │
    │  │  │  │    Domain Layer       │   │    │    │  ← Use Cases
    │  │  │  │   (Entities)          │   │    │    │
    │  │  │  │                       │   │    │    │  ← Entities,
    │  │  │  └───────────────────────┘   │    │    │    Business Rules
    │  │  └───────────────────────────────┘    │    │
    │  └───────────────────────────────────────┘    │
    └───────────────────────────────────────────────┘

    Dependency Rule: ────────────▶ (hướng vào trong)
```

### Các tầng chi tiết

| Tầng                        | Trách nhiệm                   | Ví dụ                       |
| --------------------------- | ----------------------------- | --------------------------- |
| **Domain (Entities)**       | Business rules, entity        | User, Order, Product        |
| **Application (Use Cases)** | Logic ứng dụng, orchestration | CreateOrderUseCase          |
| **Interface Adapters**      | Chuyển đổi dữ liệu giữa tầng  | Controller, Repository Impl |
| **Frameworks & Drivers**    | Thư viện, framework bên ngoài | Express, MongoDB, React     |

### Dependency Injection (DI) trong Clean Architecture

**Vấn đề:** Application layer cần gọi Database, nhưng KHÔNG ĐƯỢC phụ thuộc vào Database.

**Giải pháp:** Dùng **Dependency Injection** — định nghĩa interface ở tầng trong, implement ở tầng ngoài.

```
  Application Layer              Infrastructure Layer
  ┌──────────────────┐           ┌────────────────────┐
  │ CreateUserUseCase│           │ MongoUserRepository │
  │                  │           │                     │
  │ Depends on:      │           │ Implements:         │
  │ IUserRepository  │◄──────────│ IUserRepository     │
  │ (interface)      │           │ (concrete class)    │
  └──────────────────┘           └────────────────────┘
         │                                ▲
         │   Inject at runtime            │
         └────────────────────────────────┘
```

```typescript
// Tầng Application - định nghĩa interface
interface IUserRepository {
  findById(id: string): Promise<User>;
  save(user: User): Promise<void>;
}

// Tầng Infrastructure - implement
class MongoUserRepository implements IUserRepository {
  async findById(id: string): Promise<User> {
    return await UserModel.findById(id);
  }
  async save(user: User): Promise<void> {
    await UserModel.create(user);
  }
}

// Tầng Application - Use Case (không biết MongoDB)
class CreateUserUseCase {
  constructor(private userRepo: IUserRepository) {} // DI

  async execute(data: CreateUserDto): Promise<User> {
    const user = new User(data);
    await this.userRepo.save(user);
    return user;
  }
}
```

### Flow hoạt động

```
HTTP Request
     │
     ▼
Controller (Interface Adapter)
     │ Chuyển DTO → Domain Object
     ▼
Use Case (Application Layer)
     │ Thực thi business logic
     │ Gọi Repository qua Interface
     ▼
Repository Implementation (Infrastructure)
     │ Truy vấn Database
     ▼
Database
     │
     ▼ (ngược lên)
Response DTO → Client
```

### Ưu điểm ✅

- **Domain độc lập** với framework/database → dễ thay thế công nghệ
- **Testable**: Mock interface → test không cần database thật
- **Linh hoạt**: Thay MongoDB bằng PostgreSQL chỉ cần viết lại Repository
- **Tuân thủ SOLID principles**

### Nhược điểm ❌

- **Boilerplate nhiều**: Interface, DTO, mapper cho từng thao tác
- **Quá phức tạp cho ứng dụng nhỏ**
- **Learning curve cao**: Cần hiểu DI, SOLID, abstraction
- **Over-engineering risk**: Dễ tạo quá nhiều abstraction không cần thiết

---

## 3.5 Bảng so sánh 4 mẫu kiến trúc

| Tiêu chí               | N-Layered               | MVC                          | CQRS                | Clean Architecture            |
| ---------------------- | ----------------------- | ---------------------------- | ------------------- | ----------------------------- |
| **Ý tưởng chính**      | Phân tầng từ trên xuống | Tách Model-View-Controller   | Tách đọc/ghi        | Dependency hướng vào trong    |
| **Độ phức tạp**        | ⭐ Thấp                 | ⭐⭐ Trung bình              | ⭐⭐⭐ Cao          | ⭐⭐⭐⭐ Rất cao              |
| **Phù hợp với**        | CRUD, ứng dụng đơn giản | Web app, API                 | Hệ thống read-heavy | Hệ thống lớn, domain phức tạp |
| **Testability**        | Trung bình              | Tốt                          | Tốt                 | Rất tốt                       |
| **Thay đổi công nghệ** | Khó                     | Trung bình                   | Trung bình          | Dễ                            |
| **Boilerplate**        | Ít                      | Trung bình                   | Nhiều               | Rất nhiều                     |
| **Framework phổ biến** | Traditional .NET, Java  | Express, Spring MVC, Laravel | MediatR, Axon       | NestJS, Spring Boot           |

### Khi nào chọn cái nào?

```
Dự án nhỏ, CRUD đơn giản ─────────────────▶ N-Layered
Web app cần tách UI/Logic ─────────────────▶ MVC
Hệ thống read-heavy, cần scale đọc ───────▶ CQRS
Hệ thống lớn, domain phức tạp, DDD ───────▶ Clean Architecture
```

---

> 📌 **Xem tiếp:** [Chương 4 - Mẫu thiết kế tạo dựng](./04-CREATIONAL-PATTERNS.md)
