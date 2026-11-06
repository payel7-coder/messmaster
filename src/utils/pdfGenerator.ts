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
      ['House Rent', `Tk ${miscCosts.houseRent.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.houseRent ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Cooker / Maid Salary', `Tk ${miscCosts.cookerBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.cookerBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Gas Bill', `Tk ${miscCosts.gasBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.gasBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Electricity & Utility', `Tk ${miscCosts.utilityBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.utilityBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['WiFi & Internet', `Tk ${miscCosts.wifiBill.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.wifiBill ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
      ['Other / Cleaning / Misc', `Tk ${miscCosts.otherCosts.toLocaleString('en-IN')}`, miscCosts.paidFromCash?.otherCosts ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members'],
    ];

    if (miscCosts.customBills && miscCosts.customBills.length > 0) {
      miscCosts.customBills.forEach(cb => {
        fixedItems.push([cb.name, `Tk ${Number(cb.amount).toLocaleString('en-IN')}`, cb.paidFromCash ? 'Equally shared [Paid from Cash]' : 'Equally shared among active members (Custom Category)']);
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
        let desc = item.description;
        if (item.dueAmount && !item.isDueSettled) {
          desc += ` [Shop Due: Tk ${item.dueAmount}${item.dueShopName ? ` at ${item.dueShopName}` : ''}]`;
        } else if (item.isDueSettled && item.settledDate) {
          desc += ` [Cash Adjusted: ${formatReadableDate(item.settledDate)}]`;
        }
        return [
          (idx + 1).toString(),
          formatReadableDate(item.date),
          desc,
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

  // Individual printable financial vouchers / slips (Strictly 4 per page on A4: 2 columns x 2 rows)
  if (includeMemberSlips && report.boardersReport.length > 0) {
    doc.addPage();
    let slipStartY = 14;

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`5. INDIVIDUAL MEMBER FINANCIAL VOUCHER SLIPS - ${activeMonthStr.toUpperCase()}`, 11, slipStartY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Arranged 4 vouchers per page (2x2 grid) for cost-effective physical records. Cut along vertical & horizontal perforation guidelines.', 11, slipStartY + 3.8);
    slipStartY += 7;

    const slipsPerPage = 4;
    const colCount = 2;
    const leftMargin = 11;
    const topMargin = slipStartY;
    const colGap = 6;
    const rowGap = 7;
    const slipWidth = (pageWidth - 2 * leftMargin - colGap) / colCount; // ~91mm
    const slipHeight = 125; // 125mm height fits 2 rows easily on 297mm A4

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

      // Voucher box outline
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setLineWidth(0.35);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, slipWidth, slipHeight, 1.5, 1.5, 'FD');

      // Top Banner Header Band
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x + 0.4, y + 0.4, slipWidth - 0.8, 14, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(x, y + 14.5, x + slipWidth, y + 14.5);

      // Mess Title & Voucher #
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text((settings.messName || 'Mess').toUpperCase(), x + 3.5, y + 5);

      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`VOUCHER #${voucherNo}${roomStr ? ` | RM: ${roomStr}` : ''}`, x + slipWidth - 3.5, y + 5, { align: 'right' });

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(71, 85, 105);
      doc.text(`MEAL STATEMENT • ${activeMonthStr.toUpperCase()}`, x + 3.5, y + 9.5);

      // Status Badge (REFUNDABLE vs OUTSTANDING DUE)
      doc.setFillColor(isSurplus ? 220 : 254, isSurplus ? 252 : 226, isSurplus ? 231 : 226);
      doc.roundedRect(x + slipWidth - 31, y + 7.5, 27.5, 4.5, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
      doc.text(isSurplus ? 'REFUNDABLE / CREDIT' : 'OUTSTANDING DUE', x + slipWidth - 17.25, y + 10.7, { align: 'center' });

      // Member Profile Info Strip
      let curY = y + 19;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`Member: ${bSum.boarderName}${roomStr ? ` [${roomStr}]` : ''}`, x + 3.5, curY);

      if (bDetails?.phone) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Ph: ${bDetails.phone}`, x + slipWidth - 3.5, curY, { align: 'right' });
      }

      // Breakdown Box Table
      curY += 3;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(x + 3, curY, slipWidth - 6, 46, 'FD');

      // Row 1: Meals
      let rowY = curY + 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      doc.text(`1. Meals (${bSum.totalMeals} @ Tk ${report.mealRate.toFixed(2)})`, x + 5, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Tk ${bSum.mealCost.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

      // Row 2: Fixed Common Bills
      rowY += 8.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`2. Shared Fixed Overhead Share`, x + 5, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Tk ${bSum.fixedCostShare.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

      // Row 3: Total Charged (Divider line)
      rowY += 5;
      doc.setDrawColor(203, 213, 225);
      doc.line(x + 5, rowY, x + slipWidth - 5, rowY);
      rowY += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text('Total Month Charged (1 + 2):', x + 5, rowY);
      doc.text(`Tk ${bSum.totalCost.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

      // Row 4: Total Deposits
      rowY += 8.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(29, 78, 216); // Blue
      doc.text('Total Deposits Received:', x + 5, rowY);
      doc.setFont('helvetica', 'bold');
      doc.text(`Tk ${bSum.totalDeposit.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

      // Net Closing Balance Banner
      curY += 49;
      doc.setFillColor(isSurplus ? 240 : 254, isSurplus ? 253 : 242, isSurplus ? 244 : 242);
      doc.setDrawColor(isSurplus ? 187 : 254, isSurplus ? 247 : 202, isSurplus ? 208 : 202);
      doc.rect(x + 3, curY, slipWidth - 6, 11, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
      doc.text(isSurplus ? 'Closing Refundable (Credit):' : 'Net Amount Due (Payable):', x + 5, curY + 7);
      doc.setFontSize(8.8);
      doc.text(`Tk ${Math.abs(bSum.balance).toFixed(2)}`, x + slipWidth - 5, curY + 7.5, { align: 'right' });

      // Notes / Instructions line
      curY += 14;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Please verify meals with ledger. Clear dues promptly.', x + 3.5, curY);

      // Dual Signatures
      curY += 9;
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.line(x + 5, curY, x + 34, curY);
      doc.line(x + slipWidth - 34, curY, x + slipWidth - 5, curY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.6);
      doc.setTextColor(100, 116, 139);
      doc.text('Boarder Signature', x + 19.5, curY + 3.2, { align: 'center' });
      doc.text('Manager Seal & Sig', x + slipWidth - 19.5, curY + 3.2, { align: 'center' });

      // Draw middle perforation guidelines on each page
      const isLastOnPage = pageIndex === slipsPerPage - 1 || index === report.boardersReport.length - 1;
      if (isLastOnPage) {
        // Vertical perforation between column 0 and column 1
        const midX = leftMargin + slipWidth + colGap / 2;
        doc.setDrawColor(180, 195, 210);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(midX, topMargin - 2, midX, topMargin + 2 * slipHeight + rowGap + 2);

        // Horizontal perforation between row 0 and row 1
        const midY = topMargin + slipHeight + rowGap / 2;
        doc.line(leftMargin - 2, midY, pageWidth - leftMargin + 2, midY);
        doc.setLineDashPattern([], 0); // reset dash pattern

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text('✂ Cut Along Guidelines ✂', midX, midY - 0.6, { align: 'center' });
      }
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

export interface SlipsOnlyPdfOptions {
  managerName?: string;
  managerPhone?: string;
  customNotes?: string;
}

/**
 * Generates an official, pure vector PDF containing strictly 4-per-page member financial vouchers.
 * Renders directly via jsPDF vector primitives (lines, text, boxes, badges, cut guides) - no raster screenshots.
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

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const activeMonthStr = formatReadableMonth(report.month);

  const slipsPerPage = 4;
  const colCount = 2;
  const leftMargin = 10;
  const topMargin = 10;
  const colGap = 6;
  const rowGap = 7;
  const slipWidth = (pageWidth - 2 * leftMargin - colGap) / colCount; // ~92mm
  const slipHeight = 130; // 130mm * 2 + 7mm + 20mm = 287mm < 297mm A4

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

    // Voucher box outline
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, slipWidth, slipHeight, 1.5, 1.5, 'FD');

    // Top Banner Header Band
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x + 0.4, y + 0.4, slipWidth - 0.8, 14, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(x, y + 14.5, x + slipWidth, y + 14.5);

    // Mess Title & Voucher #
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text((settings.messName || 'Mess').toUpperCase(), x + 3.5, y + 5);

    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`VOUCHER #${voucherNo}${roomStr ? ` | RM: ${roomStr}` : ''}`, x + slipWidth - 3.5, y + 5, { align: 'right' });

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`MEAL STATEMENT • ${activeMonthStr.toUpperCase()}`, x + 3.5, y + 9.5);

    // Status Badge (REFUNDABLE vs OUTSTANDING DUE)
    doc.setFillColor(isSurplus ? 220 : 254, isSurplus ? 252 : 226, isSurplus ? 231 : 226);
    doc.roundedRect(x + slipWidth - 31, y + 7.5, 27.5, 4.5, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
    doc.text(isSurplus ? 'REFUNDABLE / CREDIT' : 'OUTSTANDING DUE', x + slipWidth - 17.25, y + 10.7, { align: 'center' });

    // Member Profile Info Strip
    let curY = y + 19;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Member: ${bSum.boarderName}${roomStr ? ` [${roomStr}]` : ''}`, x + 3.5, curY);

    if (bDetails?.phone) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Ph: ${bDetails.phone}`, x + slipWidth - 3.5, curY, { align: 'right' });
    }

    // Breakdown Box Table
    curY += 3;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x + 3, curY, slipWidth - 6, 48, 'FD');

    // Row 1: Meals
    let rowY = curY + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(`1. Meals (${bSum.totalMeals} @ Tk ${report.mealRate.toFixed(2)})`, x + 5, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Tk ${bSum.mealCost.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

    // Row 2: Fixed Common Bills
    rowY += 9;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`2. Shared Fixed Overhead Share`, x + 5, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Tk ${bSum.fixedCostShare.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

    // Row 3: Total Charged (Divider line)
    rowY += 5.5;
    doc.setDrawColor(203, 213, 225);
    doc.line(x + 5, rowY, x + slipWidth - 5, rowY);
    rowY += 6.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('Total Month Charged (1 + 2):', x + 5, rowY);
    doc.text(`Tk ${bSum.totalCost.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

    // Row 4: Total Deposits
    rowY += 9;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(29, 78, 216); // Blue
    doc.text('Total Deposits Received:', x + 5, rowY);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tk ${bSum.totalDeposit.toFixed(2)}`, x + slipWidth - 5, rowY, { align: 'right' });

    // Net Closing Balance Banner
    curY += 51;
    doc.setFillColor(isSurplus ? 240 : 254, isSurplus ? 253 : 242, isSurplus ? 244 : 242);
    doc.setDrawColor(isSurplus ? 187 : 254, isSurplus ? 247 : 202, isSurplus ? 208 : 202);
    doc.rect(x + 3, curY, slipWidth - 6, 12, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
    doc.text(isSurplus ? 'Closing Refundable (Credit):' : 'Net Amount Due (Payable):', x + 5, curY + 7.5);
    doc.setFontSize(9);
    doc.text(`Tk ${Math.abs(bSum.balance).toFixed(2)}`, x + slipWidth - 5, curY + 8, { align: 'right' });

    // Notes / Instructions line
    curY += 15;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(customNotes, x + 3.5, curY);

    // Dual Signatures
    curY += 10;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.line(x + 5, curY, x + 34, curY);
    doc.line(x + slipWidth - 34, curY, x + slipWidth - 5, curY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(100, 116, 139);
    doc.text('Boarder Signature', x + 19.5, curY + 3.2, { align: 'center' });
    doc.text('Manager Seal & Sig', x + slipWidth - 19.5, curY + 3.2, { align: 'center' });

    // Draw middle perforation guidelines on each page
    const isLastOnPage = pageIndex === slipsPerPage - 1 || index === report.boardersReport.length - 1;
    if (isLastOnPage) {
      // Vertical perforation between column 0 and column 1
      const midX = leftMargin + slipWidth + colGap / 2;
      doc.setDrawColor(180, 195, 210);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(midX, topMargin - 2, midX, topMargin + 2 * slipHeight + rowGap + 2);

      // Horizontal perforation between row 0 and row 1
      const midY = topMargin + slipHeight + rowGap / 2;
      doc.line(leftMargin - 2, midY, pageWidth - leftMargin + 2, midY);
      doc.setLineDashPattern([], 0); // reset dash pattern

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('✂ Cut Along Guidelines ✂', midX, midY - 0.6, { align: 'center' });
    }
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
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
 * Renders directly via jsPDF and jspdf-autotable - no raster screenshots.
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

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const activeMonthStr = formatReadableMonth(report.month);

  const summary = report.boardersReport.find(r => r.boarderId === boarder.id) || {
    boarderId: boarder.id,
    boarderName: boarder.name,
    totalMeals: 0,
    mealCost: 0,
    fixedCostShare: 0,
    totalCost: 0,
    totalDeposit: 0,
    balance: 0,
    status: 'Settled' as const,
  };

  const isSurplus = summary.balance >= 0;
  const boarderDeposits = deposits.filter(d => d.boarderId === boarder.id && d.date.startsWith(report.month));

  // Outer border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  // Top header box
  doc.setFillColor(248, 250, 252);
  doc.rect(8.5, 8.5, pageWidth - 17, 24, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(8, 32.5, pageWidth - 8, 32.5);

  // Mess Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text((settings.messName || 'Mess').toUpperCase(), 14, 18);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`OFFICIAL MEMBER EXPENSE & MEAL SLIP - ${activeMonthStr.toUpperCase()}`, 14, 24);

  // Timestamp
  const now = new Date();
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Issued: ${now.toLocaleDateString('en-GB')}`, pageWidth - 14, 24, { align: 'right' });

  // Member Information Card
  let curY = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Member: ${boarder.name}`, 14, curY);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const roomInfo = boarder.roomNo ? `Room: ${boarder.roomNo}` : 'General';
  const phoneInfo = boarder.phone ? ` • Phone: ${boarder.phone}` : '';
  doc.text(`${roomInfo}${phoneInfo} • Status: ${boarder.isActive ? 'Active' : 'Inactive'}`, 14, curY + 5);

  // Status Badge
  doc.setFillColor(isSurplus ? 220 : 254, isSurplus ? 252 : 226, isSurplus ? 231 : 226);
  doc.roundedRect(pageWidth - 48, curY - 5, 34, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isSurplus ? 21 : 185, isSurplus ? 128 : 28, isSurplus ? 61 : 28);
  doc.text(isSurplus ? 'CREDIT / REFUNDABLE' : 'OUTSTANDING DUE', pageWidth - 31, curY - 0.5, { align: 'center' });

  curY += 12;

  // Financial Breakdown autoTable
  autoTable(doc, {
    startY: curY,
    margin: { left: 14, right: 14 },
    head: [['Description / Expense Category', 'Calculation Basis', 'Amount (Tk)']],
    body: [
      [
        'Total Meals Consumed',
        `${summary.totalMeals.toFixed(1)} meals @ Tk ${report.mealRate.toFixed(4)}/meal`,
        `Tk ${summary.mealCost.toFixed(2)}`,
      ],
      [
        'Shared Utility & Fixed Costs Share',
        'Equal division among active members',
        `Tk ${summary.fixedCostShare.toFixed(2)}`,
      ],
      [
        'Total Monthly Charges (A)',
        'Sum of Meal Cost + Shared Fixed Overhead',
        `Tk ${summary.totalCost.toFixed(2)}`,
      ],
      [
        'Total Advance Deposits Paid (B)',
        `${boarderDeposits.length} deposit entry(s) credited`,
        `Tk ${summary.totalDeposit.toFixed(2)}`,
      ],
    ],
    foot: [
      [
        isSurplus ? 'Closing Refund / Credit (B - A)' : 'Net Amount Due to Pay (A - B)',
        isSurplus ? 'Excess deposit will be refunded or adjusted' : 'Please settle with mess manager',
        `${isSurplus ? '+' : '-'}Tk ${Math.abs(summary.balance).toFixed(2)}`,
      ],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8,
      cellPadding: 2.8,
    },
    footStyles: {
      fillColor: isSurplus ? [240, 253, 244] : [254, 242, 242],
      textColor: isSurplus ? [21, 128, 61] : [185, 28, 28],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 45 },
      2: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.2,
  });

  // Deposits History subtable (if deposits exist)
  let finalY = (doc as any).lastAutoTable?.finalY || 100;

  if (boarderDeposits.length > 0 && finalY < 140) {
    finalY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Deposit Payments Credited This Month:', 14, finalY);
    finalY += 2;

    const depRows = boarderDeposits.map(d => [
      formatReadableDate(d.date),
      d.note || 'Regular cash deposit',
      `Tk ${d.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: finalY,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Payment Note / Method', 'Amount (Tk)']],
      body: depRows,
      theme: 'plain',
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [71, 85, 105],
        fontSize: 7,
        fontStyle: 'bold',
        cellPadding: 1.8,
      },
      bodyStyles: {
        textColor: [51, 65, 85],
        fontSize: 7,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 65 },
        2: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      },
      tableLineColor: [241, 245, 249],
      tableLineWidth: 0.2,
    });

    finalY = (doc as any).lastAutoTable?.finalY || finalY + 20;
  }

  // Notes box
  finalY += 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, pageWidth - 28, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Note: ${customNotes}`, 17, finalY + 4.5);
  if (managerPhone) {
    doc.text(`Manager: ${managerName} • Contact: ${managerPhone}`, 17, finalY + 8.5);
  } else {
    doc.text(`Manager: ${managerName} • Generated via MessMaster Portal`, 17, finalY + 8.5);
  }

  // Signatures at bottom
  const sigY = pageHeight - 18;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(18, sigY, 55, sigY);
  doc.line(pageWidth - 55, sigY, pageWidth - 18, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Boarder Signature', 36.5, sigY + 4, { align: 'center' });
  doc.text('Manager Signature & Seal', pageWidth - 36.5, sigY + 4, { align: 'center' });

  return doc;
}

