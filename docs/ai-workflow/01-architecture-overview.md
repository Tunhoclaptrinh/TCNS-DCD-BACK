# LLM Workflow Architecture Overview

## Mục đích (Purpose)

Tài liệu này định nghĩa kiến trúc và các mô hình xử lý luồng công việc (workflow) dành cho các tính năng tích hợp AI/LLM trong dự án Backend, ưu tiên sự cân bằng giữa **Hiệu năng, Độ chính xác và Chi phí (Token Efficiency)**.

## Nguyên tắc cốt lõi (Core Principles)

1.  **Efficiency First**: Luôn ưu tiên các mô hình ít tốn token. Tránh gửi context dư thừa vào prompt.
2.  **Modular Chaining**: Chia nhỏ các tác vụ AI thành các bước rời rạc (Router -> Extraction -> Logic).
3.  **Backend Control**: Code backend là người điều phối dòng chảy (Flow controller), không để AI tự ý quyết định toàn bộ quy trình.
4.  **Strict Validation**: Mọi output từ AI phải được validate bằng code (Zod/Joi) trước khi thực thi nghiệp vụ.

## Các mô hình & Chiến lược Lựa chọn Model (Dynamic Tiering)

Hệ thống áp dụng chiến lược **"Ưu tiên Chất lượng, Hạ cấp Linh hoạt"**: Luôn cố gắng dùng model tốt nhất để có kết quả chính xác, nhưng tự động chuyển sang model tiết kiệm khi cần tối ưu token hoặc chạm giới hạn.

## Chiến lược Lựa chọn Model (The Fallback Ladder)

Hệ thống không giới hạn model cố định mà sử dụng cơ chế **Hạ cấp bậc thang (Cascading Fallback)** để luôn đảm bảo chất lượng cao nhất trong phạm vi hạn mức cho phép.

| Nhiệm vụ       | **Cấp 1: Elite** (Ưu tiên) | **Cấp 2: Pro** (Dự phòng 1) | **Cấp 3: Flash** (Dự phòng 2) |
| :------------- | :------------------------- | :-------------------------- | :---------------------------- |
| **Routing**    | `gpt-5.5`                  | `claude-4-haiku`            | `gemini-3-flash`              |
| **Extraction** | `claude-4.6-sonnet`        | `gpt-5`                     | `gemini-3-flash`              |
| **Logic Step** | `claude-4.6-sonnet`        | `gemini-3-pro`              | `gpt-5.5-mini`                |
| **Validation** | `gpt-5.5`                  | `claude-4.6-sonnet`         | `gemini-3-flash`              |

**Nguyên tắc vận hành:**

1. Luôn bắt đầu bằng **Cấp 1** để có kết quả tốt nhất.
2. Nếu gặp lỗi `429 (Rate Limit)` hoặc `Context Overflow`, tự động hạ xuống **Cấp 2**.
3. Nếu vẫn không được hoặc cần xử lý số lượng lớn (Batch), sử dụng **Cấp 3** để tối ưu hóa token.

## Kết luận (Conclusion)

Việc áp dụng AI vào Backend nên bắt đầu từ sự đơn giản:

1. Xây dựng nền tảng bằng **Prompt Chaining + Routing + Validation**.
2. Luôn tối ưu Prompt (Sử dụng XML tags cho Claude, JSON Schema cho Gemini).
3. Chỉ nâng cấp lên **Agentic Workflow** khi thực sự cần tính linh hoạt cao và đã kiểm soát được rủi ro/chi phí.
