# LLM Workflow Architecture Overview

## Mục đích (Purpose)

Tài liệu này định nghĩa kiến trúc và các mô hình xử lý luồng công việc (workflow) dành cho các tính năng tích hợp AI/LLM trong dự án Backend. Tránh nhầm lẫn thuật ngữ "workflow" giữa CI/CD (GitHub Actions) và luồng xử lý của AI.

Cách tiếp cận phù hợp nhất cho dự án là **không chọn một mô hình duy nhất** mà kết hợp linh hoạt dựa trên độ phức tạp của bài toán.

## Khuyến nghị chính (Key Recommendations)

- **Prompt Chaining (Chuỗi Prompt)**: Làm xương sống cho hệ thống nếu nghiệp vụ có nhiều bước tuần tự, rõ ràng.
- **Routing (Phân luồng)**: Kết hợp khi input của người dùng có thể thuộc nhiều loại yêu cầu khác nhau (ví dụ: truy vấn dữ liệu vs thao tác cập nhật).
- **Evaluator / Validator (Người đánh giá / Xác thực)**: Áp dụng khi output cần đảm bảo chất lượng chặt chẽ hoặc tuân thủ đúng schema nhất định (ví dụ: trả về JSON cho frontend).
- **Agentic Workflow**: Chỉ sử dụng khi task đòi hỏi AI tự quyết định nhiều bước phức tạp, gọi tool ngoài, tra cứu DB/API hoặc xử lý các case không thể đoán trước được kịch bản.

## Các mô hình phổ biến & Ứng dụng (Models & Use Cases)

| Mô hình                 | Đặc điểm                                                                                | Phù hợp với                                                        | Ví dụ trong dự án                                                                        |
| :---------------------- | :-------------------------------------------------------------------------------------- | :----------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Prompt Chaining**     | Luồng xử lý tuần tự, cố định. Kết quả bước trước là đầu vào bước sau.                   | Các tác vụ có quy trình rõ ràng.                                   | Phân tích yêu cầu → Trích xuất dữ liệu → Kiểm tra quyền → Tạo kết quả.                   |
| **Routing**             | Phân loại intent của user để định tuyến đến prompt/agent phù hợp.                       | User có nhiều intent (mục đích) khác nhau trong cùng một endpoint. | Hỏi quyền, Đăng nhập, Quản lý duty shift, CRUD permission.                               |
| **Parallelization**     | Xử lý song song nhiều tác vụ độc lập rồi tổng hợp kết quả.                              | Nhiều khâu kiểm tra không phụ thuộc nhau.                          | Vừa check permission, vừa check dữ liệu, vừa check policy cùng lúc.                      |
| **Evaluator-Optimizer** | Một mô hình sinh kết quả, một mô hình khác (hoặc code) đánh giá và yêu cầu sửa nếu cần. | Output cần độ chính xác cao, đúng chuẩn cấu trúc.                  | Sinh chuỗi JSON, sinh email, tạo quyết định, viết báo cáo.                               |
| **Agent / Tool-use**    | Mô hình tự đưa ra kế hoạch và chủ động gọi các công cụ (tools/APIs).                    | Cần tương tác sâu với hệ thống backend.                            | Cần lấy dữ liệu động từ Database, gọi API bên thứ ba. (Cần giới hạn quyền/tool rõ ràng). |

## Kết luận (Conclusion)

Việc áp dụng AI vào Backend nên bắt đầu từ sự đơn giản và dễ kiểm soát:

1. Xây dựng nền tảng an toàn nhất bằng **Prompt Chaining + Routing + Validation**.
2. Chỉ khi phát sinh nhu cầu tự động hóa phức tạp và linh hoạt cao mới tiến hành nâng cấp lên **Agentic Workflow**.
