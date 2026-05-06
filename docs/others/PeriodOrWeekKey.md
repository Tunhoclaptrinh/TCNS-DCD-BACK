Viewed MatrixViewModal.tsx:29-51
Listed directory schemas
Viewed duty-settings.schema.ts:1-100
Viewed duty-snapshot.schema.ts:1-30
Viewed duty-day.schema.ts:1-35
Searched for "initialize"
Searched for "period"
Searched for "quotaRules"
Viewed duty-stats.service.ts:1-345
Searched for "isPeriodInitialized"
Viewed duty-slots.service.ts:1-800
Viewed useStatisticsSimulation.ts:1-181
Viewed duty-days.repository.ts:1-14
Viewed duty-settings.service.ts:1-75
Edited per_period_quota_plan.md

Tôi đã xây dựng kế hoạch chuyển đổi hệ thống định mức từ cấu hình chung (global) sang cấu hình riêng lẻ từng tuần (per-period) như bạn mong muốn.

### Kế hoạch tổng thể:

1.  **Cấu trúc dữ liệu mới (Backend)**:
    - Tạo schema `DutyPeriodConfig` để lưu trữ bộ quy tắc (`rules`), định mức mặc định (`defaultQuota`), và giá trị kíp (`kipPrice`) riêng cho một khoảng thời gian (startDate - endDate).
    - Khi bạn nhấn "Lưu" ở phần thiết lập tuần trong **Matrix View**, hệ thống sẽ tạo/cập nhật bản ghi này cho tuần đó thay vì ghi đè lên cài đặt hệ thống chung.

2.  **Cài đặt hệ thống chung (Global Settings)**:
    - Giữ lại công tắc bật/tắt giới hạn (`weeklyLimitEnabled`) và chế độ (`kipLimitMode`).
    - Phần danh sách quy tắc hiện tại trong Cài đặt hệ thống sẽ trở thành **"Bộ mẫu mặc định"**. Khi một tuần mới được xem lần đầu, hệ thống sẽ lấy mẫu này để hiển thị nhưng chưa lưu chính thức cho tuần đó (đánh dấu là `isPeriodInitialized: false`).

3.  **Cơ chế hoạt động**:
    - **Khi khởi tạo/xem tuần**: Hệ thống kiểm tra xem đã có `DutyPeriodConfig` cho tuần đó chưa. Nếu chưa, nó sẽ hiện biểu tượng cảnh báo "Chưa khởi tạo định mức" (như hiện tại).
    - **Khi đăng ký lịch trực**: Backend sẽ ưu tiên kiểm tra bộ quy tắc của tuần đó trong `DutyPeriodConfig`. Nếu không thấy, nó mới dùng bộ quy tắc mặc định từ Cài đặt hệ thống.

