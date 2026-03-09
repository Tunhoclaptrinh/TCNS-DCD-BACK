# Hướng Dẫn Sử Dụng Module Cốt Lõi

Tài liệu này mô tả cách dùng nhanh các module:

- Quản lý thành viên cốt lõi
- Hoạt động trực cốt lõi
- Thưởng phạt
- Notification cốt lõi
- Báo cáo quản trị

## 1. Chuẩn bị

### Base URL

- Local: `http://localhost:3000`
- API prefix: `/api`

### Đăng nhập lấy token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "YourPassword123"
  }'
```

Lấy `token` từ response và dùng cho các API protected:

```bash
Authorization: Bearer <ACCESS_TOKEN>
```

## 2. Quyền (Permission) cần biết

### User/Member

- `users:list`, `users:read`
- `users:create`, `users:update`, `users:delete`
- `users:manage_status`, `users:view_stats`
- `users:manage_rank`, `users:expel`

### Duty

- `duty:view`, `duty:register`, `duty:update`
- `duty:manage`, `duty:approve_swap`

### Reward/Penalty

- `reward_penalty:view`, `reward_penalty:manage`

### Report

- `reports:view`, `reports:export`

`admin` có wildcard `*`.  
`staff` có quyền vận hành chính.  
`customer` chủ yếu xem/đăng ký ca và xem thưởng phạt của chính mình.

## 3. Quản lý thành viên cốt lõi

### 3.1 Xem danh sách thành viên

```bash
curl "http://localhost:3000/api/users?_page=1&_limit=20&role=customer" \
  -H "Authorization: Bearer <TOKEN>"
```

### 3.2 Xem chi tiết thành viên

```bash
curl "http://localhost:3000/api/users/2" \
  -H "Authorization: Bearer <TOKEN>"
```

### 3.3 Nâng hạng / đổi vai trò

```bash
curl -X PATCH http://localhost:3000/api/users/2/promote \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "staff",
    "reason": "Đóng góp tốt"
  }'
```

### 3.4 Khai trừ thành viên

```bash
curl -X PATCH http://localhost:3000/api/users/2/expel \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Vi phạm nội quy"
  }'
```

### 3.5 CRUD user phục vụ vận hành

- Tạo: `POST /api/users`
- Sửa: `PUT /api/users/:id`
- Xóa mềm: `DELETE /api/users/:id`
- Xóa vĩnh viễn: `DELETE /api/users/:id/permanent`

## 4. Hoạt động trực cốt lõi

### 4.1 Hiển thị lịch tuần

```bash
curl "http://localhost:3000/api/duty/week?week_start=2026-03-09&_page=1&_limit=50" \
  -H "Authorization: Bearer <TOKEN>"
```

### 4.2 Tạo ca trực (vận hành)

```bash
curl -X POST http://localhost:3000/api/duty/slots \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "shift_label": "Ca sáng thứ 2",
    "shift_date": "2026-03-09T00:00:00.000Z",
    "start_time": "08:00",
    "end_time": "12:00",
    "capacity": 3,
    "note": "Trực văn phòng"
  }'
```

### 4.3 Cập nhật ca trực

```bash
curl -X PUT http://localhost:3000/api/duty/slots/1 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "capacity": 4,
    "status": "open"
  }'
```

### 4.4 Đăng ký lịch trực

```bash
curl -X PATCH http://localhost:3000/api/duty/slots/1/register \
  -H "Authorization: Bearer <TOKEN>"
```

### 4.5 Hủy đăng ký lịch trực

```bash
curl -X PATCH http://localhost:3000/api/duty/slots/1/cancel \
  -H "Authorization: Bearer <TOKEN>"
```

### 4.6 Yêu cầu đổi ca

```bash
curl -X POST http://localhost:3000/api/duty/swaps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "duty_slot_id": 1,
    "target_user_id": 3,
    "reason": "Bận việc gia đình"
  }'
