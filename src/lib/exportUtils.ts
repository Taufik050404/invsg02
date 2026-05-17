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

  doc.setFontSize(20);
  doc.text('Laporan Inventaris Barang', 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Dicetak pada: ${dateStr}`, 14, 30);

  const tableData = await Promise.all(items.map(async (item, index) => {
    let imgData = '';
    try {
      imgData = await getBase64ImageFromUrl(item.imageUrl);
    } catch (e) {
      console.error('Failed to load image for PDF', e);
    }
    return [
      (index + 1).toString(),
      imgData, // We'll handle drawing images in didParseCell or similar if needed, or row height
      item.name,
      item.quantity.toString(),
      format(item.updatedAt, 'dd MMM yyyy')
    ];
  }));

  autoTable(doc, {
    startY: 40,
    head: [['No', 'Gambar', 'Nama Barang', 'Jumlah', 'Terakhir Update']],
    body: tableData.map(row => [row[0], '', row[2], row[3], row[4]]),
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const item = items[data.row.index];
        if (item.imageUrl) {
          try {
            // jspdf-autotable handles positioning, we just need to draw the image
            const x = data.cell.x + 2;
            const y = data.cell.y + 2;
            const w = 15;
            const h = 15;
            // Note: In a real app we'd pre-load all images for better performance
            // For now we'll assume they are cached or already loaded
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
            children: [new TextRun({ text: "LAPORAN INVENTARIS BARANG", bold: true, size: 32 })],
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

  worksheet.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Gambar', key: 'image', width: 15 },
    { header: 'Nama Barang', key: 'name', width: 40 },
    { header: 'Jumlah', key: 'quantity', width: 10 },
    { header: 'Terakhir Update', key: 'updatedAt', width: 20 },
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowIndex = i + 2;
    worksheet.addRow({
      no: i + 1,
      name: item.name,
      quantity: item.quantity,
      updatedAt: format(item.updatedAt, 'dd/MM/yyyy HH:mm'),
    });

    try {
      const buffer = await getImageArrayBuffer(item.imageUrl);
      const imageId = workbook.addImage({
        buffer: buffer,
        extension: 'jpeg', // Or dynamic detection
      });

      worksheet.addImage(imageId, {
        tl: { col: 1, row: i + 1 },
        ext: { width: 50, height: 50 },
        editAs: 'oneCell'
      });
      worksheet.getRow(rowIndex).height = 45;
    } catch (e) {
      console.error('Failed to add image to Excel', e);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Inventaris_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}
