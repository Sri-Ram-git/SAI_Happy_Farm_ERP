import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Mock data
const startDate = '2026-09-28';
const endDate = '2026-10-04';
const periodTitle = 'Current Week';
const periodSubtitle = 'Week 39';
const weekInfo = { label: 'Week 39' };
const presetDays = 7;
const expectedDays = 7;
const activeMetric = 'productionGap';

const getMetricTitle = (m) => m;
const getTieBreakerText = (m) => m;

const farmKpis = [
  {
    farmId: 'AP12', farmName: 'Farm AP12', birdCount: 5000, actualProductionPct: 82.5, feedConsumedKg: 400.5, eggsProduced: 4100, avgEggWeightG: 55.2, eggsReceived: 4050, damageCount: 50, selectedEggs: 4000, mortalityBirds: 10, productionGapPct: 2.5, fcr: 2.15, eggDamagePct: 1.2, mortalityPct: 0.2, selectionPct: 98.5, hasIncompleteData: false, missingFields: []
  },
  {
    farmId: 'AP15', farmName: 'Farm AP15', birdCount: 4000, actualProductionPct: 79.5, feedConsumedKg: 350.2, eggsProduced: 3150, avgEggWeightG: 54.1, eggsReceived: 3100, damageCount: 100, selectedEggs: 3000, mortalityBirds: 15, productionGapPct: -0.5, fcr: 2.22, eggDamagePct: 3.1, mortalityPct: 0.4, selectionPct: 96.5, hasIncompleteData: false, missingFields: []
  },
  {
    farmId: 'AP16', farmName: 'Farm AP16', birdCount: 4500, actualProductionPct: 85.0, feedConsumedKg: 390.0, eggsProduced: 3800, avgEggWeightG: 56.5, eggsReceived: 3750, damageCount: 50, selectedEggs: 3700, mortalityBirds: 5, productionGapPct: 5.0, fcr: 2.05, eggDamagePct: 1.3, mortalityPct: 0.1, selectionPct: 98.7, hasIncompleteData: false, missingFields: []
  }
];

const sortedRankings = [...farmKpis].sort((a,b) => b.productionGapPct - a.productionGapPct);

const summaryAggregates = {
  totalFarms: 3, reportingFarms: 3, totalBirds: 13500, totalFeedKg: 1140.7, totalEggs: 11050, totalSelectedEggs: 10700, totalDamagedEggs: 200, totalMortality: 30, avgProductionGap: 2.3, avgFcr: 2.14, avgEggDamage: 1.8, avgMortality: 0.2, avgSelection: 97.9
};

// Reusable Excel formatting helpers
const applyTitleStyle = (ws, r, c, colsCount) => {
  for (let idx = c; idx < c + colsCount; idx++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: idx });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' }; // Create empty cell for styling if missing
    ws[cellRef].s = {
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "047857" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: 'medium', color: { rgb: "D1D5DB" } },
        bottom: { style: 'medium', color: { rgb: "D1D5DB" } },
        left: { style: 'medium', color: { rgb: "D1D5DB" } },
        right: { style: 'medium', color: { rgb: "D1D5DB" } }
      }
    };
  }
};

const applyMetadataStyle = (ws, R, colsCount) => {
  for (let c = 0; c < colsCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: R, c });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
    ws[cellRef].s = {
      font: { color: { rgb: "172033" } },
      fill: { fgColor: { rgb: "ECFDF5" } },
      alignment: { vertical: "center" },
      border: {
        top: { style: 'thin', color: { rgb: "D1D5DB" } },
        bottom: { style: 'thin', color: { rgb: "D1D5DB" } },
        left: { style: 'thin', color: { rgb: "D1D5DB" } },
        right: { style: 'thin', color: { rgb: "D1D5DB" } }
      }
    };
  }
};

const applyHeaderStyle = (ws, r, colsCount) => {
  for (let c = 0; c < colsCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "047857" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: "D1D5DB" } },
        bottom: { style: 'thin', color: { rgb: "D1D5DB" } },
        left: { style: 'thin', color: { rgb: "D1D5DB" } },
        right: { style: 'thin', color: { rgb: "D1D5DB" } }
      }
    };
  }
};

