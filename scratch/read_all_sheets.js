
const XLSX = require('xlsx');
const file = 'g:/Base/DSCN_DCDVV_PTIT - V2.xlsx';

try {
  const workbook = XLSX.readFile(file);
  console.log('Sheet Names:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(name => {
    console.log(`\n--- Sheet: ${name} ---`);
    const worksheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    data.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i}:`, JSON.stringify(row));
    });
  });
} catch (err) {
  console.error('Error:', err.message);
}
