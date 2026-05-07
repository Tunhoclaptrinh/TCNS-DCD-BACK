# 📘 Chương 4: Mẫu thiết kế tạo dựng (Creational Design Patterns)

> **Mục đích:** Liên quan đến quá trình **tạo ra các đối tượng**, giúp kiểm soát cách object được khởi tạo một cách linh hoạt và hiệu quả.

---

## 4.1 Singleton Pattern

### Vấn đề

Cần đảm bảo một class chỉ có **đúng 1 instance duy nhất** trong toàn bộ ứng dụng (VD: Database connection, Logger, Configuration).

### Giải pháp

```
┌─────────────────────────┐
│       Singleton          │
├─────────────────────────┤
│ - instance: Singleton   │  ← static, private
├─────────────────────────┤
│ - constructor()         │  ← private
│ + getInstance(): Self   │  ← static, public
│ + doSomething()         │
└─────────────────────────┘
```

### Code minh họa (TypeScript)

```typescript
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private connection: any;

  // Constructor private → không thể new từ bên ngoài
  private constructor() {
    this.connection = this.connect();
  }

  // Lấy instance duy nhất
  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private connect() {
    console.log('Kết nối database...');
    return { connected: true };
  }

  query(sql: string) {
    return `Executing: ${sql}`;
  }
}

// Sử dụng
const db1 = DatabaseConnection.getInstance();
const db2 = DatabaseConnection.getInstance();
console.log(db1 === db2); // true → cùng 1 instance
```

### Ưu điểm ✅

- Đảm bảo duy nhất 1 instance
- Tiết kiệm tài nguyên (không tạo thừa object)
- Global access point

### Nhược điểm ❌

- Khó test (global state)
- Vi phạm Single Responsibility Principle
- Gây coupling ngầm

---

## 4.2 Factory Method Pattern

### Vấn đề

Cần tạo object nhưng **không biết trước loại cụ thể** tại compile time. Muốn **ủy thác việc tạo object** cho lớp con quyết định.

### Giải pháp

```
┌──────────────────┐           ┌──────────────────┐
│ Creator          │           │ Product           │
│ (Abstract)       │           │ (Interface)       │
├──────────────────┤           ├──────────────────┤
│ + createProduct()│           │ + operation()     │
│   : Product      │           └──────┬───────────┘
└──────┬───────────┘                  │
       │                    ┌─────────┴──────────┐
       │                    │                    │
┌──────▼───────┐    ┌───────▼──────┐   ┌────────▼─────┐
│ConcreteCreatorA│   │ConcreteProductA│  │ConcreteProductB│
│createProduct() │   │ operation()   │  │ operation()   │
│→ return new A  │   └───────────────┘  └───────────────┘
└────────────────┘
```

### Code minh họa

```typescript
// Product interface
interface Notification {
  send(message: string): void;
}

// Concrete Products
class EmailNotification implements Notification {
  send(message: string) {
    console.log(`📧 Email: ${message}`);
  }
}

class SMSNotification implements Notification {
  send(message: string) {
    console.log(`📱 SMS: ${message}`);
  }
}

class PushNotification implements Notification {
  send(message: string) {
    console.log(`🔔 Push: ${message}`);
  }
}

// Factory
class NotificationFactory {
  static create(type: 'email' | 'sms' | 'push'): Notification {
    switch (type) {
      case 'email':
        return new EmailNotification();
      case 'sms':
        return new SMSNotification();
      case 'push':
        return new PushNotification();
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }
}

// Sử dụng — không cần biết class cụ thể
const notif = NotificationFactory.create('email');
notif.send('Xin chào!'); // 📧 Email: Xin chào!
```

### Ưu điểm ✅

- Tách logic tạo object khỏi logic sử dụng
- Dễ mở rộng (thêm loại mới không sửa code cũ)
- Tuân thủ Open/Closed Principle

### Nhược điểm ❌

- Thêm class/interface → code phức tạp hơn
- Factory có thể phình to nếu quá nhiều loại

---

## 4.3 Abstract Factory Pattern

### Vấn đề

Cần tạo **một nhóm các object liên quan** mà không chỉ định class cụ thể. VD: Tạo bộ UI components cho theme Light hoặc Dark.

### Giải pháp

```
┌───────────────────┐
│  Abstract Factory │
├───────────────────┤         ┌──────────┐  ┌──────────┐
│ +createButton()   │────────▶│  Button  │  │ Checkbox │
│ +createCheckbox() │         │(Abstract)│  │(Abstract)│
└─────┬─────────────┘         └──────────┘  └──────────┘
      │
  ┌───┴──────────────┐
  │                  │
┌─▼──────────┐ ┌────▼────────┐
│LightFactory│ │ DarkFactory │
│createButton│ │createButton │
│→ LightBtn  │ │→ DarkBtn    │
└────────────┘ └─────────────┘
```

### Code minh họa

