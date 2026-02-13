// Monthly Summary Report Generator
// Creates matrix-style report (employees × days)

import {
    createWorkbook,
    addCompanyHeader,
    styleHeaderRow,
    applyBorders,
    STATUS_CODES,
    colorCellByStatus,
    addFooter,
    isWeekend,
    generateFilename,
    workbookToBuffer
} from './excel-generator.js';

export async function generateMonthlySummary(pool, year, month) {
    const workbook = createWorkbook();
    const worksheet = workbook.addWorksheet('Monthly Summary');

    // Calculate date range
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    const startDate = firstDay.toISOString().split('T')[0];
    const endDate = lastDay.toISOString().split('T')[0];

    let currentRow = 1;

    // Add header
    const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const title = `MONTHLY ATTENDANCE SUMMARY`;
    const subtitle = monthName;
    addCompanyHeader(worksheet, title, subtitle);
    currentRow = 5;

    // Get all employees
    const employeesResult = await pool.query(
        `SELECT id, full_name, employee_id, department
         FROM users
         WHERE role = 'employee'
         ORDER BY full_name ASC`
    );

    const employees = employeesResult.rows;

    if (employees.length === 0) {
        throw new Error('No employees found');
    }

    // Matrix header row
    const headerRow = worksheet.getRow(currentRow);
    headerRow.height = 35;

    // First columns: employee info
    headerRow.getCell(1).value = 'Emp ID';
    headerRow.getCell(2).value = 'Name';
    headerRow.getCell(3).value = 'Dept';

    // Day columns with better formatting
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
        const cell = headerRow.getCell(3 + day);

        // Format: "Day\nDD"
        cell.value = `${dayOfWeek}\n${day}`;
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
        };
        cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } };

        // Color weekends differently in header
        if (date.getDay() === 0 || date.getDay() === 6) {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF9E9E9E' }
            };
        }
    }

    // Summary columns
    headerRow.getCell(4 + daysInMonth).value = 'P';
    headerRow.getCell(5 + daysInMonth).value = 'W';
    headerRow.getCell(6 + daysInMonth).value = 'H';
    headerRow.getCell(7 + daysInMonth).value = 'L';
    headerRow.getCell(8 + daysInMonth).value = 'A';

    styleHeaderRow(headerRow, 8 + daysInMonth);
    currentRow++;

    const tableStartRow = currentRow;

    // Process each employee
    for (const employee of employees) {
        const row = worksheet.getRow(currentRow);
        row.height = 25;

        // Employee info
        row.getCell(1).value = employee.employee_id;
        row.getCell(2).value = employee.full_name;
        row.getCell(3).value = employee.department || 'N/A';

        // Get attendance for the month
        const attendanceResult = await pool.query(
            `SELECT date, status
             FROM attendance
             WHERE user_id = $1 AND date BETWEEN $2 AND $3
             ORDER BY date ASC`,
            [employee.id, startDate, endDate]
        );

        // Create attendance map
        const attendanceMap = {};
        attendanceResult.rows.forEach(record => {
            const day = new Date(record.date).getDate();
            attendanceMap[day] = record.status;
        });

        // Count statistics
        let present = 0, wfh = 0, halfDay = 0, onLeave = 0, absent = 0;

        // Fill day columns
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const cell = row.getCell(3 + day);
            const status = attendanceMap[day];

            if (status) {
                const code = STATUS_CODES[status.toLowerCase()] || status.substring(0, 1).toUpperCase();
                cell.value = code;

                // Use different colors for each status
                const statusColors = {
                    'present': { argb: 'FF4CAF50' },      // Green
                    'wfh': { argb: 'FF2196F3' },          // Blue
                    'half_day': { argb: 'FFFF9800' },     // Orange
                    'on_leave': { argb: 'FF9C27B0' },     // Purple
                    'leave': { argb: 'FF9C27B0' },        // Purple
                    'absent': { argb: 'FFF44336' }        // Red
                };

                const color = statusColors[status.toLowerCase()];
                if (color) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: color
                    };
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
                }

                // Count stats
                switch (status.toLowerCase()) {
                    case 'present': present++; break;
                    case 'wfh': wfh++; break;
                    case 'half_day': halfDay++; break;
                    case 'on_leave':
                    case 'leave': onLeave++; break;
                    case 'absent': absent++; break;
                }
            } else if (isWeekend(date)) {
                cell.value = '-';
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
                cell.font = { size: 9, color: { argb: 'FF999999' } };
            } else {
                cell.value = '';
            }

            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }

        // Summary columns
        row.getCell(4 + daysInMonth).value = present;
        row.getCell(5 + daysInMonth).value = wfh;
        row.getCell(6 + daysInMonth).value = halfDay;
        row.getCell(7 + daysInMonth).value = onLeave;
        row.getCell(8 + daysInMonth).value = absent;

        // Style employee info columns
        for (let col = 1; col <= 3; col++) {
            row.getCell(col).alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
            row.getCell(col).font = { size: 9 };
        }

        // Style summary columns
        for (let col = 4 + daysInMonth; col <= 8 + daysInMonth; col++) {
            row.getCell(col).alignment = { vertical: 'middle', horizontal: 'center' };
            row.getCell(col).font = { size: 9, bold: true };
            row.getCell(col).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFE0B2' }
            };
        }

        currentRow++;
    }

    // Apply borders to entire table
    applyBorders(worksheet, tableStartRow - 1, 1, currentRow - 1, 8 + daysInMonth);

    // Set column widths
    worksheet.getColumn(1).width = 12; // Emp ID
    worksheet.getColumn(2).width = 25; // Name
    worksheet.getColumn(3).width = 15; // Dept

    // Day columns - narrower
    for (let day = 1; day <= daysInMonth; day++) {
        worksheet.getColumn(3 + day).width = 4;
    }

    // Summary columns
    for (let col = 4 + daysInMonth; col <= 8 + daysInMonth; col++) {
        worksheet.getColumn(col).width = 5;
    }

    // Add legend
    currentRow += 2;
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    worksheet.getCell(currentRow, 1).value = 'LEGEND:';
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 11 };
    currentRow++;

    const legend = [
        ['P', 'Present', 'FF4CAF50'],
        ['W', 'Work From Home', 'FF2196F3'],
        ['H', 'Half Day', 'FFFF9800'],
        ['L', 'On Leave', 'FF9C27B0'],
        ['A', 'Absent', 'FFF44336'],
        ['-', 'Weekend', 'FFF5F5F5']
    ];

    legend.forEach(([code, description, color]) => {
        const row = worksheet.getRow(currentRow);
        const codeCell = row.getCell(1);
        const descCell = row.getCell(2);

        codeCell.value = code;
        codeCell.font = { bold: true, size: 10, color: { argb: color === 'FFF5F5F5' ? 'FF000000' : 'FFFFFFFF' } };
        codeCell.alignment = { horizontal: 'center', vertical: 'middle' };
        codeCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color }
        };
        codeCell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        descCell.value = description;
        descCell.font = { size: 10 };
        descCell.alignment = { vertical: 'middle' };

        currentRow++;
    });

    // Add footer
    currentRow += 2;
    addFooter(worksheet, currentRow);

    // Generate buffer
    const buffer = await workbookToBuffer(workbook);
    const filename = generateFilename(
        'Monthly_Summary',
        '',
        `${year}_${String(month).padStart(2, '0')}`
    );

    return { buffer, filename };
}