const applyRowBanding = (ws, startRow, endRow, colsCount, isRanking = false) => {
  for (let R = startRow; R <= endRow; R++) {
    const rowIndex = R - startRow;
    let bgColor = rowIndex % 2 === 1 ? "F8FAFC" : "FFFFFF";
    
    if (isRanking) {
      if (rowIndex === 0) bgColor = "DCFCE7";
      else if (rowIndex === 1) bgColor = "F1F5F9";
      else if (rowIndex === 2) bgColor = "FEF3C7";
    }

    for (let c = 0; c < colsCount; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      
      const existingS = ws[cellRef].s || {};
      ws[cellRef].s = {
        ...existingS,
        fill: { fgColor: { rgb: bgColor } },
        font: existingS.font || { color: { rgb: "172033" } },
        border: existingS.border || {
          bottom: { style: 'thin', color: { rgb: "D1D5DB" } },
          top: { style: 'thin', color: { rgb: "D1D5DB" } },
          left: { style: 'thin', color: { rgb: "D1D5DB" } },
          right: { style: 'thin', color: { rgb: "D1D5DB" } }
        }
      };
    }
  }
};

const applyConditionalStatusStyle = (ws, r, c, status) => {
  if (status === 'none') return;
  const cellRef = XLSX.utils.encode_cell({ r, c });
  if (ws[cellRef]) {
    const existingS = ws[cellRef].s || {};
    let fgColor = "FFFFFF";
    let fontColor = "172033";
    if (status === 'good') { fgColor = "DCFCE7"; fontColor = "15803D"; }
    else if (status === 'attention') { fgColor = "FEF3C7"; fontColor = "B45309"; }
    else if (status === 'critical') { fgColor = "FEE2E2"; fontColor = "B91C1C"; }
    
    ws[cellRef].s = {
      ...existingS,
      fill: { fgColor: { rgb: fgColor } },
      font: { ...existingS.font, color: { rgb: fontColor }, bold: true }
    };
  }
};

const applyNumberFormats = (ws, startRow, endRow, formatMap) => {
  for (let R = startRow; R <= endRow; R++) {
    for (const [colStr, format] of Object.entries(formatMap)) {
      const C = parseInt(colStr, 10);
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellRef] && ws[cellRef].t === 'n') {
        ws[cellRef].z = format;
      }
    }
  }
};

const setColumnWidths = (ws, widths) => {
  ws['!cols'] = widths.map(w => ({ wch: w }));
};

const configurePrintLayout = (ws) => {
  ws['!pageSetup'] = { fitToPage: 1, fitToWidth: 1, orientation: 'landscape' };
};


