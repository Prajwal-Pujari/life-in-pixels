// Bulk Report Generator
// Creates multi-sheet Excel workbook with all employees

import {
    createWorkbook,
    addCompanyHeader,
    styleHeaderRow,
    applyBorders,
    colorCellByStatus,
    addFooter,
    formatTime,
    calculateHours,
    calculateWorkingDays,
    isWeekend,
    generateFilename,
    workbookToBuffer
} from './excel-generator.js';

export async function generateBulkReport(pool, dateRange) {
    const workbook = createWorkbook();

    // Get all employees
    const employeesResult = await pool.query(
        `SELECT id, full_name, employee_id, department, email, created_at
         FROM users
         WHERE role = 'employee'
         ORDER BY full_name ASC`
    );

    const employees = employeesResult.rows;

    if (employees.length === 0) {
        throw new Error('No employees found');
    }

    // Create summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    let summaryRow = 1;

    // Add header
    const title = 'BULK ATTENDANCE REPORT - ALL EMPLOYEES';
    const subtitle = `${dateRange.startDate} to ${dateRange.endDate}`;
    addCompanyHeader(summarySheet, title, subtitle);
    summaryRow = 5;

    // Summary statistics
    summarySheet.mergeCells(summaryRow, 1, summaryRow, 6);
    summarySheet.getCell(summaryRow, 1).value = 'SUMMARY STATISTICS';
    summarySheet.getCell(summaryRow, 1).font = { bold: true, size: 12 };
    summarySheet.getCell(summaryRow, 1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    summaryRow++;

    const totalWorkingDays = calculateWorkingDays(dateRange.startDate, dateRange.endDate);

    summarySheet.getCell(summaryRow, 1).value = 'Total Employees:';
    summarySheet.getCell(summaryRow, 1).font = { bold: true };
    summarySheet.getCell(summaryRow, 2).value = employees.length;
    summaryRow++;

    summarySheet.getCell(summaryRow, 1).value = 'Working Days in Range:';
    summarySheet.getCell(summaryRow, 1).font = { bold: true };
    summarySheet.getCell(summaryRow, 2).value = totalWorkingDays;
    summaryRow++;

    summaryRow += 2;

    // Employee overview table
    summarySheet.mergeCells(summaryRow, 1, summaryRow, 8);
    summarySheet.getCell(summaryRow, 1).value = 'EMPLOYEE OVERVIEW';
    summarySheet.getCell(summaryRow, 1).font = { bold: true, size: 12 };
    summarySheet.getCell(summaryRow, 1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    summaryRow++;

    // Header row
    const headerRow = summarySheet.getRow(summaryRow);
    const headers = ['Employee ID', 'Name', 'Department', 'Present', 'WFH', 'Half Day', 'Leave', 'Absent'];
    headers.forEach((header, index) => {
        headerRow.getCell(index + 1).value = header;
    });
    styleHeaderRow(headerRow, headers.length);
    summaryRow++;

    const tableStartRow = summaryRow;

    // Process each employee
    for (const employee of employees) {
        // Get attendance data
        const attendanceResult = await pool.query(
            `SELECT date, status, work_hours_start, work_hours_end, notes
             FROM attendance
             WHERE user_id = $1 AND date BETWEEN $2 AND $3
             ORDER BY date ASC`,
            [employee.id, dateRange.startDate, dateRange.endDate]
        );

        // Calculate stats
        let present = 0, wfh = 0, halfDay = 0, onLeave = 0, absent = 0;

        attendanceResult.rows.forEach(record => {
            switch (record.status?.toLowerCase()) {
                case 'present': present++; break;
                case 'wfh': wfh++; break;
                case 'half_day': halfDay++; break;
                case 'on_leave':
                case 'leave': onLeave++; break;
                case 'absent': absent++; break;
            }
        });

        // Add row to summary
        const row = summarySheet.getRow(summaryRow);
        row.height = 20;
        row.getCell(1).value = employee.employee_id;
        row.getCell(2).value = employee.full_name;
        row.getCell(3).value = employee.department || 'N/A';
        row.getCell(4).value = present;
        row.getCell(5).value = wfh;
        row.getCell(6).value = halfDay;
        row.getCell(7).value = onLeave;
        row.getCell(8).value = absent;

        // Center align
        for (let col = 1; col <= 8; col++) {
            row.getCell(col).alignment = { vertical: 'middle', horizontal: 'center' };
        }

        summaryRow++;

        // Create individual sheet for this employee
        await addEmployeeSheet(workbook, pool, employee, dateRange);
    }

    // Apply borders to summary table
    applyBorders(summarySheet, tableStartRow - 1, 1, summaryRow - 1, 8);

    // Set column widths
    summarySheet.columns = [
        { key: 'emp_id', width: 15 },
        { key: 'name', width: 25 },
        { key: 'dept', width: 20 },
        { key: 'present', width: 10 },
        { key: 'wfh', width: 10 },
        { key: 'half', width: 10 },
        { key: 'leave', width: 10 },
        { key: 'absent', width: 10 }
    ];

    // Add footer
    summaryRow++;
    addFooter(summarySheet, summaryRow);

    // Generate buffer
    const buffer = await workbookToBuffer(workbook);
    const filename = generateFilename(
        'Bulk_Report',
        '',
        `${dateRange.startDate}_to_${dateRange.endDate}`
    );

    return { buffer, filename };
}

// Helper function to add individual employee sheet
async function addEmployeeSheet(workbook, pool, employee, dateRange) {
    const sheetName = `${employee.employee_id}_${employee.full_name.substring(0, 20)}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const worksheet = workbook.addWorksheet(sheetName);

    let currentRow = 1;

    // Add header
    const title = `${employee.full_name} - ATTENDANCE REPORT`;
    const subtitle = `${dateRange.startDate} to ${dateRange.endDate}`;
    addCompanyHeader(worksheet, title, subtitle);
    currentRow = 5;

    // Employee info
    const employeeInfo = [
        ['Employee ID:', employee.employee_id],
        ['Department:', employee.department || 'N/A'],
        ['Email:', employee.email]
    ];

    employeeInfo.forEach(([label, value]) => {
        worksheet.getCell(currentRow, 1).value = label;
        worksheet.getCell(currentRow, 1).font = { bold: true };
        worksheet.getCell(currentRow, 2).value = value;
        currentRow++;
    });

    currentRow += 2;

    // Daily attendance table
    const headerRow = worksheet.getRow(currentRow);
    const headers = ['Date', 'Day', 'Status', 'Check-in', 'Check-out', 'Hours', 'Notes'];
    headers.forEach((header, index) => {
        headerRow.getCell(index + 1).value = header;
    });
    styleHeaderRow(headerRow, headers.length);
    currentRow++;

    const tableStartRow = currentRow;

    // Get attendance data
    const attendanceResult = await pool.query(
        `SELECT date, status, work_hours_start, work_hours_end, notes
         FROM attendance
         WHERE user_id = $1 AND date BETWEEN $2 AND $3
         ORDER BY date ASC`,
        [employee.id, dateRange.startDate, dateRange.endDate]
    );

    // Generate all dates in range
    const allDates = [];
    const current = new Date(dateRange.startDate);
    const endD = new Date(dateRange.endDate);

    while (current <= endD) {
        const dateStr = current.toISOString().split('T')[0];
        const attendanceRecord = attendanceResult.rows.find(r =>
            r.date.toISOString().split('T')[0] === dateStr
        );

        allDates.push({
            date: dateStr,
            status: attendanceRecord?.status || null,
            work_hours_start: attendanceRecord?.work_hours_start || null,
            work_hours_end: attendanceRecord?.work_hours_end || null,
            notes: attendanceRecord?.notes || null
        });

        current.setDate(current.getDate() + 1);
    }

    // Add data rows
    allDates.forEach(record => {
        const row = worksheet.getRow(currentRow);
        row.height = 20;

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

        // Color status cell
        if (record.status) {
            colorCellByStatus(row.getCell(3), record.status);
        }

        // Highlight weekends
        if (isWeekend(date)) {
            for (let col = 1; col <= 7; col++) {
                row.getCell(col).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
            }
        }

        // Center align
        for (let col = 1; col <= 7; col++) {
            row.getCell(col).alignment = {
                vertical: 'middle',
                horizontal: col === 7 ? 'left' : 'center',
                wrapText: col === 7
            };
        }

        currentRow++;
    });

    // Apply borders
    applyBorders(worksheet, tableStartRow - 1, 1, currentRow - 1, 7);

    // Set column widths
    worksheet.columns = [
        { key: 'date', width: 12 },
        { key: 'day', width: 10 },
        { key: 'status', width: 14 },
        { key: 'checkin', width: 12 },
        { key: 'checkout', width: 12 },
        { key: 'hours', width: 10 },
        { key: 'notes', width: 35 }
    ];

    // Add footer
    currentRow++;
    addFooter(worksheet, currentRow);
}