```typescript
// Abstract products
interface Button {
  render(): string;
}
interface Input {
  render(): string;
}

// Light theme
class LightButton implements Button {
  render() {
    return '<button class="light">Click</button>';
  }
}
class LightInput implements Input {
  render() {
    return '<input class="light" />';
  }
}

// Dark theme
class DarkButton implements Button {
  render() {
    return '<button class="dark">Click</button>';
  }
}
class DarkInput implements Input {
  render() {
    return '<input class="dark" />';
  }
}

// Abstract Factory
interface UIFactory {
  createButton(): Button;
  createInput(): Input;
}

class LightThemeFactory implements UIFactory {
  createButton() {
    return new LightButton();
  }
  createInput() {
    return new LightInput();
  }
}

class DarkThemeFactory implements UIFactory {
  createButton() {
    return new DarkButton();
  }
  createInput() {
    return new DarkInput();
  }
}

// Sử dụng
function renderUI(factory: UIFactory) {
  const btn = factory.createButton();
  const input = factory.createInput();
  console.log(btn.render(), input.render());
}

renderUI(new DarkThemeFactory());
// <button class="dark">Click</button> <input class="dark" />
```

### So sánh Factory Method vs Abstract Factory

| Tiêu chí | Factory Method     | Abstract Factory       |
| -------- | ------------------ | ---------------------- |
| Tạo      | 1 loại product     | Nhóm product liên quan |
| Mở rộng  | Thêm 1 product mới | Thêm 1 họ product mới  |
| Phức tạp | Thấp hơn           | Cao hơn                |

---

## 4.4 Builder Pattern

### Vấn đề

Cần tạo object phức tạp với **nhiều tham số tùy chọn**. Constructor dài (telescoping constructor) khó đọc và dễ sai.

### Giải pháp

```
┌──────────────┐         ┌──────────────────┐
│   Director   │────────▶│     Builder      │
│              │         ├──────────────────┤
│ construct()  │         │ +setName()       │
└──────────────┘         │ +setAge()        │
                         │ +setEmail()      │
                         │ +build(): Product│
                         └──────────────────┘
```

### Code minh họa

```typescript
class QueryBuilder {
  private table: string = '';
  private conditions: string[] = [];
  private orderField: string = '';
  private limitCount: number = 0;

  from(table: string): this {
    this.table = table;
    return this;
  }

  where(condition: string): this {
    this.conditions.push(condition);
    return this;
  }

  orderBy(field: string): this {
    this.orderField = field;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  build(): string {
    let query = `SELECT * FROM ${this.table}`;
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    if (this.orderField) query += ` ORDER BY ${this.orderField}`;
    if (this.limitCount) query += ` LIMIT ${this.limitCount}`;
    return query;
  }
}

// Sử dụng — method chaining, dễ đọc
const query = new QueryBuilder()
  .from('users')
  .where('age > 18')
  .where('active = true')
  .orderBy('name')
  .limit(10)
  .build();

// SELECT * FROM users WHERE age > 18 AND active = true ORDER BY name LIMIT 10
```

### Ưu điểm ✅

- Tránh constructor nhiều tham số
- Code dễ đọc với method chaining
- Tạo nhiều biến thể của object

### Nhược điểm ❌

- Thêm class Builder → nhiều code hơn
- Mutable state trong quá trình build

---

## 4.5 Prototype Pattern

### Vấn đề

Cần tạo object mới bằng cách **clone từ object có sẵn**, thay vì tạo từ đầu (đặc biệt khi khởi tạo tốn kém).

### Code minh họa

```typescript
interface Cloneable {
  clone(): this;
}

class DocumentTemplate implements Cloneable {
  constructor(
    public title: string,
    public content: string,
    public styles: Record<string, string>,
  ) {}

  clone(): this {
    // Deep clone
    return Object.assign(Object.create(Object.getPrototypeOf(this)), {
      ...this,
      styles: { ...this.styles },
    });
  }
}

// Object gốc (tốn thời gian tạo)
const template = new DocumentTemplate('Báo cáo', 'Nội dung mẫu...', { font: 'Arial', size: '12px' });

// Clone nhanh, rồi customize
const doc1 = template.clone();
doc1.title = 'Báo cáo tháng 1';

const doc2 = template.clone();
doc2.title = 'Báo cáo tháng 2';
```

---

## 4.6 Tổng kết mẫu thiết kế tạo dựng

| Pattern              | Mục đích                       | Khi nào dùng                    |
| -------------------- | ------------------------------ | ------------------------------- |
| **Singleton**        | 1 instance duy nhất            | DB connection, Logger, Config   |
| **Factory Method**   | Ủy thác tạo object cho factory | Không biết trước loại cụ thể    |
| **Abstract Factory** | Tạo nhóm object liên quan      | Theme UI, cross-platform        |
| **Builder**          | Tạo object phức tạp từng bước  | Object nhiều tham số tùy chọn   |
| **Prototype**        | Clone object có sẵn            | Tạo object tốn kém, cần bản sao |

---

> 📌 **Xem tiếp:** [Chương 5 - Mẫu thiết kế cấu trúc](./05-STRUCTURAL-PATTERNS.md)
