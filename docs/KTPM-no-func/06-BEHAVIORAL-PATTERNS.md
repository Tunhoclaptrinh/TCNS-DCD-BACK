# 📘 Chương 6: Mẫu thiết kế hành vi (Behavioral Design Patterns)

> **Mục đích:** Liên quan đến cách thức các đối tượng **chia sẻ dữ liệu và giao tiếp** với nhau, phân chia trách nhiệm giữa các object một cách linh hoạt.

---

## 6.1 Observer Pattern (Pub/Sub)

### Vấn đề

Khi **một object thay đổi trạng thái**, cần **thông báo tự động** cho nhiều object khác mà không tạo coupling chặt.

### Giải pháp

```
┌──────────────┐         ┌───────────────┐
│   Subject    │         │   Observer    │
│  (Publisher) │         │ (Subscriber)  │
├──────────────┤         ├───────────────┤
│ +subscribe() │◄────────│ +update()     │
│ +unsubscribe()│        └───────────────┘
│ +notify()    │                ▲
└──────┬───────┘          ┌─────┴──────┐
       │                  │            │
       │ notify()   ┌─────▼──┐  ┌─────▼──┐
       └───────────▶│Observer│  │Observer│
                    │   A    │  │   B    │
                    └────────┘  └────────┘
```

### Code minh họa

```typescript
// Observer interface
interface EventListener {
  update(event: string, data: any): void;
}

// Subject — quản lý danh sách listener
class EventEmitter {
  private listeners = new Map<string, EventListener[]>();

  subscribe(event: string, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  unsubscribe(event: string, listener: EventListener) {
    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(
        event,
        list.filter((l) => l !== listener),
      );
    }
  }

  notify(event: string, data: any) {
    const list = this.listeners.get(event) || [];
    list.forEach((listener) => listener.update(event, data));
  }
}

// Concrete Observers
class EmailService implements EventListener {
  update(event: string, data: any) {
    console.log(`📧 Email: Sự kiện "${event}" → gửi email cho ${data.email}`);
  }
}

class LogService implements EventListener {
  update(event: string, data: any) {
    console.log(`📝 Log: ${event} - ${JSON.stringify(data)}`);
  }
}

// Sử dụng
const emitter = new EventEmitter();
emitter.subscribe('user.registered', new EmailService());
emitter.subscribe('user.registered', new LogService());

emitter.notify('user.registered', { email: 'user@mail.com', name: 'Phong' });
// 📧 Email: Sự kiện "user.registered" → gửi email cho user@mail.com
// 📝 Log: user.registered - {"email":"user@mail.com","name":"Phong"}
```

### Ưu điểm ✅

- Loose coupling giữa publisher và subscriber
- Dễ thêm/xóa observer mà không sửa subject
- Hỗ trợ event-driven architecture

### Nhược điểm ❌

- Thứ tự thông báo không đảm bảo
- Memory leak nếu quên unsubscribe
- Khó debug khi có nhiều observer

---

## 6.2 Strategy Pattern

### Vấn đề

Cần **thay đổi thuật toán/hành vi** của object **tại runtime** mà không sửa class đó.

### Giải pháp

```
┌───────────┐        ┌────────────────┐
│  Context  │───────▶│   Strategy     │
│           │        │  (Interface)   │
│ -strategy │        ├────────────────┤
│ +execute()│        │ +execute()     │
└───────────┘        └───────┬────────┘
                             │
                   ┌─────────┼──────────┐
             ┌─────▼───┐  ┌──▼────────┐  ┌──▼──────────┐
             │StrategyA│  │StrategyB  │  │StrategyC   │
             │execute()│  │execute()  │  │execute()   │
             └─────────┘  └───────────┘  └────────────┘
```

### Code minh họa

```typescript
// Strategy interface
interface SortStrategy {
  sort(data: number[]): number[];
}

// Concrete Strategies
class BubbleSort implements SortStrategy {
  sort(data: number[]): number[] {
    console.log('🫧 Bubble Sort');
    const arr = [...data];
    for (let i = 0; i < arr.length; i++)
      for (let j = 0; j < arr.length - i - 1; j++) if (arr[j] > arr[j + 1]) [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
    return arr;
  }
}

class QuickSort implements SortStrategy {
  sort(data: number[]): number[] {
    console.log('⚡ Quick Sort');
    if (data.length <= 1) return data;
    const pivot = data[0];
    const left = data.slice(1).filter((x) => x <= pivot);
    const right = data.slice(1).filter((x) => x > pivot);
    return [...this.sort(left), pivot, ...this.sort(right)];
  }
}

// Context
class Sorter {
  constructor(private strategy: SortStrategy) {}

  setStrategy(strategy: SortStrategy) {
    this.strategy = strategy;
  }

  sort(data: number[]): number[] {
    return this.strategy.sort(data);
  }
}

// Sử dụng — đổi thuật toán tại runtime
const sorter = new Sorter(new BubbleSort());
sorter.sort([3, 1, 4, 1, 5]); // 🫧 Bubble Sort

sorter.setStrategy(new QuickSort());
sorter.sort([3, 1, 4, 1, 5]); // ⚡ Quick Sort
```