Bạn có thể xem chi tiết kế hoạch triển khai tại đây: [per_period_quota_plan.md](file:///C:/Users/tuann/.gemini/antigravity/brain/417aa3c8-0705-437a-ad0d-d964d4fa46b1/per_period_quota_plan.md)

Nếu bạn đồng ý với hướng này, tôi sẽ bắt đầu thực hiện từ việc cập nhật Schema và API ở Backend trước. Bạn thấy sao?

Về việc "liên kết" để truy vấn sau này, đây là một điểm rất quan trọng để hệ thống chạy nhanh và chính xác. Tôi đề xuất giải pháp **"Neo dữ liệu theo tuần" (Weekly Anchoring)** thay vì chỉ dựa vào khoảng ngày tháng chung chung:

### 1. Dùng `weekKey` làm sợi dây liên kết:

Thay vì mỗi lần đều phải tính toán `startDate <= date <= endDate`, chúng ta sẽ quy chuẩn hóa mỗi tuần thành một mã duy nhất, ví dụ: `2026-W20` (Năm 2026, Tuần 20).

- **Trong `DutyPeriodConfig`**: Ta lưu thêm trường `weekKey: "2026-20"`. Đây sẽ là khóa chính để tìm nhanh bộ quy tắc của tuần đó.
- **Trong `DutySlot` (Kíp trực)**: Khi một kíp trực được tạo ra, hệ thống tự động tính và lưu `weekKey` vào kíp đó.

**Lợi ích**: Sau này bạn muốn lấy định mức của một kíp trực bất kỳ, chỉ cần: `Kíp A thuộc tuần 2026-20 -> Lấy config của 2026-20`. Truy vấn sẽ cực kỳ nhanh vì là so sánh chuỗi (string) có đánh index, không phải tính toán ngày tháng phức tạp.

### 2. Liên kết với "Snapshot" (Quyết toán):

Hiện tại hệ thống đã có `DutySnapshot`. Khi bạn nhấn **"Chốt quyết toán"**:

- Hệ thống sẽ copy toàn bộ bộ quy tắc từ `DutyPeriodConfig` của tuần đó vào trong bản ghi `DutySnapshot`.
- Điều này giúp **bảo tồn lịch sử**: Kể cả sau này bạn có thay đổi định mức của tuần đó trong phần thiết lập, thì bản báo cáo đã chốt vẫn giữ nguyên bộ quy tắc cũ lúc nó được tạo ra.

### 3. Cơ chế "Khởi tạo tuần":

Đúng như bạn dự đoán, lúc bạn nhấn "Khởi tạo" hoặc lần đầu tiên truy cập vào một tuần trong Matrix View:

1.  Hệ thống tính `weekKey`.
2.  Nó sẽ tìm xem đã có `DutyPeriodConfig` cho `weekKey` này chưa.
3.  Nếu chưa, nó sẽ lấy "Bộ quy tắc mẫu" từ Cài đặt hệ thống để bạn xem thử (Simulate).
4.  Khi bạn nhấn "Lưu thiết lập tuần", nó sẽ tạo bản ghi `DutyPeriodConfig` chính thức gắn với `weekKey` đó.

**Kế hoạch bổ sung**:
Tôi sẽ thêm trường `weekKey` vào các Schema để việc "liên kết" này trở nên tường minh và dễ truy vấn hơn cho bạn sau này khi làm báo cáo tổng hợp.

Bạn thấy cách dùng `weekKey` (Mã tuần) này có hợp lý và tiện cho việc bạn xuất dữ liệu sau này không?

liệu là ràng buộc vào với nhau như vậy có ok không hay chỉ cần căn cứ theo khoảng ngày sẽ linh hoạt hơn nhưng tuy vấn sẽ phức tạp hơn ?

Câu hỏi của bạn rất thực tế. Hãy cùng cân tích hai hướng này để chọn phương án tối ưu:

### 1. Nếu dùng Khoảng ngày (Linh hoạt cao):

- **Ưu điểm**: Bạn có thể thiết lập định mức cho bất kỳ giai đoạn nào: 3 ngày Tết, 10 ngày chiến dịch, hoặc 1 tháng. Nó không bị bó buộc vào "thứ 2 đến chủ nhật".
- **Nhược điểm**: Truy vấn dùng `$gte` và `$lte` (lớn hơn hoặc bằng/nhỏ hơn hoặc bằng). Thực tế, với cơ sở dữ liệu hiện đại, việc này **không hề phức tạp hay chậm** nếu ta đánh index (chỉ mục) đúng cách.
- **Rủi ro**: Dễ bị chồng lấn ngày (ví dụ cấu hình 1 từ ngày 1-7, cấu hình 2 từ ngày 5-10).

### 2. Nếu dùng Ràng buộc Tuần (Chặt chẽ):

- **Ưu điểm**: Cực kỳ an toàn, không bao giờ lo trùng lặp hay hổng ngày giữa các tuần. Truy vấn rất nhanh.
- **Nhược điểm**: Thiếu linh hoạt. Nếu có một đợt trực đặc biệt kéo dài 10 ngày xuyên qua 2 tuần, bạn lại phải chia nhỏ nó ra làm 2 cấu hình tuần.

---

### **Lời khuyên của tôi: Hãy dùng "Khoảng ngày" nhưng quản lý theo "Tuần"**

Tôi đề xuất chúng ta sẽ dùng **Khoảng ngày (startDate, endDate)** trong Database để giữ sự linh hoạt, nhưng sẽ xây dựng logic ở Backend và Frontend để hỗ trợ bạn theo hướng **Tuần**:

1.  **Linh hoạt ngầm**: Database vẫn lưu ngày bắt đầu và ngày kết thúc. Nếu sau này bạn cần một giai đoạn đặc biệt (không phải tuần), hệ thống vẫn hỗ trợ được.
2.  **Tiện dụng ở giao diện**: Trong Matrix View, khi bạn nhấn "Thiết lập tuần", hệ thống tự động điền `startDate` là thứ 2 và `endDate` là chủ nhật. Bạn không cần tự nhập ngày.
3.  **Truy vấn thông minh**: Khi cần biết định mức của một ngày cụ thể, Backend chỉ cần tìm: `Cấu hình nào có [startDate <= Ngày đó <= endDate]`. Tôi sẽ xử lý phần index để đảm bảo tốc độ truy vấn là tức thì.
4.  **Liên kết bằng Snapshot**: Sợi dây liên kết mạnh nhất chính là **Snapshot**. Khi bạn chốt quyết toán, toàn bộ quy tắc (dù là theo tuần hay theo ngày lẻ) sẽ được "đóng băng" vào bản báo cáo đó. Bạn sẽ không bao giờ sợ dữ liệu bị trôi.

**Kết luận**: Bạn nên chọn **Khoảng ngày** để phòng xa cho tương lai (các dịp lễ, tết, chiến dịch đặc biệt). Tôi sẽ đảm bảo phần truy vấn không bị phức tạp hay chậm.

Bạn thấy phương án "Lưu theo ngày - Hiển thị theo tuần" này đã đủ yên tâm chưa? Nếu ok, tôi sẽ triển khai theo hướng này.
