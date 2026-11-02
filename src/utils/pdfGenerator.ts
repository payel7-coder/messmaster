import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport } from '../types';
import { formatReadableDate, formatReadableMonth } from '../utils';

export interface PdfReportOptions {
  includeBazaarList?: boolean;
  includeFixedCostsBreakdown?: boolean;
  includeMemberSlips?: boolean;
  customNotes?: string;
  managerName?: string;
  managerPhone?: string;
}

export function generateMonthlyReportPdf(
  report: MonthReport,
  boarders: Boarder[],
  deposits: Deposit[],
  mealLogs: DailyMealLog[],
  bazaarCosts: BazaarCost[],
  miscCosts: MiscellaneousCosts,
  settings: MessSettings,
  options: PdfReportOptions = {}
): jsPDF {
  const {
    includeBazaarList = true,
    includeFixedCostsBreakdown = true,
    includeMemberSlips = true,
    customNotes = 'Please clear all dues before the 5th of the month. Keep payment transaction slip or cash receipt.',
    managerName = 'Mess Manager',
    managerPhone = '',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const activeMonthStr = formatReadableMonth(report.month);
  const activeBoardersCount = boarders.filter(b => b.isActive).length;

  // Header: Clean white background with black text (no background color)
  // Mess title
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((settings.messName || 'Mess').toUpperCase(), 14, 12);

  // Subtitle
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`MONTHLY AUDIT STATEMENT & MEAL EXPENSE REPORT - ${activeMonthStr.toUpperCase()}`, 14, 18);

  // Generation timestamp on right
  const now = new Date();
  const generatedDateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Generated: ${generatedDateStr}`, pageWidth - 14, 18, { align: 'right' });

  // Divider line: clean black line on white background
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(14, 22, pageWidth - 14, 22);

  // Executive KPI summary box
  let currentY = 28;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. EXECUTIVE FINANCIAL SUMMARY', 14, currentY);
  currentY += 4;

  const kpis = [
    { label: 'Total Meals Consumed', value: `${report.totalMeals.toFixed(1)} meals` },
    { label: 'Total Bazaar Spent', value: `Tk ${report.totalBazaarCost.toLocaleString('en-IN')}` },
    { label: 'Calculated Meal Rate', value: `Tk ${report.mealRate.toFixed(4)} / meal` },
    { label: 'Total Shared Fixed Bills', value: `Tk ${report.totalFixedCost.toLocaleString('en-IN')}` },
    { label: 'Fixed Share (Per Boarder)', value: `Tk ${report.boardersReport[0]?.fixedCostShare?.toFixed(2) || '0.00'}` },
    { label: 'Total Cash Deposited', value: `Tk ${report.totalDeposits.toLocaleString('en-IN')}` },
  ];

  const netBalance = report.totalDeposits - (report.totalBazaarCost + report.totalFixedCost);
  const netLabel = netBalance >= 0 ? 'Surplus Balance (Cash in Hand)' : 'Deficit / Shortfall';
  kpis.push({
    label: netLabel,
    value: `${netBalance >= 0 ? '+' : '-'}Tk ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  });

  const cardWidth = (pageWidth - 28 - 6) / 3; // 3 columns with 3mm gap
  const cardHeight = 13;

  kpis.forEach((kpi, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 14 + col * (cardWidth + 3);
    const y = currentY + row * (cardHeight + 2);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 2.5, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    if (idx === 6) {
      if (netBalance >= 0) {
        doc.setTextColor(21, 128, 61); // Green
      } else {
        doc.setTextColor(185, 28, 28); // Red
      }
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(kpi.value, x + 2.5, y + 10);
  });

  currentY += Math.ceil(kpis.length / 3) * (cardHeight + 2) + 6;

  // Master Boarder Table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. MASTER BOARDER BALANCE SHEET', 14, currentY);
  currentY += 2;

  const tableRows = report.boardersReport.map((bSum, index) => {
    const bDetails = boarders.find(b => b.id === bSum.boarderId);
    const room = bDetails?.roomNo ? ` [${bDetails.roomNo}]` : '';
    const status = bDetails?.isActive ? '' : ' (Inactive)';
    const balanceSign = bSum.balance >= 0 ? '+' : '';
    const statusNote = bSum.balance >= 0 ? 'Refund' : 'Due';

    return [
      (index + 1).toString(),
      `${bSum.boarderName}${room}${status}`,
      bSum.totalMeals.toString(),
      `Tk ${bSum.mealCost.toFixed(2)}`,
      `Tk ${bSum.fixedCostShare.toFixed(2)}`,
      `Tk ${bSum.totalCost.toFixed(2)}`,
      `Tk ${bSum.totalDeposit.toFixed(2)}`,
      `${balanceSign}Tk ${bSum.balance.toFixed(2)} (${statusNote})`,
      '', // Signature space
    ];
  });

  // Grand totals row
  const totalDueRefund = report.totalDeposits - (report.totalBazaarCost + report.totalFixedCost);
  const totalRow = [
    '',
    'GRAND TOTALS',
    report.totalMeals.toString(),
    `Tk ${report.totalBazaarCost.toFixed(2)}`,
    `Tk ${report.totalFixedCost.toFixed(2)}`,
    `Tk ${(report.totalBazaarCost + report.totalFixedCost).toFixed(2)}`,
    `Tk ${report.totalDeposits.toFixed(2)}`,
    `${totalDueRefund >= 0 ? '+' : ''}Tk ${totalDueRefund.toFixed(2)}`,
    '',
  ];

  autoTable(doc, {
    startY: currentY,
    head: [
      ['#', 'Member Name', 'Meals', 'Meal Cost (A)', 'Fixed Share (B)', 'Charged (A+B)', 'Deposit', 'Net Balance', 'Signature'],
    ],
    body: [...tableRows, totalRow],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 16, halign: 'center' },
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    didParseCell: (data) => {
      // Highlight Grand Total row
      if (data.row.index === tableRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
      // Balance column coloring
      if (data.column.index === 7 && data.section === 'body') {
        const text = data.cell.text[0] || '';
        if (text.includes('Refund') || text.startsWith('+')) {
          data.cell.styles.textColor = [21, 128, 61]; // green
        } else if (text.includes('Due') || text.startsWith('-')) {
          data.cell.styles.textColor = [185, 28, 28]; // red
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Calculate position after table
  // @ts-ignore
  currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : currentY + 40;

  // Fixed Costs Itemized Breakdown Table
  if (includeFixedCostsBreakdown) {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('3. SHARED FIXED BILLS ITEMIZED BREAKDOWN', 14, currentY);
    currentY += 2;

    const fixedItems: string[][] = [
      ['House Rent', `Tk ${miscCosts.houseRent.toLocaleString('en-IN')}`, 'Equally shared among active members'],
      ['Cooker / Maid Salary', `Tk ${miscCosts.cookerBill.toLocaleString('en-IN')}`, 'Equally shared among active members'],
      ['Gas Bill', `Tk ${miscCosts.gasBill.toLocaleString('en-IN')}`, 'Equally shared among active members'],
      ['Electricity & Utility', `Tk ${miscCosts.utilityBill.toLocaleString('en-IN')}`, 'Equally shared among active members'],
      ['WiFi & Internet', `Tk ${miscCosts.wifiBill.toLocaleString('en-IN')}`, 'Equally shared among active members'],
      ['Other / Cleaning / Misc', `Tk ${miscCosts.otherCosts.toLocaleString('en-IN')}`, 'Equally shared among active members'],
    ];

    if (miscCosts.customBills && miscCosts.customBills.length > 0) {
      miscCosts.customBills.forEach(cb => {
        fixedItems.push([cb.name, `Tk ${Number(cb.amount).toLocaleString('en-IN')}`, 'Equally shared among active members (Custom Category)']);
      });
    }

    fixedItems.push([
      'TOTAL FIXED COSTS', 
      `Tk ${report.totalFixedCost.toLocaleString('en-IN')}`, 
      `${activeBoardersCount} active members = Tk ${(report.boardersReport[0]?.fixedCostShare || 0).toFixed(2)} per person`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Expense Category', 'Total Amount', 'Distribution Rule']],
      body: fixedItems,
      theme: 'grid',
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontSize: 7.5,
      },
      styles: {
        fontSize: 7.2,
        cellPadding: 1.6,
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 92 },
      },
      didParseCell: (data) => {
        if (data.row.index === fixedItems.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
    });

    // @ts-ignore
    currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : currentY + 30;
  }

  // Notes and Manager remarks
  if (customNotes) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, currentY, pageWidth - 28, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Important Instructions / Notice from Manager:', 17, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(customNotes, 17, currentY + 10, { maxWidth: pageWidth - 34 });

    currentY += 22;
  }

  // Signatures on Page 1 or current page
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 30;
  }

  const signY = Math.max(currentY + 12, pageHeight - 32);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);

  // Manager signature line
  doc.line(18, signY, 75, signY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Manager: ${managerName}${managerPhone ? ` (${managerPhone})` : ''}`, 18, signY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signature & Date', 18, signY + 7.5);

  // Committee Member line
  doc.line(pageWidth - 75, signY, pageWidth - 18, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Audit / Committee Representative', pageWidth - 75, signY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature & Verification', pageWidth - 75, signY + 7.5);

  // Daily Bazaar Ledger (Page 2 / subsequent page)
  const currentMonthBazaars = bazaarCosts.filter(b => b.date.startsWith(report.month));
  if (includeBazaarList && currentMonthBazaars.length > 0) {
    doc.addPage();
    currentY = 20;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`4. DAILY BAZAAR & EXPENSE LOG - ${activeMonthStr.toUpperCase()}`, 14, currentY);
    currentY += 4;

    const bazaarRows = currentMonthBazaars
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item, idx) => {
        const buyer = boarders.find(b => b.id === item.spentById)?.name || 'Manager';
        return [
          (idx + 1).toString(),
          formatReadableDate(item.date),
          item.description,
          buyer,
          `Tk ${item.amount.toLocaleString('en-IN')}`,
        ];
      });

    const totalBazaarAmt = currentMonthBazaars.reduce((acc, curr) => acc + curr.amount, 0);
    bazaarRows.push([
      '',
      'TOTAL BAZAAR',
      `${currentMonthBazaars.length} purchases recorded`,
      '',
      `Tk ${totalBazaarAmt.toLocaleString('en-IN')}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Date', 'Description / Items', 'Purchased By', 'Amount']],
      body: bazaarRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 90 },
        3: { cellWidth: 30 },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 7.2,
        cellPadding: 1.8,
      },
      didParseCell: (data) => {
        if (data.row.index === bazaarRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Individual printable vouchers / slips (4 per page)
  if (includeMemberSlips && report.boardersReport.length > 0) {
    doc.addPage();
    let slipY = 16;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`5. INDIVIDUAL MEMBER INVOICE SLIPS - ${activeMonthStr.toUpperCase()}`, 14, slipY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Cut along perforated lines and distribute to each boarder for physical records.', 14, slipY + 4);
    slipY += 9;

    const slipWidth = (pageWidth - 28 - 6) / 2;
    const slipHeight = 60;
    const slipsPerPage = 4;

    report.boardersReport.forEach((bSum, index) => {
      const pageIndex = index % slipsPerPage;
      if (index > 0 && pageIndex === 0) {
        doc.addPage();
        slipY = 16;
      }

      const row = Math.floor(pageIndex / 2);
      const col = pageIndex % 2;
      const x = 14 + col * (slipWidth + 6);
      const y = slipY + row * (slipHeight + 6);

      const bDetails = boarders.find(b => b.id === bSum.boarderId);

      // Voucher box outline
      doc.setDrawColor(180, 195, 210);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, slipWidth, slipHeight, 2, 2, 'FD');
      doc.setLineDashPattern([], 0); // reset dash

      // Header inside slip: pure white background with black text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(settings.messName || 'Mess', x + 3, y + 5);

      const roomStr = bDetails?.roomNo || bSum.roomNo;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(0, 0, 0);
      const invoiceSubtitle = roomStr
        ? `Invoice Voucher • ${report.month}  |  ${roomStr}`
        : `Invoice Voucher • ${report.month}`;
      doc.text(invoiceSubtitle, x + 3, y + 9);

      // Divider below slip header
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.25);
      doc.line(x + 1, y + 11.5, x + slipWidth - 1, y + 11.5);

      // Status pill
      const isSurplus = bSum.balance >= 0;
      doc.setFillColor(isSurplus ? 220 : 254, isSurplus ? 252 : 226, isSurplus ? 231 : 226);
      doc.roundedRect(x + slipWidth - 28, y + 2, 25, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
      doc.text(isSurplus ? 'REFUNDABLE' : 'DUE TO PAY', x + slipWidth - 15.5, y + 6.5, { align: 'center' });

      // Member details
      let itemY = y + 16;
      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const memberTitle = roomStr 
        ? `Member: ${bSum.boarderName} [${roomStr}]` 
        : `Member: ${bSum.boarderName}`;
      doc.text(memberTitle, x + 3, itemY);
      if (bDetails?.phone) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Ph: ${bDetails.phone}`, x + slipWidth - 3, itemY, { align: 'right' });
      }

      itemY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Meals Count: ${bSum.totalMeals} (Rate: Tk ${report.mealRate.toFixed(2)})`, x + 3, itemY);
      doc.text(`Meals Cost: Tk ${bSum.mealCost.toFixed(2)}`, x + slipWidth - 3, itemY, { align: 'right' });

      itemY += 4.5;
      doc.text('Shared Fixed Bills Share:', x + 3, itemY);
      doc.text(`Tk ${bSum.fixedCostShare.toFixed(2)}`, x + slipWidth - 3, itemY, { align: 'right' });

      itemY += 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Total Cost Charged:', x + 3, itemY);
      doc.text(`Tk ${bSum.totalCost.toFixed(2)}`, x + slipWidth - 3, itemY, { align: 'right' });

      itemY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(37, 99, 235);
      doc.text('Total Cash Deposited:', x + 3, itemY);
      doc.text(`Tk ${bSum.totalDeposit.toFixed(2)}`, x + slipWidth - 3, itemY, { align: 'right' });

      // Net balance highlight bar
      itemY += 4.5;
      doc.setFillColor(isSurplus ? 240 : 255, isSurplus ? 253 : 241, isSurplus ? 244 : 242);
      doc.rect(x + 2, itemY, slipWidth - 4, 7, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
      doc.text(isSurplus ? 'Closing Refundable:' : 'Net Outstanding Due:', x + 4, itemY + 4.8);
      doc.text(`Tk ${Math.abs(bSum.balance).toFixed(2)}`, x + slipWidth - 4, itemY + 4.8, { align: 'right' });

      // Slip signatures
      itemY += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Boarder Signature', x + 5, itemY);
      doc.text('Manager Verification', x + slipWidth - 5, itemY, { align: 'right' });
    });
  }

  // Add Page numbers footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${settings.messName || 'Mess'} • Monthly Audit Statement (${activeMonthStr}) • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

export interface MealSheetPdfOptions {
  includeInactive?: boolean;
  includeMealCost?: boolean;
  managerName?: string;
  managerPhone?: string;
  customNotes?: string;
}

export function generateBoardersMealSheetPdf(
  boarders: Boarder[],
  mealLogs: DailyMealLog[],
  settings: MessSettings,
  report?: MonthReport,
  options: MealSheetPdfOptions = {}
): jsPDF {
  const {
    includeInactive = true,
    includeMealCost = true,
    managerName = 'Mess Manager',
    managerPhone = '',
    customNotes = 'Legend: 1 = Single Meal, 2 = Double Meals, 2.5 = Full Day (0.5 Breakfast + 1 Lunch + 1 Dinner), - = Meal Off. Verify all counts before month closing.',
  } = options;

  // Landscape A4: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const activeMonthStr = formatReadableMonth(settings.currentMonth);

  // Filter boarders
  const boardersToInclude = includeInactive
    ? [...boarders].sort((a, b) => a.name.localeCompare(b.name))
    : boarders.filter(b => b.isActive).sort((a, b) => a.name.localeCompare(b.name));

  // Dates in the current month
  const [yearStr, monthStr] = settings.currentMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dayNumbers: number[] = [];
  const dateStrings: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dayNumbers.push(d);
    const dayPadded = d < 10 ? `0${d}` : `${d}`;
    dateStrings.push(`${settings.currentMonth}-${dayPadded}`);
  }

  // Precompute totals
  const mealRate = report?.mealRate || 0;
  let grandTotalMeals = 0;

  const boarderTotals: Record<string, number> = {};
  boardersToInclude.forEach(b => {
    let sum = 0;
    dateStrings.forEach(date => {
      const log = mealLogs.find(l => l.date === date);
      sum += (log?.meals[b.id] ?? 0);
    });
    boarderTotals[b.id] = sum;
    grandTotalMeals += sum;
  });

  const dailyTotals: number[] = dateStrings.map(date => {
    const log = mealLogs.find(l => l.date === date);
    if (!log) return 0;
    return boardersToInclude.reduce((sum, b) => sum + (log.meals[b.id] ?? 0), 0);
  });

  // 1. Header: Clean white background with black text (no background color)
  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((settings.messName || 'Mess').toUpperCase(), 12, 10);

  // Subtitle
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`MONTHLY BOARDER MEAL ATTENDANCE & CONSUMPTION REGISTER - ${activeMonthStr.toUpperCase()}`, 12, 16);

  // Timestamp on right
  const now = new Date();
  const generatedDateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Generated: ${generatedDateStr} | Month: ${settings.currentMonth}`, pageWidth - 12, 16, { align: 'right' });

  // Clean black divider line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(12, 20, pageWidth - 12, 20);

  // 2. Summary stats & Legend strip
  let currentY = 24;
  const statBoxWidth = 44;
  const statBoxHeight = 10;
  const stats = [
    { label: 'Total Boarders', val: `${boardersToInclude.length} members` },
    { label: 'Total Meals Consumed', val: `${grandTotalMeals.toFixed(1)} meals` },
    { label: 'Calculated Meal Rate', val: mealRate > 0 ? `Tk ${mealRate.toFixed(4)}` : 'Pending' },
    { label: 'Daily Average Meals', val: `${(grandTotalMeals / daysInMonth).toFixed(1)} / day` },
  ];

  stats.forEach((s, i) => {
    const x = 12 + i * (statBoxWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, statBoxWidth, statBoxHeight, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, x + 2.5, currentY + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(s.val, x + 2.5, currentY + 8);
  });

  // Legend on right
  const legendX = 12 + stats.length * (statBoxWidth + 3) + 4;
  const legendWidth = pageWidth - 12 - legendX;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(legendX, currentY, legendWidth, statBoxHeight, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Key:', legendX + 2.5, currentY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('1 = 1 Meal  |  2 = 2 Meals  |  2.5 = Full (0.5+1+1)  |  - = Off (0)', legendX + 2.5, currentY + 7.8);

  currentY += statBoxHeight + 4;

  // 3. Matrix Table
  // Build header row
  const tableHeaders = ['#', 'Boarder Name', ...dayNumbers.map(d => `${d}`), 'Total'];
  if (includeMealCost) {
    tableHeaders.push('Cost (Tk)');
  }

  // Build body rows
  const tableRows = boardersToInclude.map((b, idx) => {
    const room = b.roomNo ? ` [${b.roomNo}]` : '';
    const status = b.isActive ? '' : ' (Inact.)';
    const row: string[] = [(idx + 1).toString(), `${b.name}${room}${status}`];

    dateStrings.forEach(date => {
      const log = mealLogs.find(l => l.date === date);
      const count = log?.meals[b.id] ?? 0;
      if (count === 0) {
        row.push('-');
      } else if (count % 1 === 0) {
        row.push(count.toString());
      } else {
        row.push(count.toFixed(1));
      }
    });

    const bTotal = boarderTotals[b.id] || 0;
    row.push(bTotal % 1 === 0 ? bTotal.toString() : bTotal.toFixed(1));

    if (includeMealCost) {
      const cost = bTotal * mealRate;
      row.push(cost > 0 ? cost.toFixed(2) : '0.00');
    }

    return row;
  });

  // Daily Totals Footer Row
  const footerRow: string[] = ['', 'DAILY TOTALS'];
  dailyTotals.forEach(dayTotal => {
    if (dayTotal === 0) {
      footerRow.push('-');
    } else if (dayTotal % 1 === 0) {
      footerRow.push(dayTotal.toString());
    } else {
      footerRow.push(dayTotal.toFixed(1));
    }
  });
  footerRow.push(grandTotalMeals % 1 === 0 ? grandTotalMeals.toString() : grandTotalMeals.toFixed(1));
  if (includeMealCost) {
    const grandCost = grandTotalMeals * mealRate;
    footerRow.push(grandCost.toFixed(2));
  }

  // Column width calculations for landscape (total usable width ~273mm)
  const slWidth = 7;
  const nameWidth = 34;
  const totalColWidth = 14;
  const costColWidth = includeMealCost ? 17 : 0;
  const fixedWidths = slWidth + nameWidth + totalColWidth + costColWidth;
  const dayColWidth = (pageWidth - 24 - fixedWidths) / daysInMonth;

  const columnStyles: Record<number, any> = {
    0: { cellWidth: slWidth, halign: 'center' },
    1: { cellWidth: nameWidth, fontStyle: 'bold' },
  };

  // Day columns (indexes 2 to 2 + daysInMonth - 1)
  for (let i = 0; i < daysInMonth; i++) {
    columnStyles[2 + i] = { cellWidth: dayColWidth, halign: 'center' };
  }

  // Total column
  const totalColIndex = 2 + daysInMonth;
  columnStyles[totalColIndex] = {
    cellWidth: totalColWidth,
    halign: 'center',
    fontStyle: 'bold',
  };

  if (includeMealCost) {
    columnStyles[totalColIndex + 1] = {
      cellWidth: costColWidth,
      halign: 'right',
      fontStyle: 'bold',
    };
  }

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: [...tableRows, footerRow],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
      cellPadding: 1.2,
    },
    styles: {
      fontSize: 6.4,
      cellPadding: 1.1,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles,
    didParseCell: (data) => {
      // Highlight Daily Totals footer row
      if (data.row.index === tableRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249]; // Slate-100
        data.cell.styles.textColor = [15, 23, 42];
      }

      // Format zero / dash cells subtly
      if (data.section === 'body' && data.column.index >= 2 && data.column.index < 2 + daysInMonth) {
        const text = data.cell.text[0];
        if (text === '-') {
          data.cell.styles.textColor = [148, 163, 184]; // muted slate-400
        } else if (parseFloat(text) >= 2) {
          data.cell.styles.fontStyle = 'bold';
        }
      }

      // Total column styling
      if (data.section === 'body' && data.column.index === totalColIndex) {
        data.cell.styles.fillColor = [248, 250, 252];
      }
    },
    margin: { left: 12, right: 12 },
  });

  // Calculate position after table
  // @ts-ignore
  currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : currentY + 70;

  // Signatures & Notes Block
  if (currentY > pageHeight - 32) {
    doc.addPage();
    currentY = 20;
  }

  // Special Meal Notes (e.g. Special Lunch, Guest Invitation)
  const notedDays = dateStrings
    .map((dateStr, idx) => {
      const log = mealLogs.find(l => l.date === dateStr);
      return log?.note?.trim() ? `Day ${dayNumbers[idx]}: ${log.note.trim()}` : null;
    })
    .filter(Boolean);

  if (notedDays.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text(`Special Meal Context: ${notedDays.join('  •  ')}`, 12, currentY, { maxWidth: pageWidth - 24 });
    currentY += 5;
  }

  // Notes
  if (customNotes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Note: ${customNotes}`, 12, currentY, { maxWidth: pageWidth - 24 });
    currentY += 8;
  }

  const signY = Math.max(currentY + 12, pageHeight - 24);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);

  // Manager line
  doc.line(16, signY, 80, signY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Manager: ${managerName}${managerPhone ? ` (${managerPhone})` : ''}`, 16, signY + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signature & Seal', 16, signY + 7);

  // Committee / Boarder rep line
  doc.line(pageWidth - 80, signY, pageWidth - 16, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Audit Committee / Dining Secretary', pageWidth - 80, signY + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Verification & Approval Signature', pageWidth - 80, signY + 7);

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${settings.messName || 'Mess'} • Monthly Meal Register (${activeMonthStr}) • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  return doc;
}