### Ưu điểm ✅

- Thay đổi thuật toán linh hoạt tại runtime
- Tuân thủ Open/Closed Principle
- Loại bỏ if/else phức tạp

### Nhược điểm ❌

- Client phải biết các strategy có sẵn
- Thêm nhiều class nhỏ

---

## 6.3 Command Pattern

### Vấn đề

Cần **đóng gói request thành object**, cho phép **undo/redo**, queue, hoặc log các thao tác.

### Giải pháp

```
┌──────────┐     ┌───────────┐     ┌──────────┐
│  Invoker │────▶│  Command  │────▶│ Receiver │
│          │     │(Interface)│     │          │
│ execute()│     │+execute() │     │ Xử lý   │
│ undo()   │     │+undo()   │     │ thực tế  │
└──────────┘     └───────────┘     └──────────┘
```

### Code minh họa

```typescript
// Command interface
interface Command {
  execute(): void;
  undo(): void;
}

// Receiver
class TextEditor {
  private content = '';

  insert(text: string) {
    this.content += text;
  }
  deleteLast(count: number) {
    this.content = this.content.slice(0, -count);
  }
  getContent() {
    return this.content;
  }
}

// Concrete Commands
class InsertCommand implements Command {
  constructor(
    private editor: TextEditor,
    private text: string,
  ) {}

  execute() {
    this.editor.insert(this.text);
  }
  undo() {
    this.editor.deleteLast(this.text.length);
  }
}

// Invoker — quản lý history
class CommandHistory {
  private history: Command[] = [];

  execute(command: Command) {
    command.execute();
    this.history.push(command);
  }

  undo() {
    const command = this.history.pop();
    if (command) command.undo();
  }
}

// Sử dụng
const editor = new TextEditor();
const history = new CommandHistory();

history.execute(new InsertCommand(editor, 'Hello '));
history.execute(new InsertCommand(editor, 'World'));
console.log(editor.getContent()); // "Hello World"

history.undo();
console.log(editor.getContent()); // "Hello "

history.undo();
console.log(editor.getContent()); // ""
```

### Ưu điểm ✅

- Hỗ trợ undo/redo
- Queue các command để thực thi sau
- Log và replay các thao tác

### Nhược điểm ❌

- Thêm nhiều class cho mỗi command
- Phức tạp hơn gọi hàm trực tiếp

---

## 6.4 Template Method Pattern

### Vấn đề

Nhiều class có **quy trình giống nhau** nhưng **một số bước khác nhau**. Muốn định nghĩa "khung" chung, để lớp con override các bước cụ thể.

### Code minh họa

```typescript
// Template — định nghĩa khung xử lý
abstract class DataProcessor {
  // Template method — quy trình cố định
  process(source: string): void {
    const raw = this.readData(source);
    const parsed = this.parseData(raw);
    const result = this.transformData(parsed);
    this.saveData(result);
    console.log('✅ Processing complete!');
  }

  // Các bước con class phải implement
  abstract readData(source: string): string;
  abstract parseData(raw: string): any[];

  // Hook — có thể override hoặc không
  transformData(data: any[]): any[] {
    return data;
  }

  saveData(data: any[]) {
    console.log(`💾 Saved ${data.length} records`);
  }
}

// Concrete: xử lý CSV
class CSVProcessor extends DataProcessor {
  readData(source: string) {
    return 'name,age\nAn,20\nBinh,22';
  }
  parseData(raw: string) {
    return raw
      .split('\n')
      .slice(1)
      .map((line) => {
        const [name, age] = line.split(',');
        return { name, age: Number(age) };
      });
  }
}

// Concrete: xử lý JSON
class JSONProcessor extends DataProcessor {
  readData(source: string) {
    return '[{"name":"An","age":20}]';
  }
  parseData(raw: string) {
    return JSON.parse(raw);
  }
}

// Sử dụng — cùng quy trình, khác cách đọc/parse
new CSVProcessor().process('data.csv');
new JSONProcessor().process('data.json');
```

