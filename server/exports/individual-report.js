// Individual Employee Report Generator
// Creates detailed attendance report for a single employee

import {
    createWorkbook,
    addCompanyHeader,
    styleHeaderRow,
    applyBorders,
    colorCellByStatus,
    autoFitColumns,
    addFooter,
    formatTime,
    calculateHours,
    calculateWorkingDays,
    isWeekend,
    generateFilename,
    workbookToBuffer
} from './excel-generator.js';

export async function generateIndividualReport(employeeData, attendanceData, dateRange) {
    const workbook = createWorkbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    let currentRow = 1;

    // Add company header
    const title = `INDIVIDUAL ATTENDANCE REPORT`;
    const subtitle = `${dateRange.startDate} to ${dateRange.endDate}`;
    addCompanyHeader(worksheet, title, subtitle);
    currentRow = 5;

    // Employee Information Section
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    worksheet.getCell(currentRow, 1).value = 'EMPLOYEE INFORMATION';
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 12 };
    worksheet.getCell(currentRow, 1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    currentRow++;

    // Employee details
    const employeeInfo = [
        ['Name:', employeeData.full_name],
        ['Employee ID:', employeeData.employee_id],
        ['Department:', employeeData.department || 'N/A'],
        ['Email:', employeeData.email],
        ['Join Date:', employeeData.created_at ? new Date(employeeData.created_at).toLocaleDateString() : 'N/A']
    ];

    employeeInfo.forEach(([label, value]) => {
        worksheet.getCell(currentRow, 1).value = label;
        worksheet.getCell(currentRow, 1).font = { bold: true };
        worksheet.getCell(currentRow, 2).value = value;
        currentRow++;
    });

    currentRow++; // Spacing

    // Summary Statistics Section
    const stats = calculateStatistics(attendanceData, dateRange);

    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    worksheet.getCell(currentRow, 1).value = 'SUMMARY STATISTICS';
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 12 };
    worksheet.getCell(currentRow, 1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    currentRow++;

    // Statistics table
    const statsData = [
        ['Total Working Days', stats.totalWorkingDays],
        ['Days Present', stats.present],
        ['Work From Home', stats.wfh],
        ['Half Days', stats.halfDay],
        ['On Leave', stats.onLeave],
        ['Absent', stats.absent],
        ['Not Marked', stats.notMarked],
        ['Attendance Rate', `${stats.attendanceRate}%`],
        ['Average Hours/Day', stats.avgHours],
        ['Total Hours Worked', stats.totalHours],
        ['On-Time Arrivals', `${stats.punctualityScore}%`]
    ];

    statsData.forEach(([label, value]) => {
        worksheet.getCell(currentRow, 1).value = label;
        worksheet.getCell(currentRow, 1).font = { bold: true };
        worksheet.getCell(currentRow, 2).value = value;

        // Color code percentages
        if (label === 'Attendance Rate' && stats.attendanceRate >= 90) {
            worksheet.getCell(currentRow, 2).font = { bold: true, color: { argb: 'FF4CAF50' } };
        } else if (label === 'Attendance Rate' && stats.attendanceRate < 75) {
            worksheet.getCell(currentRow, 2).font = { bold: true, color: { argb: 'FFF44336' } };
        }

        currentRow++;
    });

    currentRow += 2; // Spacing

    // Daily Attendance Table
    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    worksheet.getCell(currentRow, 1).value = 'DAILY ATTENDANCE BREAKDOWN';
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 12 };
    worksheet.getCell(currentRow, 1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    currentRow++;

    // Table headers
    const headerRow = worksheet.getRow(currentRow);
    const headers = ['Date', 'Day', 'Status', 'Check-in', 'Check-out', 'Hours', 'Notes', 'Remarks'];
    headers.forEach((header, index) => {
        headerRow.getCell(index + 1).value = header;
    });
    styleHeaderRow(headerRow, headers.length);
    currentRow++;

    const tableStartRow = currentRow;

    // Attendance data rows
    attendanceData.forEach((record, index) => {
        const row = worksheet.getRow(currentRow);
        row.height = 22; // Increase row height for better readability

        const date = new Date(record.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const hours = record.work_hours_start && record.work_hours_end
            ? calculateHours(record.work_hours_start, record.work_hours_end)
            : 0;

        row.getCell(1).value = date.toLocaleDateString();
        row.getCell(2).value = dayName;
        row.getCell(3).value = record.status ? record.status.toUpperCase().replace('_', ' ') : 'Not Marked';
        row.getCell(4).value = record.work_hours_start ? formatTime(record.work_hours_start) : '-';
        row.getCell(5).value = record.work_hours_end ? formatTime(record.work_hours_end) : '-';
        row.getCell(6).value = hours > 0 ? hours.toFixed(2) : '-';
        row.getCell(7).value = record.notes || '';

        // Remarks column
        let remarks = '';
        if (isWeekend(date)) {
            remarks = 'Weekend';
        } else if (record.work_hours_start) {
            const [hour] = record.work_hours_start.split(':').map(Number);
            if (hour > 9 || (hour === 9 && parseInt(record.work_hours_start.split(':')[1]) > 30)) {
                remarks = 'Late';
            }
        }
        row.getCell(8).value = remarks;

        // Color code status cell
        if (record.status) {
            colorCellByStatus(row.getCell(3), record.status);
        }

        // Highlight weekends
        if (isWeekend(date)) {
            for (let col = 1; col <= 8; col++) {
                row.getCell(col).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
            }
        }

        currentRow++;
    });

    // Apply borders to table
    applyBorders(worksheet, tableStartRow - 1, 1, currentRow - 1, 8);

    // Auto-fit columns with better widths
    worksheet.columns = [
        { key: 'date', width: 12 },
        { key: 'day', width: 10 },
        { key: 'status', width: 14 },
        { key: 'checkin', width: 12 },
        { key: 'checkout', width: 12 },
        { key: 'hours', width: 10 },
        { key: 'notes', width: 35 },
        { key: 'remarks', width: 12 }
    ];

    // Apply text wrapping and alignment to all data cells
    for (let row = tableStartRow; row < currentRow; row++) {
        for (let col = 1; col <= 8; col++) {
            const cell = worksheet.getRow(row).getCell(col);
            cell.alignment = {
                vertical: 'middle',
                horizontal: col === 7 ? 'left' : 'center', // Notes column left-aligned
                wrapText: col === 7 // Wrap text in notes column
            };
        }
    }

    // Add footer
    currentRow++;
    addFooter(worksheet, currentRow);

    // Generate buffer
    const buffer = await workbookToBuffer(workbook);

    const filename = generateFilename(
        'Individual_Report',
        employeeData.full_name,
        `${dateRange.startDate}_to_${dateRange.endDate}`
    );

    return { buffer, filename };
}

// Calculate statistics from attendance data
function calculateStatistics(attendanceData, dateRange) {
    const totalWorkingDays = calculateWorkingDays(dateRange.startDate, dateRange.endDate);

    let present = 0;
    let wfh = 0;
    let halfDay = 0;
    let onLeave = 0;
    let absent = 0;
    let totalHours = 0;
    let onTimeArrival = 0;
    let daysWithData = 0;

    attendanceData.forEach(record => {
        if (record.status) {
            daysWithData++;
            switch (record.status.toLowerCase()) {
                case 'present': present++; break;
                case 'wfh': wfh++; break;
                case 'half_day': halfDay++; break;
                case 'on_leave':
                case 'leave': onLeave++; break;
                case 'absent': absent++; break;
            }

            if (record.work_hours_start && record.work_hours_end) {
                const hours = calculateHours(record.work_hours_start, record.work_hours_end);
                totalHours += hours;

                // Check punctuality (on-time if started by 9:30 AM)
                const [hour, minute] = record.work_hours_start.split(':').map(Number);
                if (hour < 9 || (hour === 9 && minute <= 30)) {
                    onTimeArrival++;
                }
            }
        }
    });

    const notMarked = totalWorkingDays - daysWithData;
    const markedDays = present + wfh + halfDay;
    const attendanceRate = totalWorkingDays > 0
        ? ((markedDays / totalWorkingDays) * 100).toFixed(1)
        : 0;
    const avgHours = markedDays > 0
        ? (totalHours / markedDays).toFixed(2)
        : 0;
    const punctualityScore = daysWithData > 0
        ? ((onTimeArrival / daysWithData) * 100).toFixed(1)
        : 0;

    return {
        totalWorkingDays,
        present,
        wfh,
        halfDay,
        onLeave,
        absent,
        notMarked,
        attendanceRate: parseFloat(attendanceRate),
        avgHours: parseFloat(avgHours),
        totalHours: totalHours.toFixed(2),
        punctualityScore: parseFloat(punctualityScore)
    };
}
