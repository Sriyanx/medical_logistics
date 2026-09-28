#!/usr/bin/env node

/**
 * Generate medicine names autocomplete database from CSV
 * 
 * Usage:
 *   node scripts/generate-medicine-names.js <csv-path>
 *   node scripts/generate-medicine-names.js "C:\Users\Sriyansh\Downloads\India Medicines and Drug Info Dataset.csv"
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Error: Please provide CSV file path');
  console.error('Usage: node scripts/generate-medicine-names.js <csv-path>');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`Error: File not found: ${csvPath}`);
  process.exit(1);
}

console.log(`Reading CSV file: ${csvPath}`);

try {
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  });

  const medicineNames = new Set();
  
  records.forEach((row, idx) => {
    const medName = (row['Medicine Name'] || '').trim();
    if (medName && medName !== 'Medicine Name') {
      medicineNames.add(medName);
    }
    
    if ((idx + 1) % 50000 === 0) {
      console.log(`Processed ${idx + 1} rows, found ${medicineNames.size} unique medicines...`);
    }
  });

  const medicineList = Array.from(medicineNames).sort();
  const outputPath = path.join(__dirname, '..', 'medicine-names.json');

  fs.writeFileSync(outputPath, JSON.stringify(medicineList, null, 2));

  console.log(`\n✓ Total rows processed: ${records.length}`);
  console.log(`✓ Unique medicine names: ${medicineList.length}`);
  console.log(`✓ Saved to: ${outputPath}`);
  console.log(`✓ File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