---

## 6.5 Iterator Pattern

### Vấn đề

Cần duyệt qua các phần tử của một **collection** mà **không lộ cấu trúc bên trong** (array, tree, hash map...).

### Code minh họa

```typescript
// Iterator interface
interface Iterator<T> {
  hasNext(): boolean;
  next(): T;
}

// Collection
class NumberRange {
  constructor(
    private start: number,
    private end: number,
  ) {}

  createIterator(): Iterator<number> {
    let current = this.start;
    const end = this.end;

    return {
      hasNext: () => current <= end,
      next: () => current++,
    };
  }
}

// Sử dụng
const range = new NumberRange(1, 5);
const iterator = range.createIterator();

while (iterator.hasNext()) {
  console.log(iterator.next()); // 1, 2, 3, 4, 5
}
```

---

## 6.6 Mediator Pattern

### Vấn đề

Nhiều object giao tiếp chéo nhau → mạng lưới phức tạp. **Mediator** đóng vai trò trung gian, các object chỉ giao tiếp qua mediator.

### Code minh họa

```typescript
// Mediator
class ChatRoom {
  private users: Map<string, (msg: string) => void> = new Map();

  register(name: string, callback: (msg: string) => void) {
    this.users.set(name, callback);
  }

  send(from: string, to: string, message: string) {
    const recipient = this.users.get(to);
    if (recipient) {
      recipient(`[${from}]: ${message}`);
    }
  }

  broadcast(from: string, message: string) {
    this.users.forEach((callback, name) => {
      if (name !== from) callback(`[${from}]: ${message}`);
    });
  }
}

// Sử dụng
const room = new ChatRoom();
room.register('An', (msg) => console.log(`An nhận: ${msg}`));
room.register('Bình', (msg) => console.log(`Bình nhận: ${msg}`));
room.register('Chi', (msg) => console.log(`Chi nhận: ${msg}`));

room.send('An', 'Bình', 'Xin chào!');
// Bình nhận: [An]: Xin chào!

room.broadcast('Chi', 'Chào mọi người!');
// An nhận: [Chi]: Chào mọi người!
// Bình nhận: [Chi]: Chào mọi người!
```

---

## 6.7 Tổng kết mẫu thiết kế hành vi

| Pattern             | Mục đích                               | Ví dụ thực tế                             |
| ------------------- | -------------------------------------- | ----------------------------------------- |
| **Observer**        | Thông báo thay đổi cho nhiều object    | Event system, Notification, WebSocket     |
| **Strategy**        | Thay đổi thuật toán tại runtime        | Sorting, Payment methods, Auth strategies |
| **Command**         | Đóng gói request thành object          | Undo/Redo, Task queue, Transaction        |
| **Template Method** | Khung xử lý chung, bước khác ở lớp con | ETL pipeline, Test framework              |
| **Iterator**        | Duyệt collection không lộ cấu trúc     | for...of, cursor database                 |
| **Mediator**        | Giao tiếp qua trung gian               | Chat room, Event bus, Air traffic control |

---

## 📊 Tổng kết toàn bộ Design Patterns (GoF)

| Nhóm         | Pattern          | Một câu mô tả                  |
| ------------ | ---------------- | ------------------------------ |
| **Tạo dựng** | Singleton        | 1 instance duy nhất            |
|              | Factory Method   | Ủy thác tạo object cho factory |
|              | Abstract Factory | Tạo nhóm object liên quan      |
|              | Builder          | Xây object phức tạp từng bước  |
|              | Prototype        | Clone object có sẵn            |
| **Cấu trúc** | Adapter          | Chuyển đổi interface           |
|              | Decorator        | Thêm hành vi không sửa class   |
|              | Facade           | Đơn giản hóa interface         |
|              | Proxy            | Kiểm soát truy cập             |
|              | Composite        | Xử lý cấu trúc cây             |
| **Hành vi**  | Observer         | Pub/Sub — thông báo sự kiện    |
|              | Strategy         | Thay đổi thuật toán runtime    |
|              | Command          | Đóng gói request, undo/redo    |
|              | Template Method  | Khung xử lý chung              |
|              | Iterator         | Duyệt collection               |
|              | Mediator         | Giao tiếp qua trung gian       |

---

> 📌 **Quay lại:** [Mục lục](./00-MUC-LUC.md)
