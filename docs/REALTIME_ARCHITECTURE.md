# ⚡ Real-time Architecture (Socket.io)

Hệ thống sử dụng **Socket.io** để thiết lập kết nối song phương (Bi-directional) giữa Client và Server, phục vụ các tính năng cần phản hồi ngay lập tức.

## 1. Cơ sở hạ tầng Socket

- **Vị trí:** `src/modules/socket/socket.service.ts`
- **Giao thức:** WebSockets (fallback sang Long-polling nếu cần).

### Kiến trúc Singleton

`SocketService` được thiết kế dưới dạng **Singleton**. Điều này đảm bảo toàn bộ ứng dụng Backend chỉ sử dụng duy nhất một Server Instance, tránh việc lãng phí tài nguyên và xung đột kết nối.

---

## 2. Quản lý Rooms & Namespaces

Để tối ưu hóa việc gửi thông báo, hệ thống chia người dùng vào các "Phòng" (Rooms):

- **User Room:** Mỗi người dùng khi kết nối sẽ tự động tham gia vào phòng có tên là `user_{userId}`.
- **Admin Room:** Tất cả quản trị viên tham gia vào phòng `admin_group` để nhận các báo cáo hệ thống.
- **Meeting Room:** Khi tham gia một cuộc họp, Client tham gia vào `meeting_{meetingId}` để nhận thông báo điểm danh.

---

## 3. Danh sách Sự kiện (Event List)

### Server -> Client (Emit)

- `notification:new`: Gửi thông báo mới cho người dùng.
- `meeting:attendance_updated`: Cập nhật danh sách điểm danh thời gian thực.
- `duty:slot_claimed`: Thông báo có người đã đăng ký thành công một kíp trực.

### Client -> Server (On)

- `subscribe`: Đăng ký nhận thông báo cho một Resource cụ thể.
- `unsubscribe`: Hủy đăng ký.

---

## 4. Bảo mật Socket

Kết nối Socket cũng được bảo mật tương đương với API:

1. **Handshake Auth:** Khi khởi tạo kết nối, Client phải gửi kèm JWT.
2. **Middleware:** Backend sử dụng một middleware riêng để validate Token trước khi cho phép kết nối `connection`.
3. **Authorization:** Kiểm tra quyền hạn trước khi cho phép Client `join` vào các phòng nhạy cảm (như phòng Admin).

---

## 5. Chiến lược Scale & Reliable

- **Heartbeat:** Server gửi tín hiệu "ping" định kỳ để kiểm tra các kết nối chết (Zombie connections).
- **Auto-reconnect:** Frontend được cấu hình tự động kết nối lại khi mất mạng, Server sẽ tự động gán lại các Room dựa trên Token.

---

_Project Real-time Messaging Team_
