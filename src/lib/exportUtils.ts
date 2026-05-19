import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, ImageRun, TextRun, AlignmentType } from 'docx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { InventoryItem } from '../types';
import { format } from 'date-fns';

/**
 * Utility to convert an image URL or Base64 to a data URI reliably with timeout
 */
async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const res = await fetch(imageUrl, { 
      mode: 'cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image for export:', error);
    return ''; 
  }
}

/**
 * Utility to get array buffer from image URL/Base64 reliably
 */
async function getImageArrayBuffer(imageUrl: string): Promise<ArrayBuffer | null> {
  if (!imageUrl) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(imageUrl, { 
      mode: 'cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (error) {
    console.error('Error fetching image buffer:', error);
    return null;
  }
}

function formatSafeDate(timestamp: any, formatStr: string) {
  if (!timestamp) return '-';
  
  // Handle Firestore Timestamp
  if (timestamp && typeof timestamp.toDate === 'function') {
    return format(timestamp.toDate(), formatStr);
  }
  
  // Handle Number/String
  try {
    return format(new Date(timestamp), formatStr);
  } catch (e) {
    return '-';
  }
}

/**
 * Export to PDF
 */
export async function exportToPDF(items: InventoryItem[]) {
  const doc = new jsPDF();
  const dateStr = formatSafeDate(interactionDate(), 'dd MMMM yyyy HH:mm');
  const filenameDate = formatSafeDate(new Date(), 'yyyyMMdd_HHmm');

  // Header Branding
  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.text('INVSG02', 14, 20);
  
  doc.setFontSize(16);
  doc.setTextColor(60, 66, 72);
  doc.text('Laporan Inventaris Barang', 14, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Tanggal Cetak: ${dateStr}`, 14, 38);
  
  doc.setDrawColor(240, 240, 240);
  doc.line(14, 42, 196, 42);

  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    '', // Placeholder for image
    item.name,
    item.quantity.toString(),
    formatSafeDate(item.updatedAt, 'dd/MM/yyyy HH:mm')
  ]);

  // Pre-fetch images to prevent async issues during rendering
  const images = await Promise.all(
    items.map(async (item) => {
      if (!item.imageUrl) return null;
      return await getBase64ImageFromUrl(item.imageUrl);
    })
  );

  autoTable(doc, {
    startY: 48,
    head: [['No', 'Gambar', 'Nama Barang', 'Jumlah', 'Update Terakhir']],
    body: tableData,
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const base64 = images[data.row.index];
        if (base64) {
          try {
            const x = data.cell.x + 3;
            const y = data.cell.y + 3;
            const size = 14;
            doc.addImage(base64, 'JPEG', x, y, size, size);
          } catch (e) {
            console.error('Error drawing image in PDF:', e);
          }
        }
      }
    },
    styles: { minCellHeight: 20, valign: 'middle', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 25 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 40, halign: 'center' },
    }
  });

  const blob = doc.output('blob');
  saveAs(blob, `INVSG02_Inventaris_${filenameDate}.pdf`);
}

function interactionDate() {
  return new Date();
}

/**
 * Export to Word
 */
export async function exportToWord(items: InventoryItem[]) {
  const dateStr = formatSafeDate(new Date(), 'dd MMMM yyyy HH:mm');
  const filenameDate = formatSafeDate(new Date(), 'yyyyMMdd_HHmm');

  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: "No", alignment: AlignmentType.CENTER, style: 'bold' })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Gambar", alignment: AlignmentType.CENTER, style: 'bold' })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Nama Barang", alignment: AlignmentType.CENTER, style: 'bold' })], width: { size: 45, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Jumlah", alignment: AlignmentType.CENTER, style: 'bold' })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Terakhir Update", alignment: AlignmentType.CENTER, style: 'bold' })], width: { size: 20, type: WidthType.PERCENTAGE } }),
      ],
    }),
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let imageRun: ImageRun | undefined;

    try {
      if (item.imageUrl) {
        const buffer = await getImageArrayBuffer(item.imageUrl);
        if (buffer) {
          imageRun = new ImageRun({
            data: buffer,
            transformation: { width: 60, height: 60 },
            // Need to specify type in newer versions
            type: 'png', // Fallback to png usually works for both as it detects mime
          });
        }
      }
    } catch (e) {
      console.error('Failed image for docx:', e);
    }

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: (i + 1).toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ 
            children: [
              imageRun ? new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER }) : new Paragraph({ text: "-", alignment: AlignmentType.CENTER })
            ],
            verticalAlign: 'center'
          }),
          new TableCell({ children: [new Paragraph({ text: item.name })], verticalAlign: 'center' }),
          new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })], verticalAlign: 'center' }),
          new TableCell({ children: [new Paragraph({ text: formatSafeDate(item.updatedAt, 'dd/MM/yyyy HH:mm'), alignment: AlignmentType.CENTER })], verticalAlign: 'center' }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "INVSG02", bold: true, size: 52, color: "000000" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "LAPORAN INVENTARIS BARANG", bold: true, size: 36, color: "555555" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Dicetak pada: ${dateStr}`, size: 20, color: "777777" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `INVSG02_Inventaris_${filenameDate}.docx`);
}

/**
 * Export to Excel
 */
export async function exportToExcel(items: InventoryItem[]) {
  const filenameDate = formatSafeDate(new Date(), 'yyyyMMdd_HHmm');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventaris');

  // Add Header Branding
  worksheet.mergeCells('A1:E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'INVSG02 - LAPORAN INVENTARIS BARANG';
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: '000000' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 40;

  worksheet.mergeCells('A2:E2');
  const dateCell = worksheet.getCell('A2');
  dateCell.value = `Tanggal Cetak: ${formatSafeDate(new Date(), 'dd MMMM yyyy HH:mm')}`;
  dateCell.font = { name: 'Arial', size: 11, color: { argb: '666666' } };
  dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 25;

  worksheet.getRow(4).values = ['No', 'Gambar', 'Nama Barang', 'Jumlah', 'Update Terakhir'];
  worksheet.getRow(4).height = 30;
  worksheet.getRow(4).eachCell((cell) => {
    cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  worksheet.columns = [
    { key: 'no', width: 6 },
    { key: 'image', width: 20 },
    { key: 'name', width: 40 },
    { key: 'quantity', width: 15 },
    { key: 'updatedAt', width: 25 },
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowIndex = i + 5;
    const row = worksheet.addRow({
      no: i + 1,
      name: item.name,
      quantity: item.quantity,
      updatedAt: formatSafeDate(item.updatedAt, 'dd/MM/yyyy HH:mm'),
    });

    row.height = 70;
    row.alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('quantity').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('updatedAt').alignment = { vertical: 'middle', horizontal: 'center' };

    // Apply borders
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    try {
      if (item.imageUrl) {
        const buffer = await getImageArrayBuffer(item.imageUrl);
        if (buffer) {
          const imageId = workbook.addImage({
            buffer: buffer,
            extension: 'jpeg',
          });

          worksheet.addImage(imageId, {
            tl: { col: 1, row: rowIndex - 1 },
            ext: { width: 70, height: 70 },
            editAs: 'oneCell'
          });
        }
      }
    } catch (e) {
      console.error('Failed Excel Image:', e);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `INVSG02_Inventaris_${filenameDate}.xlsx`);
}
