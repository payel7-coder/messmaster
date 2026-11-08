import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport, BoarderSummary } from '../types';
import { formatReadableDate, formatReadableMonth } from '../utils';
import { NOTO_SANS_BENGALI_REGULAR, NOTO_SANS_BENGALI_BOLD } from './bengaliFontData';

/**
 * Registers embedded Noto Sans Bengali TrueType fonts into jsPDF Virtual File System.
 * Enables full Unicode Bengali script (বাংলা) and English ASCII text & currency symbols (৳, Tk).
 */
function registerBengaliFont(doc: jsPDF): void {
  try {
    doc.addFileToVFS('NotoSansBengali-Regular.ttf', NOTO_SANS_BENGALI_REGULAR);
    doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'normal');
    doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'italic');

    doc.addFileToVFS('NotoSansBengali-Bold.ttf', NOTO_SANS_BENGALI_BOLD);
    doc.addFont('NotoSansBengali-Bold.ttf', 'NotoSansBengali', 'bold');
    doc.addFont('NotoSansBengali-Bold.ttf', 'NotoSansBengali', 'bolditalic');

    doc.setFont('NotoSansBengali', 'normal');
  } catch (err) {
    console.warn('Could not register NotoSansBengali font in jsPDF:', err);
  }
}

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
    includeMemberSlips = false, // Default false for master statement to keep it clean and prevent trailing blank voucher pages
    customNotes = 'Please clear all dues before the 5th of the month. Keep payment transaction slip or cash receipt.',
    managerName = 'Mess Manager',
    managerPhone = '',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  registerBengaliFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const activeMonthStr = formatReadableMonth(report.month);
  const activeBoardersCount = boarders.filter(b => b.isActive).length;

  // Header: Clean white background with black text
  doc.setTextColor(15, 23, 42);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(15);
  doc.text((settings.messName || 'Mess').toUpperCase(), 14, 12);

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`MONTHLY AUDIT STATEMENT & MEAL EXPENSE REPORT - ${activeMonthStr.toUpperCase()}`, 14, 17);

  // Generation timestamp on right
  const now = new Date();
  const generatedDateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${generatedDateStr}`, pageWidth - 14, 17, { align: 'right' });

  // Divider line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(14, 20, pageWidth - 14, 20);

  // Executive KPI summary box
  let currentY = 25;

  doc.setFontSize(9.5);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. EXECUTIVE FINANCIAL SUMMARY', 14, currentY);
  currentY += 3.5;

  const hasSpecialFeast = (report.totalSpecialMealCost || 0) > 0;
  const grandTotalSpent = report.totalBazaarCost + report.totalFixedCost + (report.totalSpecialMealCost || 0);

  const kpis = [
    { label: 'Total Meals Consumed', value: `${report.totalMeals.toFixed(1)} meals` },
    { label: 'Total Bazaar Spent', value: `৳ ${report.totalBazaarCost.toLocaleString('en-IN')}` },
    { label: 'Calculated Meal Rate', value: `৳ ${report.mealRate.toFixed(4)} / meal` },
    { label: 'Total Shared Fixed Bills', value: `৳ ${report.totalFixedCost.toLocaleString('en-IN')}` },
    { label: 'Fixed Share (Per Boarder)', value: `৳ ${report.boardersReport[0]?.fixedCostShare?.toFixed(2) || '0.00'}` },
  ];

  if (hasSpecialFeast) {
    kpis.push({ label: 'Special Feasts Total', value: `৳ ${(report.totalSpecialMealCost || 0).toLocaleString('en-IN')}` });
  }

  kpis.push({ label: 'Total Cash Deposited', value: `৳ ${report.totalDeposits.toLocaleString('en-IN')}` });

  const netBalance = report.totalDeposits - grandTotalSpent;
  const netLabel = netBalance >= 0 ? 'Surplus Balance (Cash in Hand)' : 'Deficit / Shortfall';
  kpis.push({
    label: netLabel,
    value: `${netBalance >= 0 ? '+' : '-'}৳ ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  });

  const cardWidth = (pageWidth - 28 - 6) / 3;
  const cardHeight = 12;

  kpis.forEach((kpi, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 14 + col * (cardWidth + 3);
    const y = currentY + row * (cardHeight + 2);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.2, 1.2, 'FD');

    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 2.5, y + 4);

    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(8.5);
    if (idx === kpis.length - 1) {
      if (netBalance >= 0) {
        doc.setTextColor(21, 128, 61); // Green
      } else {
        doc.setTextColor(185, 28, 28); // Red
      }
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(kpi.value, x + 2.5, y + 9.2);
  });

  currentY += Math.ceil(kpis.length / 3) * (cardHeight + 2) + 5;

  // Master Boarder Table
  doc.setFontSize(9.5);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. MASTER BOARDER BALANCE SHEET', 14, currentY);
  currentY += 2;

  const tableRows = report.boardersReport.map((bSum, index) => {
    const bDetails = boarders.find(b => b.id === bSum.boarderId);
    const room = bDetails?.roomNo ? ` [${bDetails.roomNo}]` : '';
    const status = bDetails?.isActive ? '' : ' (Inactive)';
    const balanceSign = bSum.balance >= 0 ? '+' : '';
    const statusNote = bSum.balance >= 0 ? 'Refund' : 'Due';

    if (hasSpecialFeast) {
      return [
        (index + 1).toString(),
        `${bSum.boarderName}${room}${status}`,
        bSum.totalMeals.toString(),
        `৳ ${bSum.mealCost.toFixed(2)}`,
        `৳ ${bSum.fixedCostShare.toFixed(2)}`,
        `৳ ${(bSum.specialMealCost || 0).toFixed(2)}`,
        `৳ ${bSum.totalCost.toFixed(2)}`,
        `৳ ${bSum.totalDeposit.toFixed(2)}`,
        `${balanceSign}৳ ${bSum.balance.toFixed(2)} (${statusNote})`,
        '',
      ];
    }

    return [
      (index + 1).toString(),
      `${bSum.boarderName}${room}${status}`,
      bSum.totalMeals.toString(),
      `৳ ${bSum.mealCost.toFixed(2)}`,
      `৳ ${bSum.fixedCostShare.toFixed(2)}`,
      `৳ ${bSum.totalCost.toFixed(2)}`,
      `৳ ${bSum.totalDeposit.toFixed(2)}`,
      `${balanceSign}৳ ${bSum.balance.toFixed(2)} (${statusNote})`,
      '',
    ];
  });

  const totalDueRefund = report.totalDeposits - grandTotalSpent;
  const totalRow = hasSpecialFeast ? [
    '',
    'GRAND TOTALS',
    report.totalMeals.toString(),
    `৳ ${report.totalBazaarCost.toFixed(2)}`,
    `৳ ${report.totalFixedCost.toFixed(2)}`,
    `৳ ${(report.totalSpecialMealCost || 0).toFixed(2)}`,
    `৳ ${grandTotalSpent.toFixed(2)}`,
    `৳ ${report.totalDeposits.toFixed(2)}`,
    `${totalDueRefund >= 0 ? '+' : ''}৳ ${totalDueRefund.toFixed(2)}`,
    '',
  ] : [
    '',
    'GRAND TOTALS',
    report.totalMeals.toString(),
    `৳ ${report.totalBazaarCost.toFixed(2)}`,
    `৳ ${report.totalFixedCost.toFixed(2)}`,
    `৳ ${grandTotalSpent.toFixed(2)}`,
    `৳ ${report.totalDeposits.toFixed(2)}`,
    `${totalDueRefund >= 0 ? '+' : ''}৳ ${totalDueRefund.toFixed(2)}`,
    '',
  ];

  const tableHead = hasSpecialFeast 
    ? [['#', 'Member Name', 'Meals', 'Meal (A)', 'Fixed (B)', 'Feast (C)', 'Charged', 'Deposit', 'Net Balance', 'Signature']]
    : [['#', 'Member Name', 'Meals', 'Meal Cost (A)', 'Fixed Share (B)', 'Charged (A+B)', 'Deposit', 'Net Balance', 'Signature']];

  const tableColStyles = hasSpecialFeast ? {
    0: { cellWidth: 6, halign: 'center' as const },
    1: { cellWidth: 32, fontStyle: 'bold' as const },
    2: { cellWidth: 13, halign: 'center' as const },
    3: { cellWidth: 18, halign: 'right' as const },
    4: { cellWidth: 18, halign: 'right' as const },
    5: { cellWidth: 17, halign: 'right' as const },
    6: { cellWidth: 20, halign: 'right' as const, fontStyle: 'bold' as const },
    7: { cellWidth: 19, halign: 'right' as const },
    8: { cellWidth: 25, halign: 'right' as const, fontStyle: 'bold' as const },
    9: { cellWidth: 14, halign: 'center' as const },
  } : {
    0: { cellWidth: 7, halign: 'center' as const },
    1: { cellWidth: 37, fontStyle: 'bold' as const },
    2: { cellWidth: 15, halign: 'center' as const },
    3: { cellWidth: 20, halign: 'right' as const },
    4: { cellWidth: 20, halign: 'right' as const },
    5: { cellWidth: 22, halign: 'right' as const, fontStyle: 'bold' as const },
    6: { cellWidth: 20, halign: 'right' as const },
    7: { cellWidth: 27, halign: 'right' as const, fontStyle: 'bold' as const },
    8: { cellWidth: 14, halign: 'center' as const },
  };

  const balanceColIdx = hasSpecialFeast ? 8 : 7;

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: [...tableRows, totalRow],
    theme: 'grid',
    styles: {
      font: 'NotoSansBengali',
      fontSize: 6.8,
      cellPadding: 1.4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      font: 'NotoSansBengali',
      fontStyle: 'bold',
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7,
      halign: 'center',
    },
    columnStyles: tableColStyles,
    didParseCell: (data) => {
      if (data.row.index === tableRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
      if (data.column.index === balanceColIdx && data.section === 'body') {
        const text = data.cell.text[0] || '';
        if (text.includes('Refund') || text.startsWith('+')) {
          data.cell.styles.textColor = [21, 128, 61];
        } else if (text.includes('Due') || text.startsWith('-')) {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : currentY + 40;

  // Fixed Costs Itemized Breakdown Table
  if (includeFixedCostsBreakdown) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFontSize(9.5);
    doc.setFont('NotoSansBengali', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('3. SHARED FIXED BILLS ITEMIZED BREAKDOWN', 14, currentY);
    currentY += 2;

    const fixedItems: string[][] = [
      ['House Rent', `৳ ${miscCosts.houseRent.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.houseRent ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Cooker / Maid Salary', `৳ ${miscCosts.cookerBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.cookerBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Gas Bill', `৳ ${miscCosts.gasBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.gasBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Electricity & Utility', `৳ ${miscCosts.utilityBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.utilityBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['WiFi & Internet', `৳ ${miscCosts.wifiBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.wifiBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Other / Cleaning / Misc', `৳ ${miscCosts.otherCosts.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.otherCosts ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
    ];

    if (miscCosts.customBills && miscCosts.customBills.length > 0) {
      miscCosts.customBills.forEach(cb => {
        fixedItems.push([cb.name, `৳ ${Number(cb.amount).toLocaleString('en-IN')}`, cb.paidFromCash ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members (Custom Category)']);
      });
    }

    fixedItems.push([
      'TOTAL FIXED COSTS', 
      `৳ ${report.totalFixedCost.toLocaleString('en-IN')}`, 
      `${activeBoardersCount} active members = ৳ ${(report.boardersReport[0]?.fixedCostShare || 0).toFixed(2)} per person`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Expense Category', 'Total Amount', 'Distribution Rule']],
      body: fixedItems,
      theme: 'grid',
      styles: {
        font: 'NotoSansBengali',
        fontSize: 7,
        cellPadding: 1.4,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        font: 'NotoSansBengali',
        fontStyle: 'bold',
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontSize: 7.2,
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 94 },
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
    currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : currentY + 30;
  }

  // Notes and Manager remarks
  if (customNotes) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.2, 1.2, 'FD');

    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Important Instructions / Notice from Manager:', 17, currentY + 4.5);

    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(customNotes, 17, currentY + 9, { maxWidth: pageWidth - 34 });

    currentY += 19;
  }

  // Signatures immediately following master statement content (no huge vertical gap)
  if (currentY > pageHeight - 28) {
    doc.addPage();
    currentY = 20;
  }

  const signY = currentY + 10;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);

  // Manager signature line
  doc.line(18, signY, 75, signY);
  doc.setFontSize(7.5);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Manager: ${managerName}${managerPhone ? ` (${managerPhone})` : ''}`, 18, signY + 3.8);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signature & Date', 18, signY + 7);

  // Committee Member line
  doc.line(pageWidth - 75, signY, pageWidth - 18, signY);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Audit / Committee Representative', pageWidth - 75, signY + 3.8);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature & Verification', pageWidth - 75, signY + 7);

  // Daily Bazaar Ledger (Page 2 / subsequent page)
  const currentMonthBazaars = bazaarCosts.filter(b => b.date.startsWith(report.month));
  if (includeBazaarList && currentMonthBazaars.length > 0) {
    doc.addPage();
    currentY = 16;

    doc.setFontSize(10);
    doc.setFont('NotoSansBengali', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`4. DAILY BAZAAR & EXPENSE LOG - ${activeMonthStr.toUpperCase()}`, 14, currentY);
    currentY += 3.5;

    const bazaarRows = currentMonthBazaars
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item, idx) => {
        const buyer = boarders.find(b => b.id === item.spentById)?.name || 'Manager';
        let desc = item.description;
        if (item.dueAmount && !item.isDueSettled) {
          desc += ` [Shop Due: ৳ ${item.dueAmount}${item.dueShopName ? ` at ${item.dueShopName}` : ''}]`;
        } else if (item.isDueSettled && item.settledDate) {
          desc += ` [Cash Adjusted: ${formatReadableDate(item.settledDate)}]`;
        }
        return [
          (idx + 1).toString(),
          formatReadableDate(item.date),
          desc,
          buyer,
          `৳ ${item.amount.toLocaleString('en-IN')}`,
        ];
      });

    const totalBazaarAmt = currentMonthBazaars.reduce((acc, curr) => acc + curr.amount, 0);
    bazaarRows.push([
      '',
      'TOTAL BAZAAR',
      `${currentMonthBazaars.length} purchases recorded`,
      '',
      `৳ ${totalBazaarAmt.toLocaleString('en-IN')}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Date', 'Description / Items', 'Purchased By', 'Amount']],
      body: bazaarRows,
      theme: 'grid',
      styles: {
        font: 'NotoSansBengali',
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        font: 'NotoSansBengali',
        fontStyle: 'bold',
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.2,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 90 },
        3: { cellWidth: 30 },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
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

  // Optional Individual Member Slips appended to Monthly Statement
  if (includeMemberSlips && report.boardersReport.length > 0) {
    doc.addPage();
    let slipStartY = 12;

    doc.setFontSize(10);
    doc.setFont('NotoSansBengali', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`5. INDIVIDUAL MEMBER FINANCIAL VOUCHER SLIPS - ${activeMonthStr.toUpperCase()}`, 10, slipStartY);
    doc.setFontSize(6.8);
    doc.setFont('NotoSansBengali', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Arranged strictly 4 vouchers per A4 sheet (2x2 grid). Cut along guidelines.', 10, slipStartY + 3.5);
    slipStartY += 6.5;

    const slipsPerPage = 4;
    const colCount = 2;
    const leftMargin = 10;
    const topMargin = slipStartY;
    const colGap = 5;
    const rowGap = 5;
    const slipWidth = (pageWidth - 2 * leftMargin - colGap) / colCount; // ~92.5mm
    const slipHeight = 124; // 124mm fits cleanly in 2 rows on A4

    report.boardersReport.forEach((bSum, index) => {
      const pageIndex = index % slipsPerPage;
      if (index > 0 && pageIndex === 0) {
        doc.addPage();
      }

      const col = pageIndex % colCount;
      const row = Math.floor(pageIndex / colCount);
      const x = leftMargin + col * (slipWidth + colGap);
      const y = topMargin + row * (slipHeight + rowGap);

      const bDetails = boarders.find(b => b.id === bSum.boarderId);
      const isSurplus = bSum.balance >= 0;
      const roomStr = bDetails?.roomNo || bSum.roomNo;
      const voucherNo = (index + 1).toString().padStart(2, '0');
      const bSpecialMeal = (bSum.specialMealCost || 0);

      // Voucher box outline
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.35);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, slipWidth, slipHeight, 1.5, 1.5, 'FD');

      // Top Banner Header Band
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x + 0.4, y + 0.4, slipWidth - 0.8, 13, 1.2, 1.2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(x, y + 13.5, x + slipWidth, y + 13.5);

      // Mess Title & Voucher #
      doc.setFont('NotoSansBengali', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text((settings.messName || 'Mess').toUpperCase(), x + 3.5, y + 4.8);

      doc.setFontSize(6.2);
      doc.setTextColor(30, 41, 59);
      doc.text(`VOUCHER #${voucherNo}${roomStr ? ` | RM: ${roomStr}` : ''}`, x + slipWidth - 3.5, y + 4.8, { align: 'right' });

      // Subtitle
      doc.setFont('NotoSansBengali', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`MEAL STATEMENT • ${activeMonthStr.toUpperCase()}`, x + 3.5, y + 9);

      // Status Badge
      doc.setFillColor(isSurplus ? 220 : 254, isSurplus ? 252 : 226, isSurplus ? 231 : 226);
      doc.roundedRect(x + slipWidth - 31, y + 7, 27.5, 4.2, 0.8, 0.8, 'F');
      doc.setFont('NotoSansBengali', 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
      doc.text(isSurplus ? 'REFUNDABLE / CREDIT' : 'OUTSTANDING DUE', x + slipWidth - 17.25, y + 10, { align: 'center' });

      // Member Profile Info Strip
      let curY = y + 17.5;
      doc.setFont('NotoSansBengali', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Member: ${bSum.boarderName}${roomStr ? ` [${roomStr}]` : ''}`, x + 3.5, curY);

      if (bDetails?.phone) {
        doc.setFont('NotoSansBengali', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        doc.text(`Ph: ${bDetails.phone}`, x + slipWidth - 3.5, curY, { align: 'right' });
      }

      // Breakdown Box Table
      curY += 2.5;
      const boxHeight = bSpecialMeal > 0 ? 50 : 44;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(x + 3, curY, slipWidth - 6, boxHeight, 'FD');

      // Row 1: Meals
      let rowY = curY + 5.5;
      doc.setFont('NotoSansBengali', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`1. Meals (${bSum.totalMeals} @ ৳ ${report.mealRate.toFixed(2)})`, x + 4.5, rowY);
      doc.setFont('NotoSansBengali', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`৳ ${bSum.mealCost.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

      // Row 2: Fixed Common Bills
      rowY += 7.5;
      doc.setFont('NotoSansBengali', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`2. Shared Fixed Overhead Share`, x + 4.5, rowY);
      doc.setFont('NotoSansBengali', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`৳ ${bSum.fixedCostShare.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

      // Row 2.5: Special Feast (if applicable)
      if (bSpecialMeal > 0) {
        rowY += 7.5;
        doc.setFont('NotoSansBengali', 'normal');
        doc.setTextColor(126, 34, 206);
        doc.text(`3. Special Feast Share`, x + 4.5, rowY);
        doc.setFont('NotoSansBengali', 'bold');
        doc.text(`৳ ${bSpecialMeal.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });
      }

      // Row 3: Total Charged (Divider line)
      rowY += 4.5;
      doc.setDrawColor(203, 213, 225);
      doc.line(x + 4.5, rowY, x + slipWidth - 4.5, rowY);
      rowY += 5.5;

      doc.setFont('NotoSansBengali', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(15, 23, 42);
      doc.text(bSpecialMeal > 0 ? 'Total Charged (1+2+3):' : 'Total Month Charged (1+2):', x + 4.5, rowY);
      doc.text(`৳ ${bSum.totalCost.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

      // Row 4: Total Deposits
      rowY += 7.5;
      doc.setFont('NotoSansBengali', 'normal');
      doc.setTextColor(29, 78, 216);
      doc.text('Total Deposits Received:', x + 4.5, rowY);
      doc.setFont('NotoSansBengali', 'bold');
      doc.text(`৳ ${bSum.totalDeposit.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

      // Net Closing Balance Banner
      curY += boxHeight + 2.5;
      doc.setFillColor(isSurplus ? 240 : 254, isSurplus ? 253 : 242, isSurplus ? 244 : 242);
      doc.setDrawColor(isSurplus ? 187 : 254, isSurplus ? 247 : 202, isSurplus ? 208 : 202);
      doc.rect(x + 3, curY, slipWidth - 6, 10.5, 'FD');

      doc.setFont('NotoSansBengali', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
      doc.text(isSurplus ? 'Closing Refund (Credit):' : 'Net Amount Due (Payable):', x + 4.5, curY + 6.5);
      doc.setFontSize(8.2);
      doc.text(`৳ ${Math.abs(bSum.balance).toFixed(2)}`, x + slipWidth - 4.5, curY + 7, { align: 'right' });

      // Notes / Instructions line
      curY += 13.5;
      doc.setFont('NotoSansBengali', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(100, 116, 139);
      doc.text('Please verify meals with ledger. Clear dues promptly.', x + 3.5, curY);

      // Dual Signatures
      curY += 8;
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.line(x + 4.5, curY, x + 32, curY);
      doc.line(x + slipWidth - 32, curY, x + slipWidth - 4.5, curY);

      doc.setFont('NotoSansBengali', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Boarder Signature', x + 18, curY + 3, { align: 'center' });
      doc.text('Manager Seal & Sig', x + slipWidth - 18, curY + 3, { align: 'center' });

      // Draw middle perforation guidelines on each page
      const isLastOnPage = pageIndex === slipsPerPage - 1 || index === report.boardersReport.length - 1;
      if (isLastOnPage) {
        const midX = leftMargin + slipWidth + colGap / 2;
        doc.setDrawColor(180, 195, 210);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(midX, topMargin - 2, midX, topMargin + 2 * slipHeight + rowGap + 2);

        const midY = topMargin + slipHeight + rowGap / 2;
        doc.line(leftMargin - 2, midY, pageWidth - leftMargin + 2, midY);
        doc.setLineDashPattern([], 0);

        doc.setFont('NotoSansBengali', 'normal');
        doc.setFontSize(5.2);
        doc.setTextColor(148, 163, 184);
        doc.text('✂ Cut Along Guidelines ✂', midX, midY - 0.6, { align: 'center' });
      }
    });
  }

  // Page numbers footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${settings.messName || 'Mess'} • Monthly Audit Statement (${activeMonthStr}) • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
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

  registerBengaliFont(doc);

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

  // Header
  doc.setTextColor(15, 23, 42);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(14);
  doc.text((settings.messName || 'Mess').toUpperCase(), 12, 10);

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`MONTHLY BOARDER MEAL ATTENDANCE & CONSUMPTION REGISTER - ${activeMonthStr.toUpperCase()}`, 12, 15.5);

  // Timestamp on right
  const now = new Date();
  const generatedDateStr = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${generatedDateStr} | Month: ${settings.currentMonth}`, pageWidth - 12, 15.5, { align: 'right' });

  // Divider line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(12, 18.5, pageWidth - 12, 18.5);

  // Summary stats & Legend strip
  let currentY = 22;
  const statBoxWidth = 44;
  const statBoxHeight = 9.5;
  const stats = [
    { label: 'Total Boarders', val: `${boardersToInclude.length} members` },
    { label: 'Total Meals Consumed', val: `${grandTotalMeals.toFixed(1)} meals` },
    { label: 'Calculated Meal Rate', val: mealRate > 0 ? `৳ ${mealRate.toFixed(4)}` : 'Pending' },
    { label: 'Daily Average Meals', val: `${(grandTotalMeals / daysInMonth).toFixed(1)} / day` },
  ];

  stats.forEach((s, i) => {
    const x = 12 + i * (statBoxWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, statBoxWidth, statBoxHeight, 1.2, 1.2, 'FD');

    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, x + 2.5, currentY + 3.5);

    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text(s.val, x + 2.5, currentY + 7.6);
  });

  // Legend on right
  const legendX = 12 + stats.length * (statBoxWidth + 3) + 3;
  const legendWidth = pageWidth - 12 - legendX;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(legendX, currentY, legendWidth, statBoxHeight, 1.2, 1.2, 'FD');

  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  doc.text('Key:', legendX + 2.5, currentY + 3.8);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text('1 = 1 Meal | 2 = 2 Meals | 2.5 = Full (0.5+1+1) | - = Off (0)', legendX + 2.5, currentY + 7.4);

  currentY += statBoxHeight + 3.5;

  // Matrix Table
  const tableHeaders = ['#', 'Boarder Name', ...dayNumbers.map(d => `${d}`), 'Total'];
  if (includeMealCost) {
    tableHeaders.push('Cost (৳)');
  }

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

  for (let i = 0; i < daysInMonth; i++) {
    columnStyles[2 + i] = { cellWidth: dayColWidth, halign: 'center' };
  }

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
    styles: {
      font: 'NotoSansBengali',
      fontSize: 6.2,
      cellPadding: 0.9,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      font: 'NotoSansBengali',
      fontStyle: 'bold',
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 6.5,
      halign: 'center',
      cellPadding: 1.1,
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.row.index === tableRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
      if (data.section === 'body' && data.column.index >= 2 && data.column.index < 2 + daysInMonth) {
        const text = data.cell.text[0];
        if (text === '-') {
          data.cell.styles.textColor = [148, 163, 184];
        } else if (parseFloat(text) >= 2) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.section === 'body' && data.column.index === totalColIndex) {
        data.cell.styles.fillColor = [248, 250, 252];
      }
    },
    margin: { left: 12, right: 12 },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 5 : currentY + 70;

  // Signatures & Notes Block
  if (currentY > pageHeight - 28) {
    doc.addPage();
    currentY = 16;
  }

  const notedDays = dateStrings
    .map((dateStr, idx) => {
      const log = mealLogs.find(l => l.date === dateStr);
      return log?.note?.trim() ? `Day ${dayNumbers[idx]}: ${log.note.trim()}` : null;
    })
    .filter(Boolean);

  if (notedDays.length > 0) {
    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(180, 83, 9);
    doc.text(`Special Meal Context: ${notedDays.join('  •  ')}`, 12, currentY, { maxWidth: pageWidth - 24 });
    currentY += 4.5;
  }

  if (customNotes) {
    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(`Note: ${customNotes}`, 12, currentY, { maxWidth: pageWidth - 24 });
    currentY += 6.5;
  }

  // Position signatures naturally right below notes without forcing 100mm gap
  const signY = currentY + 8;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);

  // Manager line
  doc.line(16, signY, 80, signY);
  doc.setFontSize(7.2);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Manager: ${managerName}${managerPhone ? ` (${managerPhone})` : ''}`, 16, signY + 3.5);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signature & Seal', 16, signY + 6.8);

  // Committee / Boarder rep line
  doc.line(pageWidth - 80, signY, pageWidth - 16, signY);
  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  doc.text('Audit Committee / Dining Secretary', pageWidth - 80, signY + 3.5);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Verification & Approval Signature', pageWidth - 80, signY + 6.8);

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${settings.messName || 'Mess'} • Monthly Meal Register (${activeMonthStr}) • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 4.5,
      { align: 'center' }
    );
  }

  return doc;
}

export interface SlipsOnlyPdfOptions {
  managerName?: string;
  managerPhone?: string;
  customNotes?: string;
}

/**
 * Generates an official, pure vector PDF containing strictly 4-per-page member financial vouchers.
 * Renders directly via jsPDF vector primitives with full Unicode Bengali support.
 */
export function generateSlipsOnlyPdf(
  report: MonthReport,
  boarders: Boarder[],
  settings: MessSettings,
  options: SlipsOnlyPdfOptions = {}
): jsPDF {
  const {
    managerName = 'Mess Manager',
    managerPhone = '',
    customNotes = 'Please verify meal counts and clear remaining dues before the 5th of next month.',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  registerBengaliFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const activeMonthStr = formatReadableMonth(report.month);

  const slipsPerPage = 4;
  const colCount = 2;
  const leftMargin = 9;
  const topMargin = 8;
  const colGap = 5;
  const rowGap = 5;
  const slipWidth = (pageWidth - 2 * leftMargin - colGap) / colCount; // ~93.5mm
  const slipHeight = 125; // 8 + 125 + 5 + 125 + 8 = 271mm < 297mm A4 (clean 26mm margin, zero blank overflow)

  report.boardersReport.forEach((bSum, index) => {
    const pageIndex = index % slipsPerPage;
    if (index > 0 && pageIndex === 0) {
      doc.addPage();
    }

    const col = pageIndex % colCount;
    const row = Math.floor(pageIndex / colCount);
    const x = leftMargin + col * (slipWidth + colGap);
    const y = topMargin + row * (slipHeight + rowGap);

    const bDetails = boarders.find(b => b.id === bSum.boarderId);
    const isSurplus = bSum.balance >= 0;
    const roomStr = bDetails?.roomNo || bSum.roomNo;
    const voucherNo = (index + 1).toString().padStart(2, '0');
    const bSpecialMeal = (bSum.specialMealCost || 0);

    // Voucher box outline
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, slipWidth, slipHeight, 1.5, 1.5, 'FD');

    // Top Banner Header Band
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x + 0.4, y + 0.4, slipWidth - 0.8, 13.5, 1.2, 1.2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(x, y + 14, x + slipWidth, y + 14);

    // Mess Title & Voucher #
    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text((settings.messName || 'Mess').toUpperCase(), x + 3.5, y + 5);

    doc.setFontSize(6.2);
    doc.setTextColor(30, 41, 59);
    doc.text(`VOUCHER #${voucherNo}${roomStr ? ` | RM: ${roomStr}` : ''}`, x + slipWidth - 3.5, y + 5, { align: 'right' });

    // Subtitle
    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`MEAL STATEMENT • ${activeMonthStr.toUpperCase()}`, x + 3.5, y + 9.5);

    // Status Badge
    doc.setFillColor(isSurplus ? 220 : 254, isSurplus ? 252 : 226, isSurplus ? 231 : 226);
    doc.roundedRect(x + slipWidth - 31, y + 7.2, 27.5, 4.5, 0.8, 0.8, 'F');
    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
    doc.text(isSurplus ? 'REFUNDABLE / CREDIT' : 'OUTSTANDING DUE', x + slipWidth - 17.25, y + 10.3, { align: 'center' });

    // Member Profile Info Strip
    let curY = y + 18;
    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Member: ${bSum.boarderName}${roomStr ? ` [${roomStr}]` : ''}`, x + 3.5, curY);

    if (bDetails?.phone) {
      doc.setFont('NotoSansBengali', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text(`Ph: ${bDetails.phone}`, x + slipWidth - 3.5, curY, { align: 'right' });
    }

    // Breakdown Box Table
    curY += 2.5;
    const boxHeight = bSpecialMeal > 0 ? 50 : 44;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x + 3, curY, slipWidth - 6, boxHeight, 'FD');

    // Row 1: Meals
    let rowY = curY + 5.5;
    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`1. Meals (${bSum.totalMeals} @ ৳ ${report.mealRate.toFixed(2)})`, x + 4.5, rowY);
    doc.setFont('NotoSansBengali', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`৳ ${bSum.mealCost.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

    // Row 2: Fixed Common Bills
    rowY += 7.5;
    doc.setFont('NotoSansBengali', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`2. Shared Fixed Overhead Share`, x + 4.5, rowY);
    doc.setFont('NotoSansBengali', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`৳ ${bSum.fixedCostShare.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

    // Row 2.5: Special Feast (if applicable)
    if (bSpecialMeal > 0) {
      rowY += 7.5;
      doc.setFont('NotoSansBengali', 'normal');
      doc.setTextColor(126, 34, 206);
      doc.text(`3. Special Feast Share`, x + 4.5, rowY);
      doc.setFont('NotoSansBengali', 'bold');
      doc.text(`৳ ${bSpecialMeal.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });
    }

    // Row 3: Total Charged (Divider line)
    rowY += 4.5;
    doc.setDrawColor(203, 213, 225);
    doc.line(x + 4.5, rowY, x + slipWidth - 4.5, rowY);
    rowY += 5.5;

    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(bSpecialMeal > 0 ? 'Total Charged (1+2+3):' : 'Total Month Charged (1+2):', x + 4.5, rowY);
    doc.text(`৳ ${bSum.totalCost.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

    // Row 4: Total Deposits
    rowY += 7.5;
    doc.setFont('NotoSansBengali', 'normal');
    doc.setTextColor(29, 78, 216);
    doc.text('Total Deposits Received:', x + 4.5, rowY);
    doc.setFont('NotoSansBengali', 'bold');
    doc.text(`৳ ${bSum.totalDeposit.toFixed(2)}`, x + slipWidth - 4.5, rowY, { align: 'right' });

    // Net Closing Balance Banner
    curY += boxHeight + 2.5;
    doc.setFillColor(isSurplus ? 240 : 254, isSurplus ? 253 : 242, isSurplus ? 244 : 242);
    doc.setDrawColor(isSurplus ? 187 : 254, isSurplus ? 247 : 202, isSurplus ? 208 : 202);
    doc.rect(x + 3, curY, slipWidth - 6, 11, 'FD');

    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
    doc.text(isSurplus ? 'Closing Refund (Credit):' : 'Net Amount Due (Payable):', x + 4.5, curY + 6.8);
    doc.setFontSize(8.5);
    doc.text(`৳ ${Math.abs(bSum.balance).toFixed(2)}`, x + slipWidth - 4.5, curY + 7.2, { align: 'right' });

    // Notes / Instructions line
    curY += 14;
    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(100, 116, 139);
    doc.text(customNotes, x + 3.5, curY);

    // Dual Signatures
    curY += 8.5;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.line(x + 4.5, curY, x + 32, curY);
    doc.line(x + slipWidth - 32, curY, x + slipWidth - 4.5, curY);

    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(100, 116, 139);
    doc.text('Boarder Signature', x + 18, curY + 3.2, { align: 'center' });
    doc.text('Manager Seal & Sig', x + slipWidth - 18, curY + 3.2, { align: 'center' });

    // Draw middle perforation guidelines on each page
    const isLastOnPage = pageIndex === slipsPerPage - 1 || index === report.boardersReport.length - 1;
    if (isLastOnPage) {
      const midX = leftMargin + slipWidth + colGap / 2;
      doc.setDrawColor(180, 195, 210);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(midX, topMargin - 2, midX, topMargin + 2 * slipHeight + rowGap + 2);

      const midY = topMargin + slipHeight + rowGap / 2;
      doc.line(leftMargin - 2, midY, pageWidth - leftMargin + 2, midY);
      doc.setLineDashPattern([], 0);

      doc.setFont('NotoSansBengali', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(148, 163, 184);
      doc.text('✂ Cut Along Guidelines ✂', midX, midY - 0.6, { align: 'center' });
    }
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('NotoSansBengali', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${settings.messName || 'Mess'} • Member Financial Vouchers (${activeMonthStr}) • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
  }

  return doc;
}

export interface PersonalVoucherPdfOptions {
  managerName?: string;
  managerPhone?: string;
  customNotes?: string;
}

/**
 * Generates an official, pure vector individual member financial voucher (A5 format).
 * Renders directly via jsPDF and jspdf-autotable with full Unicode Bengali support.
 */
export function generatePersonalVoucherPdf(
  boarder: Boarder,
  report: MonthReport,
  deposits: Deposit[],
  settings: MessSettings,
  options: PersonalVoucherPdfOptions = {}
): jsPDF {
  const {
    managerName = 'Mess Manager',
    managerPhone = '',
    customNotes = 'Please verify your meal consumption and deposit payments. Keep this slip for your personal records.',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5', // 148 x 210 mm
  });

  registerBengaliFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const activeMonthStr = formatReadableMonth(report.month);

  const summary: BoarderSummary = report.boardersReport.find(r => r.boarderId === boarder.id) || {
    boarderId: boarder.id,
    boarderName: boarder.name,
    totalMeals: 0,
    mealCost: 0,
    fixedCostShare: 0,
    specialMealCost: 0,
    totalCost: 0,
    totalDeposit: 0,
    balance: 0,
  };

  const isSurplus = summary.balance >= 0;
  const boarderDeposits = deposits.filter(d => d.boarderId === boarder.id && d.date.startsWith(report.month));

  // Outer border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  // Top header box
  doc.setFillColor(248, 250, 252);
  doc.rect(8.4, 8.4, pageWidth - 16.8, 22, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(8, 30.5, pageWidth - 8, 30.5);

  // Mess Title
  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text((settings.messName || 'Mess').toUpperCase(), 14, 17);

  // Subtitle
  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`OFFICIAL MEMBER EXPENSE & MEAL SLIP - ${activeMonthStr.toUpperCase()}`, 14, 23);

  // Timestamp
  const now = new Date();
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Issued: ${now.toLocaleDateString('en-GB')}`, pageWidth - 14, 23, { align: 'right' });

  // Member Information Card
  let curY = 36;
  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Member: ${boarder.name}`, 14, curY);

  doc.setFontSize(8);
  doc.setFont('NotoSansBengali', 'normal');
  doc.setTextColor(71, 85, 105);
  const roomInfo = boarder.roomNo ? `Room: ${boarder.roomNo}` : 'General';
  const phoneInfo = boarder.phone ? ` • Phone: ${boarder.phone}` : '';
  doc.text(`${roomInfo}${phoneInfo} • Status: ${boarder.isActive ? 'Active' : 'Inactive'}`, 14, curY + 4.8);

  // Status Badge
  doc.setFillColor(isSurplus ? 220 : 254, isSurplus ? 252 : 226, isSurplus ? 231 : 226);
  doc.roundedRect(pageWidth - 46, curY - 4.5, 32, 6.5, 1.2, 1.2, 'F');
  doc.setFont('NotoSansBengali', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
  doc.text(isSurplus ? 'CREDIT / REFUNDABLE' : 'OUTSTANDING DUE', pageWidth - 30, curY - 0.2, { align: 'center' });

  curY += 10.5;

  // Financial Breakdown autoTable
  const voucherBody: (string | number)[][] = [
    [
      'Total Meals Consumed',
      `${summary.totalMeals.toFixed(1)} meals @ ৳ ${report.mealRate.toFixed(4)}/meal`,
      `৳ ${summary.mealCost.toFixed(2)}`,
    ],
    [
      'Shared Utility & Fixed Costs Share',
      'Equal division among active members',
      `৳ ${summary.fixedCostShare.toFixed(2)}`,
    ],
  ];

  if ((summary.specialMealCost || 0) > 0) {
    voucherBody.push([
      'Special Feast Share (C)',
      'Month-end feast (excluded from regular daily meal rate)',
      `৳ ${(summary.specialMealCost || 0).toFixed(2)}`,
    ]);
  }

  voucherBody.push(
    [
      'Total Monthly Charges (A)',
      (summary.specialMealCost || 0) > 0
        ? 'Sum of Meals + Shared Bills + Special Feast'
        : 'Sum of Meal Cost + Shared Fixed Overhead',
      `৳ ${summary.totalCost.toFixed(2)}`,
    ],
    [
      'Total Advance Deposits Paid (B)',
      `${boarderDeposits.length} deposit entry(s) credited`,
      `৳ ${summary.totalDeposit.toFixed(2)}`,
    ]
  );

  autoTable(doc, {
    startY: curY,
    margin: { left: 14, right: 14 },
    head: [['Description / Expense Category', 'Calculation Basis', 'Amount (৳)']],
    body: voucherBody,
    foot: [
      [
        isSurplus ? 'Closing Refund / Credit (B - A)' : 'Net Amount Due to Pay (A - B)',
        isSurplus ? 'Excess deposit will be refunded or adjusted' : 'Please settle with mess manager',
        `${isSurplus ? '+' : '-'}৳ ${Math.abs(summary.balance).toFixed(2)}`,
      ],
    ],
    theme: 'plain',
    styles: {
      font: 'NotoSansBengali',
      textColor: [30, 41, 59],
      fontSize: 7.5,
      cellPadding: 2.2,
    },
    headStyles: {
      font: 'NotoSansBengali',
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 7.8,
      fontStyle: 'bold',
      cellPadding: 2.2,
    },
    footStyles: {
      font: 'NotoSansBengali',
      fillColor: isSurplus ? [240, 253, 244] : [254, 242, 242],
      textColor: isSurplus ? [21, 128, 61] : [185, 28, 28],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 54 },
      1: { cellWidth: 44 },
      2: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.2,
  });

  // Deposits History subtable (if deposits exist)
  let finalY = (doc as any).lastAutoTable?.finalY || 100;

  if (boarderDeposits.length > 0 && finalY < 135) {
    finalY += 3.5;
    doc.setFont('NotoSansBengali', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('Deposit Payments Credited This Month:', 14, finalY);
    finalY += 2;

    const depRows = boarderDeposits.map(d => [
      formatReadableDate(d.date),
      d.note || 'Regular cash deposit',
      `৳ ${d.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: finalY,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Payment Note / Method', 'Amount (৳)']],
      body: depRows,
      theme: 'plain',
      styles: {
        font: 'NotoSansBengali',
        textColor: [51, 65, 85],
        fontSize: 6.8,
        cellPadding: 1.8,
      },
      headStyles: {
        font: 'NotoSansBengali',
        fillColor: [248, 250, 252],
        textColor: [71, 85, 105],
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.6,
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 66 },
        2: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      tableLineColor: [241, 245, 249],
      tableLineWidth: 0.2,
    });

    finalY = (doc as any).lastAutoTable?.finalY || finalY + 18;
  }

  // Notes box
  finalY += 3.5;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, pageWidth - 28, 11, 1, 1, 'F');
  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(`Note: ${customNotes}`, 17, finalY + 4);
  if (managerPhone) {
    doc.text(`Manager: ${managerName} • Contact: ${managerPhone}`, 17, finalY + 7.8);
  } else {
    doc.text(`Manager: ${managerName} • Generated via MessMaster Portal`, 17, finalY + 7.8);
  }

  // Signatures at bottom
  const sigY = pageHeight - 16;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(18, sigY, 55, sigY);
  doc.line(pageWidth - 55, sigY, pageWidth - 18, sigY);

  doc.setFont('NotoSansBengali', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Boarder Signature', 36.5, sigY + 3.6, { align: 'center' });
  doc.text('Manager Signature & Seal', pageWidth - 36.5, sigY + 3.6, { align: 'center' });

  return doc;
}
