# 📘 Chương 2: So sánh Monolith vs SOA vs Microservice

## 2.1 Kiến trúc Monolith (Nguyên khối)

### Khái niệm

Toàn bộ ứng dụng được **đóng gói trong một khối duy nhất**, tất cả các module (UI, Business Logic, Database) chạy trong cùng một tiến trình.

```
┌──────────────────────────────────┐
│           MONOLITH               │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │  UI  │ │Logic │ │ Data │    │
│  └──┬───┘ └──┬───┘ └──┬───┘    │
│     │        │        │         │
│     └────────┼────────┘         │
│              │                  │
│         ┌────▼────┐             │
│         │   DB    │             │
│         └─────────┘             │
└──────────────────────────────────┘
      1 codebase, 1 deployment
```

### Ưu điểm ✅

- **Đơn giản để phát triển**: Một codebase, dễ setup, dễ debug
- **Dễ triển khai**: Chỉ cần deploy 1 artifact (WAR, JAR, exe...)
- **Hiệu suất nội bộ cao**: Gọi hàm trực tiếp (in-process), không qua mạng
- **Dễ test**: Test tích hợp (integration test) đơn giản
- **Chi phí vận hành thấp**: Chỉ cần 1 server, ít infrastructure

### Nhược điểm ❌

- **Khó mở rộng**: Scale cả khối dù chỉ 1 module cần scale
- **Codebase phình to**: Sau thời gian dài, code trở nên khó đọc, khó bảo trì
- **Deploy rủi ro**: Thay đổi nhỏ → deploy lại toàn bộ ứng dụng
- **Phụ thuộc công nghệ**: Buộc dùng 1 ngôn ngữ/framework cho toàn bộ
- **Bottleneck đội ngũ**: Nhiều dev cùng sửa 1 codebase → conflict

---

## 2.2 Kiến trúc SOA (Service-Oriented Architecture)

### Khái niệm

Chia ứng dụng thành các **service lớn**, giao tiếp qua **ESB (Enterprise Service Bus)** — một trung gian điều phối message.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Service  │  │ Service  │  │ Service  │
│   HR     │  │ Finance  │  │  CRM     │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │              │
     └─────────────┼──────────────┘
                   │
          ┌────────▼────────┐
          │       ESB       │
          │ (Enterprise     │
          │  Service Bus)   │
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  Shared DB /    │
          │  Legacy System  │
          └─────────────────┘
```

### Ưu điểm ✅

- **Tái sử dụng service**: Các service được chia sẻ giữa nhiều ứng dụng
- **Tích hợp hệ thống cũ**: ESB giúp kết nối các hệ thống khác nhau (legacy)
- **Tiêu chuẩn hóa giao tiếp**: Dùng SOAP/WSDL, có contract rõ ràng
- **Quản trị tập trung**: Giám sát, bảo mật qua ESB

### Nhược điểm ❌

- **ESB là single point of failure**: ESB chết → toàn bộ hệ thống ngừng
- **Phức tạp cấu hình**: ESB cần nhiều config, mapping phức tạp
- **Hiệu suất kém**: Message phải đi qua ESB → thêm latency
- **Chi phí cao**: Cần middleware thương mại (IBM, Oracle...)
- **Service thường quá lớn**: Không chia đủ nhỏ, vẫn khó bảo trì

---

## 2.3 Kiến trúc Microservice

### Khái niệm

Chia ứng dụng thành **nhiều service nhỏ, độc lập**, mỗi service có **database riêng**, deploy và scale **độc lập**, giao tiếp qua **API (REST/gRPC) hoặc Message Queue**.

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ User    │  │ Order   │  │ Payment │  │ Notify  │
│ Service │  │ Service │  │ Service │  │ Service │
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
     │            │            │             │
  ┌──▼──┐     ┌──▼──┐     ┌──▼──┐      ┌──▼──┐
  │ DB1 │     │ DB2 │     │ DB3 │      │ DB4 │
  └─────┘     └─────┘     └─────┘      └─────┘

  Giao tiếp: REST API / gRPC / Message Queue (RabbitMQ, Kafka)
```

