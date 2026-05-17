import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, ImageRun, TextRun, AlignmentType } from 'docx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { InventoryItem } from '../types';
import { format } from 'date-fns';

/**
 * Utility to convert an image URL or Base64 to a data URI
 */
async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string), false);
    reader.addEventListener('error', () => reject());
    reader.readAsDataURL(blob);
  });
}

/**
 * Utility to get array buffer from image URL/Base64
 */
async function getImageArrayBuffer(imageUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(imageUrl);
  return await res.arrayBuffer();
}

/**
 * Export to PDF
 */
export async function exportToPDF(items: InventoryItem[]) {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'yyyy-MM-dd HH:mm');

  doc.setFontSize(22);
  doc.setTextColor(0);
  doc.text('INVSG02', 14, 20);
  doc.setFontSize(16);
  doc.text('Laporan Inventaris Barang', 14, 30);
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Dicetak pada: ${dateStr}`, 14, 38);

  const tableData = await Promise.all(items.map(async (item, index) => {
    return [
      (index + 1).toString(),
      '', // Placeholder for image
      item.name,
      item.quantity.toString(),
      format(item.updatedAt, 'dd MMM yyyy')
    ];
  }));

  autoTable(doc, {
    startY: 45,
    head: [['No', 'Gambar', 'Nama Barang', 'Jumlah', 'Terakhir Update']],
    body: tableData,
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const item = items[data.row.index];
        if (item.imageUrl) {
          try {
            const x = data.cell.x + 2;
            const y = data.cell.y + 2;
            const w = 16;
            const h = 16;
            doc.addImage(item.imageUrl, 'JPEG', x, y, w, h);
          } catch (e) {
            console.error('Error adding image to PDF cell', e);
          }
        }
      }
    },
    // @ts-ignore
    styles: { minCellHeight: 20, valign: 'middle' },
    columnStyles: {
      1: { cellWidth: 25 },
    }
  });

  doc.save(`Inventaris_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

/**
 * Export to Word
 */
export async function exportToWord(items: InventoryItem[]) {
  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: "No", alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Gambar", alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Nama Barang", alignment: AlignmentType.CENTER })], width: { size: 45, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Jumlah", alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ text: "Tanggal", alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
      ],
    }),
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let imageRun: ImageRun | undefined;

    try {
      const buffer = await getImageArrayBuffer(item.imageUrl);
      // @ts-ignore
      imageRun = new ImageRun({
        data: buffer,
        transformation: { width: 50, height: 50 },
      });
    } catch (e) {
      console.error('Failed to load image for Word', e);
    }

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: (i + 1).toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [imageRun ? new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER }) : new Paragraph("")] }),
          new TableCell({ children: [new Paragraph({ text: item.name })] }),
          new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: format(item.updatedAt, 'dd/MM/yyyy') })] }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "INVSG02", bold: true, size: 48, color: "000000" })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: "LAPORAN INVENTARIS BARANG", bold: true, size: 32, color: "666666" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm')}`, size: 20, color: "999999" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
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
  saveAs(blob, `Inventaris_${format(new Date(), 'yyyyMMdd')}.docx`);
}

/**
 * Export to Excel
 */
export async function exportToExcel(items: InventoryItem[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventaris');

  // Add header
  worksheet.mergeCells('A1:E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'INVSG02 - LAPORAN INVENTARIS BARANG';
  titleCell.font = { name: 'Arial', size: 16, bold: true };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('A2:E2');
  const dateCell = worksheet.getCell('A2');
  dateCell.value = `Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  dateCell.font = { name: 'Arial', size: 10, italic: true };
  dateCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.getRow(4).values = ['No', 'Gambar', 'Nama Barang', 'Jumlah', 'Terakhir Update'];
  worksheet.columns = [
    { key: 'no', width: 5 },
    { key: 'image', width: 18 },
    { key: 'name', width: 35 },
    { key: 'quantity', width: 12 },
    { key: 'updatedAt', width: 22 },
  ];

  // Formatting header row
  worksheet.getRow(4).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowIndex = i + 5;
    worksheet.addRow({
      no: i + 1,
      name: item.name,
      quantity: item.quantity,
      updatedAt: format(item.updatedAt, 'dd/MM/yyyy HH:mm'),
    });

    const row = worksheet.getRow(rowIndex);
    row.height = 60;
    row.alignment = { vertical: 'middle' };

    try {
      if (item.imageUrl) {
        const buffer = await getImageArrayBuffer(item.imageUrl);
        const imageId = workbook.addImage({
          buffer: buffer,
          extension: 'jpeg',
        });

        worksheet.addImage(imageId, {
          tl: { col: 1, row: rowIndex - 1 },
          ext: { width: 60, height: 60 },
          editAs: 'oneCell'
        });
      }
    } catch (e) {
      console.error('Failed to add image to Excel', e);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Inventaris_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}
