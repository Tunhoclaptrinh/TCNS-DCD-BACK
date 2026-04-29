
const XLSX = require('xlsx');
const file = 'g:/Base/DSCN_DCDVV_PTIT - V2.xlsx';

try {
  const workbook = XLSX.readFile(file);
  const worksheet = workbook.Sheets['Mô tả chức năng'];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Search for "Thống kê" or "Báo cáo"
  data.forEach((row, i) => {
    const rowStr = JSON.stringify(row);
    if (rowStr.includes('Thống kê') || rowStr.includes('Báo cáo') || rowStr.includes('kíp')) {
      console.log(`Row ${i}:`, rowStr);
    }
  });
} catch (err) {
  console.error('Error:', err.message);
}
