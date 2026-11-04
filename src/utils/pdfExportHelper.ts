import { toCanvas } from 'html-to-image';
import jsPDF from 'jspdf';

export interface DownloadPdfOptions {
  format?: 'a4' | 'a5';
  orientation?: 'portrait' | 'landscape';
  backgroundColor?: string;
  pixelRatio?: number;
}

/**
 * Converts a DOM element into a downloadable PDF file.
 * Compatible with modern Tailwind CSS v4 color functions (oklch, color-mix, etc.)
 * Supports Unicode & Bengali (Bangla) characters via browser-native SVG rasterization.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: DownloadPdfOptions = {}
): Promise<void> {
  const {
    format = 'a4',
    orientation = 'portrait',
    backgroundColor = '#ffffff',
    pixelRatio = 2,
  } = options;

  let canvas: HTMLCanvasElement;

  try {
    // skipFonts: true prevents html-to-image from accessing document.styleSheets.cssRules,
    // which throws a SecurityError on cross-origin Google Fonts stylesheets.
    // The browser still renders active web fonts directly onto the canvas.
    canvas = await toCanvas(element, {
      backgroundColor,
      pixelRatio,
      cacheBust: true,
      skipFonts: true,
      fontEmbedCSS: '',
    });
  } catch (canvasErr) {
    console.warn('html-to-image toCanvas encountered an issue, retrying with pixelRatio 1.5', canvasErr);
    canvas = await toCanvas(element, {
      backgroundColor,
      pixelRatio: 1.5,
      cacheBust: true,
      skipFonts: true,
      fontEmbedCSS: '',
    });
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pdfHeight + 2) {
    // Fits on a single page
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
  } else {
    // Multi-page document
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    while (heightLeft > 2) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }
  }

  pdf.save(filename);
}
