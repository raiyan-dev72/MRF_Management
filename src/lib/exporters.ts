import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type Row = Record<string, string | number | undefined>;

function normalizeRows(rows: Row[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value === undefined ? '' : value]),
    ),
  );
}

export function exportToExcel(fileName: string, rows: Row[]) {
  const worksheet = XLSX.utils.json_to_sheet(normalizeRows(rows));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportToPdf(title: string, rows: Row[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 16);

  const normalizedRows = normalizeRows(rows);
  const headers = Object.keys(normalizedRows[0] ?? { Message: '' });
  const body = normalizedRows.map((row) => headers.map((header) => String(row[header] ?? '')));

  autoTable(doc, {
    startY: 24,
    head: [headers],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 125, 67] },
  });

  doc.save(`${title}.pdf`);
}

export function downloadText(fileName: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