```

### 4.7 Danh sách yêu cầu đổi ca

```bash
curl "http://localhost:3000/api/duty/swaps?_page=1&_limit=20&status=pending" \
  -H "Authorization: Bearer <TOKEN>"
```

### 4.8 Duyệt / từ chối đổi ca

```bash
curl -X PATCH http://localhost:3000/api/duty/swaps/10/decision \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "note": "Đã kiểm tra phù hợp"
  }'
```

`decision` nhận: `approved` hoặc `rejected`.

## 5. Thưởng phạt

### 5.1 Thêm thưởng/phạt

```bash
curl -X POST http://localhost:3000/api/reward-penalties \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "type": "reward",
    "amount": 200000,
    "reason": "Hỗ trợ tốt sự kiện",
    "event_date": "2026-03-09T00:00:00.000Z",
    "note": "Chi tháng 3"
  }'
```

`type` nhận: `reward` hoặc `penalty`.

### 5.2 Xem lịch sử

```bash
curl "http://localhost:3000/api/reward-penalties?_page=1&_limit=20&type=reward" \
  -H "Authorization: Bearer <TOKEN>"
```

### 5.3 Thống kê tài chính

```bash
curl "http://localhost:3000/api/reward-penalties/stats/financial?from=2026-03-01&to=2026-03-31" \
  -H "Authorization: Bearer <TOKEN>"
```

## 6. Notification cốt lõi

### 6.1 Lịch sử thông báo

```bash
curl "http://localhost:3000/api/notifications?_page=1&_limit=20" \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.2 Đánh dấu đã đọc

```bash
curl -X PATCH http://localhost:3000/api/notifications/15/read \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.3 Đánh dấu tất cả đã đọc

```bash
curl -X PATCH http://localhost:3000/api/notifications/read-all \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.4 Cài đặt thông báo

Lấy cài đặt hiện tại:

```bash
curl http://localhost:3000/api/notifications/settings \
  -H "Authorization: Bearer <TOKEN>"
```

Cập nhật cài đặt:

```bash
curl -X PUT http://localhost:3000/api/notifications/settings \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "shift_notifications": true,
    "approval_notifications": true,
    "system_notifications": true,
    "email_notifications": false,
    "sms_notifications": false
  }'
```

## 7. Báo cáo quản trị

### 7.1 Thống kê tổng quan

```bash
curl http://localhost:3000/api/reports/overview \
  -H "Authorization: Bearer <TOKEN>"
```

### 7.2 Xuất báo cáo

Xuất Excel:

```bash
curl -L "http://localhost:3000/api/reports/export?format=xlsx" \
  -H "Authorization: Bearer <TOKEN>" \
  -o admin-overview.xlsx
```

Xuất CSV:

```bash
curl -L "http://localhost:3000/api/reports/export?format=csv" \
  -H "Authorization: Bearer <TOKEN>" \
  -o admin-overview.csv
```

## 8. Query nhanh (dùng chung)

Các API list hỗ trợ:

- Pagination: `_page`, `_limit`
- Sort: `_sort`, `_order`
- Search text: `q`
- Filter theo field: `field=value`
- Filter nâng cao: `_gte`, `_lte`, `_gt`, `_lt`, `_ne`, `_like`, `_in`

Ví dụ:

```bash
/api/reward-penalties?amount_gte=100000&amount_lte=500000&type=reward&_sort=event_date&_order=desc
```

## 9. Luồng vận hành đề xuất

1. Admin/Staff tạo ca trực theo tuần (`POST /api/duty/slots`).
2. Thành viên đăng ký ca (`PATCH /register`).
3. Nếu cần đổi ca: tạo request (`POST /api/duty/swaps`).
4. Admin/Staff duyệt đổi ca (`PATCH /decision`).
5. Sau mỗi kỳ: ghi nhận thưởng/phạt (`POST /api/reward-penalties`).
6. Theo dõi thông báo và bật/tắt kênh theo nhu cầu.
7. Cuối tuần/tháng xuất báo cáo (`GET /api/reports/export`).
