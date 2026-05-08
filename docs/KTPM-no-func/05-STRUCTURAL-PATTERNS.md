# 📘 Chương 5: Mẫu thiết kế cấu trúc (Structural Design Patterns)

> **Mục đích:** Liên quan đến cách **liên kết các đối tượng thành một khối**, giúp các class/object phối hợp tạo thành cấu trúc lớn hơn mà vẫn linh hoạt và hiệu quả.

---

## 5.1 Adapter Pattern (Wrapper)

### Vấn đề

Cần sử dụng class có sẵn nhưng **interface không tương thích** với code hiện tại. Giống ổ cắm điện EU cần adapter để dùng ở VN.

### Giải pháp

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  Client  │────▶│  Adapter  │────▶│ Adaptee      │
│          │     │           │     │ (class cũ,   │
│ Gọi qua │     │ Chuyển đổi│     │  interface   │
│ interface│     │ interface │     │  khác)       │
│ mong muốn│     │           │     │              │
└──────────┘     └───────────┘     └──────────────┘
```

### Code minh họa

```typescript
// Hệ thống cũ (legacy) — interface khác
class OldPaymentSystem {
  makePayment(amount: number, currency: string): string {
    return `Old system: paid ${amount} ${currency}`;
  }
}

// Interface mới mà hệ thống hiện tại sử dụng
interface PaymentProcessor {
  pay(request: { amount: number; currency: string }): string;
}

// Adapter — chuyển đổi interface cũ sang mới
class PaymentAdapter implements PaymentProcessor {
  constructor(private oldSystem: OldPaymentSystem) {}

  pay(request: { amount: number; currency: string }): string {
    // Chuyển đổi interface
    return this.oldSystem.makePayment(request.amount, request.currency);
  }
}

// Client sử dụng interface mới, không cần biết hệ thống cũ
const adapter = new PaymentAdapter(new OldPaymentSystem());
adapter.pay({ amount: 100, currency: 'VND' });
```

### Ưu điểm ✅

- Tái sử dụng class cũ mà không sửa code
- Tách biệt logic chuyển đổi
- Tuân thủ Open/Closed Principle

### Nhược điểm ❌

- Thêm layer trung gian → tăng độ phức tạp

---

## 5.2 Decorator Pattern

### Vấn đề

Cần **thêm hành vi mới** cho object **tại runtime** mà không sửa class gốc và không dùng kế thừa.

### Giải pháp

```
┌───────────┐
│ Component │◄────────────────────────────┐
│(Interface)│                             │
├───────────┤                             │
│+operation()│                            │
└─────┬─────┘                             │
      │                                   │
┌─────▼─────────┐              ┌──────────▼────────┐
│ Concrete      │              │   Decorator       │
│ Component     │              │   (Abstract)      │
│               │              │ - component       │
│ operation()   │              │ + operation()     │
│ → base logic  │              │ → thêm hành vi   │
└───────────────┘              │ + component.op()  │
                               └────────┬──────────┘
                                        │
                          ┌─────────────┼──────────────┐
                    ┌─────▼──────┐              ┌──────▼──────┐
                    │DecoratorA  │              │DecoratorB   │
                    │+operation()│              │+operation() │
                    └────────────┘              └─────────────┘
```

### Code minh họa

```typescript
// Component interface
interface Logger {
  log(message: string): void;
}

// Base component
class ConsoleLogger implements Logger {
  log(message: string) {
    console.log(message);
  }
}

// Decorator: thêm timestamp
class TimestampDecorator implements Logger {
  constructor(private logger: Logger) {}

  log(message: string) {
    const timestamp = new Date().toISOString();
    this.logger.log(`[${timestamp}] ${message}`);
  }
}

// Decorator: thêm emoji theo mức độ
class EmojiDecorator implements Logger {
  constructor(
    private logger: Logger,
    private emoji: string,
  ) {}

  log(message: string) {
    this.logger.log(`${this.emoji} ${message}`);
  }
}

// Kết hợp nhiều decorator
let logger: Logger = new ConsoleLogger();
logger = new TimestampDecorator(logger); // Thêm timestamp
logger = new EmojiDecorator(logger, '🔥'); // Thêm emoji

logger.log('Server started');
// 🔥 [2026-05-07T12:00:00Z] Server started
```

### Ưu điểm ✅

- Thêm tính năng linh hoạt tại runtime
- Kết hợp nhiều decorator (composable)
- Không sửa class gốc

### Nhược điểm ❌

- Nhiều wrapper nhỏ → khó debug
- Thứ tự wrap ảnh hưởng kết quả

---

## 5.3 Facade Pattern

### Vấn đề

Hệ thống con (subsystem) quá phức tạp với nhiều class. Client cần **một interface đơn giản** để sử dụng.

### Giải pháp

```
┌──────────┐     ┌───────────────────────────────┐
│  Client  │────▶│           FACADE              │
│          │     │  (Interface đơn giản)          │
└──────────┘     └──┬──────────┬──────────┬──────┘
                    │          │          │
               ┌────▼───┐ ┌───▼────┐ ┌───▼────┐
               │SubSys A│ │SubSys B│ │SubSys C│
               │(phức   │ │(phức   │ │(phức   │
               │ tạp)   │ │ tạp)   │ │ tạp)   │
               └────────┘ └────────┘ └────────┘
