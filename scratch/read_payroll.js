
const XLSX = require('xlsx');
const file = 'g:/Base/tổng kíp/chấm công lấy lương theo kì.xlsx';

try {
  const workbook = XLSX.readFile(file);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  data.slice(0, 10).forEach((row, i) => {
    console.log(`Row ${i}:`, JSON.stringify(row));
  });
} catch (err) {
  console.error('Error:', err.message);
}