const wb = XLSX.utils.book_new();

      // Sheet 1: Weekly Data (Source Inputs & Formula Results)
      const weeklyDataAoa = [
        ['FARM PERFORMANCE REPORT — SOURCE INPUTS & FORMULA OUTPUTS'],
        ['Report Period', periodTitle, 'Date Range', `${startDate} to ${endDate}`, 'Cycle/Preset', presetDays ? `${presetDays} Days Preset` : weekInfo.label],
        [],
        [
          'Farm ID',
          'Farm Name',
          'Bird Count (D)',
          'Actual Prod % (G)',
          'Feed Consumed (kg) (H)',
          'Eggs Produced (I)',
          'Avg Egg Wt (g) (J)',
          'Eggs Received (L)',
          'Damage Count (M)',
          'Selected Eggs (O)',
          'Mortality Birds (Q)',
          'Production Gap % (35%)',
          'FCR (25%)',
          'Egg Damage % (20%)',
          'Mortality % (10%)',
          'Selection % (10%)',
          'Data Status',
        ],
        ...farmKpis.map((k) => [
          k.farmId,
          k.farmName,
          k.birdCount,
          k.actualProductionPct !== null ? k.actualProductionPct : 'N/A',
          k.feedConsumedKg,
          k.eggsProduced,
          k.avgEggWeightG !== null ? k.avgEggWeightG : 'N/A',
          k.eggsReceived,
          k.damageCount,
          k.selectedEggs,
          k.mortalityBirds,
          k.productionGapPct !== null ? k.productionGapPct : 'N/A',
          k.fcr !== null ? k.fcr : 'N/A',
          k.eggDamagePct !== null ? k.eggDamagePct : 'N/A',
          k.mortalityPct !== null ? k.mortalityPct : 'N/A',
          k.selectionPct !== null ? k.selectionPct : 'N/A',
          k.hasIncompleteData ? `Incomplete (${k.missingFields.join(', ')})` : 'Complete',
        ]),
      ];
      const wsWeeklyData = XLSX.utils.aoa_to_sheet(weeklyDataAoa);
      wsWeeklyData['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }];
      wsWeeklyData['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft' }];
      wsWeeklyData['!autofilter'] = { ref: `A4:Q${4 + farmKpis.length}` };

      applyTitleStyle(wsWeeklyData, 0, 0, 17);
      applyMetadataStyle(wsWeeklyData, 1, 17);
      applyHeaderStyle(wsWeeklyData, 3, 17);
      applyRowBanding(wsWeeklyData, 4, 3 + farmKpis.length, 17);
      setColumnWidths(wsWeeklyData, [12, 24, 16, 20, 22, 18, 18, 18, 18, 18, 20, 24, 16, 22, 20, 20, 24]);
      
      applyNumberFormats(wsWeeklyData, 4, 3 + farmKpis.length, {
        2: '#,##0',
        3: '0.0"%"',
        4: '#,##0.0',
        5: '#,##0',
        6: '0.00',
        7: '#,##0',
        8: '#,##0',
        9: '#,##0',
        10: '#,##0',
        11: '+0.0"%";-0.0"%";0.0"%"',
        12: '0.00',
        13: '0.0"%"',
        14: '0.0"%"',
        15: '0.0"%"',
      });

      farmKpis.forEach((k, i) => {
        const R = 4 + i;
        if (k.productionGapPct !== null) applyConditionalStatusStyle(wsWeeklyData, R, 11, k.productionGapPct >= 0 ? 'good' : 'critical');
        if (k.fcr !== null) applyConditionalStatusStyle(wsWeeklyData, R, 12, k.fcr <= 2.2 ? 'good' : 'attention');
        if (k.eggDamagePct !== null) applyConditionalStatusStyle(wsWeeklyData, R, 13, k.eggDamagePct <= 2.0 ? 'good' : 'critical');
        if (k.mortalityPct !== null) applyConditionalStatusStyle(wsWeeklyData, R, 14, k.mortalityPct <= 1.0 ? 'good' : 'critical');
        if (k.selectionPct !== null) applyConditionalStatusStyle(wsWeeklyData, R, 15, k.selectionPct >= 85 ? 'good' : 'attention');
      });

      configurePrintLayout(wsWeeklyData);
      XLSX.utils.book_append_sheet(wb, wsWeeklyData, 'Weekly Data');

      // Sheet 2: Final Ranking
      const rankingAoa = [
        ['SUPERVISOR FARM PERFORMANCE RANKING'],
        ['Primary Sorting Metric', getMetricTitle(activeMetric)],
        ['Documented Tie-Breaker', getTieBreakerText(activeMetric)],
        ['Reporting Period', `${periodTitle} (${periodSubtitle})`],
        ['Business Rule Notice', 'Overall composite ranking pending verified multi-metric normalization scale.'],
        [],
        [
          'Rank',
          'Farm ID',
          'Farm Name',
          'Production Gap % (35%)',
          'FCR (25%)',
          'Egg Damage % (20%)',
          'Mortality % (10%)',
          'Selection % (10%)',
          'Reports Submitted',
        ],
        ...sortedRankings.map((k, idx) => [
          `#${idx + 1}`,
          k.farmId,
          k.farmName,
          k.productionGapPct !== null ? k.productionGapPct : 'N/A',
          k.fcr !== null ? k.fcr : 'N/A',
          k.eggDamagePct !== null ? k.eggDamagePct : 'N/A',
          k.mortalityPct !== null ? k.mortalityPct : 'N/A',
          k.selectionPct !== null ? k.selectionPct : 'N/A',
          `${expectedDays} / ${expectedDays} days`,
        ]),
      ];
      const wsRanking = XLSX.utils.aoa_to_sheet(rankingAoa);
      wsRanking['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
      wsRanking['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 7, topLeftCell: 'A8', activePane: 'bottomLeft' }];
      wsRanking['!autofilter'] = { ref: `A7:I${7 + sortedRankings.length}` };

      applyTitleStyle(wsRanking, 0, 0, 9);
      applyMetadataStyle(wsRanking, 1, 9);
      applyMetadataStyle(wsRanking, 2, 9);
      applyMetadataStyle(wsRanking, 3, 9);
      applyMetadataStyle(wsRanking, 4, 9);
      applyHeaderStyle(wsRanking, 6, 9);
      applyRowBanding(wsRanking, 7, 6 + sortedRankings.length, 9, true);
      setColumnWidths(wsRanking, [10, 12, 25, 24, 16, 22, 20, 20, 22]);

      applyNumberFormats(wsRanking, 7, 6 + sortedRankings.length, {
        3: '+0.0"%";-0.0"%";0.0"%"',
        4: '0.00',
        5: '0.0"%"',
        6: '0.0"%"',
        7: '0.0"%"',
      });

      sortedRankings.forEach((k, i) => {
        const R = 7 + i;
        if (k.productionGapPct !== null) applyConditionalStatusStyle(wsRanking, R, 3, k.productionGapPct >= 0 ? 'good' : 'critical');
        if (k.fcr !== null) applyConditionalStatusStyle(wsRanking, R, 4, k.fcr <= 2.2 ? 'good' : 'attention');
        if (k.eggDamagePct !== null) applyConditionalStatusStyle(wsRanking, R, 5, k.eggDamagePct <= 2.0 ? 'good' : 'critical');
        if (k.mortalityPct !== null) applyConditionalStatusStyle(wsRanking, R, 6, k.mortalityPct <= 1.0 ? 'good' : 'critical');
        if (k.selectionPct !== null) applyConditionalStatusStyle(wsRanking, R, 7, k.selectionPct >= 85 ? 'good' : 'attention');
        applyConditionalStatusStyle(wsRanking, R, 8, expectedDays >= expectedDays ? 'good' : 'attention');
      });

      configurePrintLayout(wsRanking);
      XLSX.utils.book_append_sheet(wb, wsRanking, 'Final Ranking');

      // Sheet 3: Summary Dashboard
      const summaryAoa = [
        ['PERFORMANCE SUMMARY DASHBOARD'],
        ['Reporting Period', `${periodTitle} (${periodSubtitle})`],
        ['Date Range', `${startDate} to ${endDate}`],
        [],
        ['Metric Description', 'Aggregate Value', 'Unit'],
        ['Total Assigned Farms', summaryAggregates.totalFarms, 'Farms'],
        ['Farms Reporting in Period', summaryAggregates.reportingFarms, 'Farms'],
        ['Total Bird Population', summaryAggregates.totalBirds, 'Birds'],
        ['Total Feed Consumed', summaryAggregates.totalFeedKg, 'Kg'],
        ['Total Eggs Produced', summaryAggregates.totalEggs, 'Eggs'],
        ['Total Selected Eggs', summaryAggregates.totalSelectedEggs, 'Eggs'],
        ['Total Damaged Eggs', summaryAggregates.totalDamagedEggs, 'Eggs'],
        ['Total Dead Birds (Mortality)', summaryAggregates.totalMortality, 'Birds'],
        ['Average Production Gap %', summaryAggregates.avgProductionGap !== null ? summaryAggregates.avgProductionGap : 'N/A', '%'],
        ['Average FCR', summaryAggregates.avgFcr !== null ? summaryAggregates.avgFcr : 'N/A', 'Ratio'],
        ['Average Egg Damage %', summaryAggregates.avgEggDamage !== null ? summaryAggregates.avgEggDamage : 'N/A', '%'],
        ['Average Mortality %', summaryAggregates.avgMortality !== null ? summaryAggregates.avgMortality : 'N/A', '%'],
        ['Average Selection %', summaryAggregates.avgSelection !== null ? summaryAggregates.avgSelection : 'N/A', '%'],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
      wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
      wsSummary['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 5, topLeftCell: 'A6', activePane: 'bottomLeft' }];

      applyTitleStyle(wsSummary, 0, 0, 3);
      applyMetadataStyle(wsSummary, 1, 3);
      applyMetadataStyle(wsSummary, 2, 3);
      applyHeaderStyle(wsSummary, 4, 3);
      applyRowBanding(wsSummary, 5, 17, 3);
      setColumnWidths(wsSummary, [35, 20, 10]);

      for (let R = 5; R <= 17; R++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: 1 });
        if (wsSummary[cellRef] && wsSummary[cellRef].t === 'n') {
          if (R >= 5 && R <= 7) wsSummary[cellRef].z = '#,##0';
          else if (R === 8) wsSummary[cellRef].z = '#,##0.0';
          else if (R >= 9 && R <= 12) wsSummary[cellRef].z = '#,##0';
          else if (R === 13) wsSummary[cellRef].z = '+0.0"%";-0.0"%";0.0"%"';
          else if (R === 14) wsSummary[cellRef].z = '0.00';
          else if (R >= 15 && R <= 17) wsSummary[cellRef].z = '0.0"%"';
        }
      }

      if (summaryAggregates.avgProductionGap !== null) applyConditionalStatusStyle(wsSummary, 13, 1, summaryAggregates.avgProductionGap >= 0 ? 'good' : 'critical');
      if (summaryAggregates.avgFcr !== null) applyConditionalStatusStyle(wsSummary, 14, 1, summaryAggregates.avgFcr <= 2.2 ? 'good' : 'attention');
      if (summaryAggregates.avgEggDamage !== null) applyConditionalStatusStyle(wsSummary, 15, 1, summaryAggregates.avgEggDamage <= 2.0 ? 'good' : 'critical');
      if (summaryAggregates.avgMortality !== null) applyConditionalStatusStyle(wsSummary, 16, 1, summaryAggregates.avgMortality <= 1.0 ? 'good' : 'critical');
      if (summaryAggregates.avgSelection !== null) applyConditionalStatusStyle(wsSummary, 17, 1, summaryAggregates.avgSelection >= 85 ? 'good' : 'attention');
      
      configurePrintLayout(wsSummary);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Dashboard');


      const filename = `Supervisor_Farm_Rankings_2026-09-28_to_2026-10-04.xlsx`;
      XLSX.writeFile(wb, filename);
