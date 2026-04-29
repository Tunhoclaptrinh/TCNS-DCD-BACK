
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  'g:/Base/DSCN_DCDVV_PTIT - V2.xlsx',
  'g:/Base/tổng kíp/dữ liệu tổng kíp tháng.xlsx'
];

files.forEach(file => {
  try {
    console.log(`\n--- Reading: ${file} ---`);
    const workbook = XLSX.readFile(file);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Print first 10 rows
    data.slice(0, 10).forEach((row, i) => {
      console.log(`Row ${i}:`, JSON.stringify(row));
    });
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
});
