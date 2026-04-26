const XLSX = require('xlsx');
const path = require('path');

function readExcel(filePath) {
  console.log(`\n--- Reading: ${path.basename(filePath)} ---`);
  const workbook = XLSX.readFile(filePath);
  workbook.SheetNames.forEach((sheetName) => {
    console.log(`\nSheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // Output first 50 rows to keep it manageable
    data.slice(0, 50).forEach((row, index) => {
      console.log(`${index}: ${JSON.stringify(row)}`);
    });
  });
}

const baseDir = 'g:/Base';
readExcel(path.join(baseDir, 'PhanQuyen.xlsx'));
readExcel(path.join(baseDir, 'DSCN_DCDVV_PTIT - V2.xlsx'));