### Ưu điểm ✅

- **Scale độc lập**: Chỉ scale service nào cần, tiết kiệm tài nguyên
- **Triển khai độc lập**: Deploy 1 service không ảnh hưởng service khác
- **Đa công nghệ**: Mỗi service dùng ngôn ngữ/DB phù hợp nhất
- **Fault isolation**: 1 service lỗi không kéo sập toàn bộ hệ thống
- **Phát triển song song**: Các đội phát triển độc lập, không conflict

### Nhược điểm ❌

- **Phức tạp vận hành**: Cần DevOps, CI/CD, monitoring cho nhiều service
- **Distributed data**: Đảm bảo tính nhất quán dữ liệu phức tạp (eventual consistency)
- **Network latency**: Giao tiếp qua mạng chậm hơn gọi hàm trực tiếp
- **Debug khó**: Trace request qua nhiều service (cần distributed tracing)
- **Chi phí infrastructure**: Nhiều container, nhiều DB, cần orchestration (K8s)

---

## 2.4 Bảng so sánh tổng hợp

| Tiêu chí                | Monolith              | SOA                  | Microservice               |
| ----------------------- | --------------------- | -------------------- | -------------------------- |
| **Kích thước service**  | 1 khối duy nhất       | Service lớn          | Service nhỏ, độc lập       |
| **Giao tiếp**           | Gọi hàm nội bộ        | ESB (SOAP/XML)       | REST/gRPC/Message Queue    |
| **Database**            | 1 DB chung            | DB chia sẻ           | Mỗi service 1 DB riêng     |
| **Deploy**              | Toàn bộ 1 lần         | Từng service         | Từng service độc lập       |
| **Scale**               | Scale cả khối         | Scale theo service   | Scale từng service         |
| **Công nghệ**           | Đồng nhất             | Đồng nhất theo chuẩn | Đa dạng (polyglot)         |
| **Độ phức tạp ban đầu** | ⭐ Thấp               | ⭐⭐⭐ Cao           | ⭐⭐⭐⭐ Rất cao           |
| **Khả năng bảo trì**    | Giảm theo thời gian   | Trung bình           | Tốt                        |
| **Fault Tolerance**     | Thấp (1 lỗi → sập)    | Trung bình           | Cao (cô lập lỗi)           |
| **Phù hợp với**         | Startup, MVP, đội nhỏ | Doanh nghiệp, legacy | Hệ thống lớn, cloud-native |

---

## 2.5 Khi nào chọn kiến trúc nào?

### 🟢 Chọn Monolith khi:

- Dự án nhỏ, đội ngũ < 10 người
- Cần ra sản phẩm nhanh (MVP - Minimum Viable Product)
- Domain đơn giản, ít thay đổi
- Budget hạn chế, không có DevOps chuyên trách

### 🟡 Chọn SOA khi:

- Doanh nghiệp lớn, cần tích hợp nhiều hệ thống cũ (legacy)
- Cần tiêu chuẩn hóa giao tiếp giữa các phòng ban
- Có sẵn infrastructure ESB
- Yêu cầu governance và compliance chặt chẽ

### 🔴 Chọn Microservice khi:

- Hệ thống lớn, phức tạp, nhiều domain
- Cần scale từng phần độc lập (VD: hệ thống e-commerce)
- Đội ngũ lớn, chia thành nhiều team nhỏ
- Có năng lực DevOps, CI/CD, container orchestration

---

## 2.6 Xu hướng tiến hóa

```
  Monolith ──────▶ SOA ──────▶ Microservice ──────▶ Serverless
    │                │              │                    │
  1990s           2000s          2010s               2020s+
    │                │              │                    │
  Đơn giản        ESB +          Docker +            FaaS +
  1 khối          SOAP           Kubernetes          Event-driven
```

> **Lưu ý:** Không phải lúc nào Microservice cũng tốt hơn Monolith. "Monolith First" là chiến lược phổ biến — bắt đầu đơn giản, tách dần khi cần thiết.

---

> 📌 **Xem tiếp:** [Chương 3 - Mẫu kiến trúc](./03-MAU-KIEN-TRUC.md)