```

### Code minh họa

```typescript
// Các subsystem phức tạp
class OrderService {
  createOrder(items: string[]) {
    return { id: 'ORD-001', items };
  }
}

class PaymentService {
  processPayment(orderId: string, amount: number) {
    return { status: 'paid', orderId, amount };
  }
}

class ShippingService {
  scheduleShipping(orderId: string, address: string) {
    return { tracking: 'TRACK-001', orderId, address };
  }
}

class NotificationService {
  sendEmail(email: string, message: string) {
    console.log(`📧 ${email}: ${message}`);
  }
}

// FACADE — gom tất cả vào 1 method đơn giản
class CheckoutFacade {
  constructor(
    private orderService = new OrderService(),
    private paymentService = new PaymentService(),
    private shippingService = new ShippingService(),
    private notificationService = new NotificationService(),
  ) {}

  checkout(items: string[], amount: number, address: string, email: string) {
    // 1. Tạo đơn hàng
    const order = this.orderService.createOrder(items);

    // 2. Thanh toán
    this.paymentService.processPayment(order.id, amount);

    // 3. Giao hàng
    const shipping = this.shippingService.scheduleShipping(order.id, address);

    // 4. Thông báo
    this.notificationService.sendEmail(email, `Đơn hàng ${order.id} đã được xử lý!`);

    return { orderId: order.id, tracking: shipping.tracking };
  }
}

// Client chỉ cần 1 dòng
const facade = new CheckoutFacade();
facade.checkout(['Laptop', 'Mouse'], 15000000, 'HCM', 'user@mail.com');
```

### Ưu điểm ✅

- Đơn giản hóa interface phức tạp
- Client không cần biết chi tiết bên trong
- Giảm coupling giữa client và subsystem

### Nhược điểm ❌

- Facade có thể trở thành "God Object"
- Ẩn đi sự phức tạp → khó customize

---

## 5.4 Proxy Pattern

### Vấn đề

Cần **kiểm soát truy cập** đến object gốc: thêm logging, caching, lazy loading, access control...

### Code minh họa

```typescript
interface ImageLoader {
  load(url: string): string;
}

// Object thật — tốn tài nguyên
class RealImageLoader implements ImageLoader {
  load(url: string): string {
    console.log(`⏳ Downloading from ${url}...`);
    return `image_data_from_${url}`;
  }
}

// Proxy — thêm caching
class CachedImageProxy implements ImageLoader {
  private cache = new Map<string, string>();

  constructor(private realLoader: RealImageLoader) {}

  load(url: string): string {
    if (this.cache.has(url)) {
      console.log(`⚡ Cache hit: ${url}`);
      return this.cache.get(url)!;
    }

    const data = this.realLoader.load(url);
    this.cache.set(url, data);
    return data;
  }
}

const loader = new CachedImageProxy(new RealImageLoader());
loader.load('img1.png'); // ⏳ Downloading...
loader.load('img1.png'); // ⚡ Cache hit!
```

---

## 5.5 Composite Pattern

### Vấn đề

Cần xử lý **cây phân cấp** (tree structure) trong đó **đối tượng đơn lẻ và nhóm** được xử lý **giống nhau**.

### Code minh họa

```typescript
// Component chung
interface FileSystemItem {
  getName(): string;
  getSize(): number;
}

// Leaf — file đơn lẻ
class File implements FileSystemItem {
  constructor(
    private name: string,
    private size: number,
  ) {}
  getName() {
    return this.name;
  }
  getSize() {
    return this.size;
  }
}

// Composite — thư mục chứa nhiều item
class Folder implements FileSystemItem {
  private children: FileSystemItem[] = [];

  constructor(private name: string) {}

  add(item: FileSystemItem) {
    this.children.push(item);
  }

  getName() {
    return this.name;
  }

  getSize(): number {
    // Tính tổng size tất cả con (đệ quy)
    return this.children.reduce((sum, child) => sum + child.getSize(), 0);
  }
}

// Sử dụng
const root = new Folder('project');
root.add(new File('index.ts', 500));
root.add(new File('package.json', 200));

const src = new Folder('src');
src.add(new File('app.ts', 1000));
src.add(new File('utils.ts', 300));

root.add(src);

console.log(root.getSize()); // 2000 (500 + 200 + 1000 + 300)
```

---

## 5.6 Tổng kết mẫu thiết kế cấu trúc

| Pattern       | Mục đích                        | Ví dụ thực tế                           |
| ------------- | ------------------------------- | --------------------------------------- |
| **Adapter**   | Chuyển đổi interface            | Tích hợp API bên thứ 3, legacy system   |
| **Decorator** | Thêm hành vi tại runtime        | Middleware (Express), Logging, Caching  |
| **Facade**    | Đơn giản hóa interface phức tạp | Checkout process, SDK wrapper           |
| **Proxy**     | Kiểm soát truy cập              | Caching proxy, Auth proxy, Lazy loading |
| **Composite** | Xử lý cấu trúc cây              | File system, Menu đa cấp, Org chart     |

---

> 📌 **Xem tiếp:** [Chương 6 - Mẫu thiết kế hành vi](./06-BEHAVIORAL-PATTERNS.md)
