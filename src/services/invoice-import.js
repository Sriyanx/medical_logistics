function normalizeExpiry(value) {
  if (!value) return null;
  const raw = String(value).trim();
  
  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    let day = Number.parseInt(dmy[1], 10);
    let month = Number.parseInt(dmy[2], 10);
    if (day <= 12 && month > 12) {
      // Swapped MM/DD/YYYY
      [day, month] = [month, day];
    }
    return `${dmy[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // MM/YYYY or MM-YYYY
  const my = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (my) {
    const month = Number.parseInt(my[1], 10);
    const year = Number.parseInt(my[2], 10);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  // MM/YY or MM-YY (e.g., 12/27 -> 2027-12-31)
  const myShort = raw.match(/^(\d{1,2})[-/.](\d{2})$/);
  if (myShort) {
    const month = Number.parseInt(myShort[1], 10);
    const year = 2000 + Number.parseInt(myShort[2], 10);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  // Month name formats like Dec-2027, DEC/27, Dec 2027
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const named = raw.match(/^([a-z]{3})[-/.\s]+(\d{2,4})$/i);
  if (named) {
    const mon = months[named[1].toLowerCase()];
    let yr = Number.parseInt(named[2], 10);
    if (yr < 100) yr += 2000;
    if (mon) {
      const lastDay = new Date(yr, mon, 0).getDate();
      return `${yr}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  return null;
}

function valueAfter(line, label) {
  const match = line.match(new RegExp(`(?:${label})\\s*[:#-]?\\s*([^|,;\\n]+?)(?=\\s+(?:batch|lot|exp|expiry|qty|quantity|rate|price|mrp)|\\s*[|,;]|$)`, 'i'));
  return match ? match[1].trim() : null;
}

function parseInvoiceText(text) {
  const items = [], unparsedLines = [];
  for (const original of String(text || '').split(/\r?\n/)) {
    const line = original.replace(/\s+/g, ' ').trim();
    if (!line || !/(qty|quantity)/i.test(line)) continue;
    const hasInvoiceFields = /(batch|lot|exp(?:iry)?|rate|price|unit price)/i.test(line);
    if (!hasInvoiceFields) continue;

    const batchNumber = valueAfter(line, 'batch(?:\\s*no|\\s*number)?|lot(?:\\s*no)?');
    const expiryRaw = valueAfter(line, 'exp(?:iry)?(?:\\s*date)?');
    const quantityRaw = valueAfter(line, 'qty|quantity');
    const priceRaw = valueAfter(line, 'rate|price|unit\\s*price|purchase\\s*rate');

    let productName = '';
    if (line.includes('|')) {
      const firstField = line.split('|')[0].trim();
      productName = firstField.replace(/^(?:\d+[\s.)-]+)?/i, '').replace(/\s+(?:batch|lot)\b.*/i, '').trim();
    } else {
      const match = line.match(/^(?:(?:\d+[\s.)-]+)?)(.*?)(?=\s+(?:batch|lot|exp|expiry|qty|quantity|rate|price)\b)/i);
      productName = match ? match[1].trim() : '';
    }

    const expiryDate = expiryRaw ? normalizeExpiry(expiryRaw) : null;
    const quantity = quantityRaw ? Number.parseInt(quantityRaw.replace(/[^0-9]/g, ''), 10) : NaN;
    const purchasePrice = priceRaw ? Number.parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : NaN;

    const item = { productName, batchNumber, expiryDate, quantity, purchasePrice };

    if (item.productName && item.batchNumber && item.expiryDate && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(item.purchasePrice) && item.purchasePrice >= 0) {
      items.push(item);
    } else {
      unparsedLines.push(original.trim());
    }
  }
  return { items, unparsedLines };
}

module.exports = { normalizeExpiry, parseInvoiceText };
