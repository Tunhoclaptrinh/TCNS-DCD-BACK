
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const data = [
    ["Module", "Hành động chi tiết", "Đội trưởng (Admin)", "NS - Trưởng ban", "NS - Phó ban", "NS - Chuyên viên", "Ban khác - Trưởng ban", "Ban khác - Phó ban", "Thành viên", "CTV", "Vai trò khác"],
    ["Thành viên", "Xem danh sách (Toàn đội)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thành viên", "Xem danh sách (Nội bộ Ban)", "✓", "✓", "✓", "✓", "✓", "✓", "X", "X", "?"],
    ["Thành viên", "Xem hồ sơ chi tiết (Mọi người)", "✓", "✓", "✓", "✓", "✓", "✓", "X", "X", "?"],
    ["Thành viên", "Xem hồ sơ chi tiết (Cá nhân)", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "?"],
    ["Thành viên", "Thêm mới thành viên", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thành viên", "Sửa Profile (Họ tên, SĐT, ...)", "✓", "✓", "✓", "✓", "✓ (Ban)", "✓ (Ban)", "✓ (Cá nhân)", "✓ (Cá nhân)", "?"],
    ["Thành viên", "Sửa Chức vụ / Ban / Khóa", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thành viên", "Nâng hạng (Promote)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thành viên", "Khai trừ (Expel)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thành viên", "Nhập dữ liệu Excel (Import)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thành viên", "Xuất dữ liệu Excel (Export)", "✓", "✓", "✓", "✓", "✓ (Ban)", "✓ (Ban)", "X", "X", "?"],
    ["Thành viên", "Xóa vĩnh viễn tài khoản", "✓", "X", "X", "X", "X", "X", "X", "X", "?"],
    [],
    ["Lịch trực", "Xem lịch trực toàn đội", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "?"],
    ["Lịch trực", "Đăng ký / Hủy kíp cá nhân", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "?"],
    ["Lịch trực", "Đăng ký / Hủy kíp hộ", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Lịch trực", "Tạo / Sửa Bản mẫu (Template)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Lịch trực", "Dập khuôn lịch tuần", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Lịch trực", "Gắn kíp thủ công (Force assign)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Lịch trực", "Khóa kíp (Lock/Disable slot)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Lịch trực", "Phê duyệt Đổi ca / Nghỉ phép", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Lịch trực", "Điểm danh (Attendance)", "✓", "✓", "✓", "✓", "✓ (Ban)", "✓ (Ban)", "X", "X", "?"],
    [],
    ["Thưởng phạt", "Ghi nhận thưởng / phạt", "✓", "✓", "✓", "✓", "✓ (Ban)", "✓ (Ban)", "X", "X", "?"],
    ["Thưởng phạt", "Duyệt yêu cầu cộng điểm", "✓", "✓", "✓", "✓", "✓ (Ban)", "✓ (Ban)", "X", "X", "?"],
    ["Thưởng phạt", "Xem lịch sử (Toàn đội)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thưởng phạt", "Xem lịch sử (Cá nhân)", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "?"],
    ["Thưởng phạt", "Thống kê tài chính toàn đội", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Thưởng phạt", "Thống kê tài chính Ban", "✓", "✓", "✓", "✓", "✓", "✓", "X", "X", "?"],
    [],
    ["Họp hành", "Tạo lịch họp (Toàn đội)", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Họp hành", "Tạo lịch họp (Ban)", "✓", "✓", "✓", "✓", "✓", "✓", "X", "X", "?"],
    ["Họp hành", "Điểm danh họp", "✓", "✓", "✓", "✓", "✓ (Ban)", "✓ (Ban)", "X", "X", "?"],
    ["Họp hành", "Ghi biên bản cuộc họp", "✓", "✓", "✓", "✓", "✓", "✓", "X", "X", "?"],
    [],
    ["Góp ý", "Gửi ý kiến (Ẩn danh/Công khai)", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "?"],
    ["Góp ý", "Tiếp nhận & Phân loại ý kiến", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Góp ý", "Xử lý & Phản hồi ý kiến", "✓", "✓", "✓", "✓", "✓ (Ban)", "✓ (Ban)", "X", "X", "?"],
    [],
    ["Hệ thống", "Quản lý Vai trò & Nhóm quyền", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Hệ thống", "Cấu hình Niên khóa / Thế hệ", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Hệ thống", "Gửi thông báo toàn hệ thống", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Hệ thống", "Gửi thông báo theo Ban", "✓", "✓", "✓", "✓", "✓", "✓", "X", "X", "?"],
    [],
    ["Tài liệu", "Upload tài liệu minh chứng", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "?"],
    ["Tài liệu", "Quản lý kho tài liệu chung", "✓", "✓", "✓", "✓", "X", "X", "X", "X", "?"],
    ["Tài liệu", "Quản lý tài liệu nội bộ Ban", "✓", "✓", "✓", "✓", "✓", "✓", "X", "X", "?"]
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);

// Formatting
ws['!cols'] = [
    { wch: 15 }, // Module
    { wch: 35 }, // Hành động
    { wch: 18 }, // Đội trưởng
    { wch: 15 }, // NS - TB
    { wch: 15 }, // NS - PB
    { wch: 15 }, // NS - CV
    { wch: 18 }, // Ban khác - TB
    { wch: 18 }, // Ban khác - PB
    { wch: 12 }, // Thành viên
    { wch: 10 }, // CTV
    { wch: 15 }  // Vai trò khác
];

XLSX.utils.book_append_sheet(wb, ws, "Ma Trận Phân Quyền");

const exportPath = path.join('g:/Base', 'PhanQuyen_Detailed_Final.xlsx');
// Try to write, but catch EBUSY to avoid crash
try {
    XLSX.writeFile(wb, exportPath);
    console.log(`Excel file created successfully at: ${exportPath}`);
} catch (e) {
    console.error(`ERROR: Could not write Excel file. Is it open? ${e.message}`);
}

// Generate CSV with UTF-8 BOM
const csv = XLSX.utils.sheet_to_csv(ws);
const csvWithBOM = '\ufeff' + csv; 
const csvPath = path.join('g:/Base', 'PhanQuyen_Detailed_Final.csv');
fs.writeFileSync(csvPath, csvWithBOM, 'utf8');

console.log(`CSV file (with BOM) created successfully at: ${csvPath}`);
