const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2] || path.join(__dirname, '../DSCN_DCDVV_PTIT - V2.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach((sheetName) => {
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log(`\n--- Sheet: ${sheetName} ---`);
  data.forEach((row, index) => {
    const rowStr = JSON.stringify(row);
    if (rowStr.includes('000') || rowStr.toLowerCase().includes('phạt') || rowStr.toLowerCase().includes('vắng')) {
      console.log(`${index}: ${rowStr}`);
    }
  });
});
