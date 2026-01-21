// Base Excel Generator Utility
// Provides common functions for creating professionally formatted Excel files

import ExcelJS from 'exceljs';

// Simple Orange Color Scheme
export const STATUS_COLORS = {
    present: { argb: 'FFFF9800' },      // Orange
    wfh: { argb: 'FFFFA726' },          // Light Orange
    half_day: { argb: 'FFFFB74D' },     // Lighter Orange
    on_leave: { argb: 'FFFFCC80' },     // Very Light Orange
    leave: { argb: 'FFFFCC80' },        // Very Light Orange
    absent: { argb: 'FFE0E0E0' },       // Gray
    weekend: { argb: 'FFF5F5F5' },      // Very Light Gray
    holiday: { argb: 'FFFFE0B2' }       // Peach
};

// Status short codes for matrix view
export const STATUS_CODES = {
    present: 'P',
    wfh: 'W',
    half_day: 'H',
    on_leave: 'L',
    leave: 'L',
    absent: 'A'
};

// Create a new workbook
export function createWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Life In Pixels - Work Tracker';
    workbook.created = new Date();
    workbook.modified = new Date();
    return workbook;
}

// Add company header to worksheet
export function addCompanyHeader(worksheet, title, subtitle = '') {
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LIFE IN PIXELS - WORK TRACKER';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFF6F00' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A2:H2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = title;
    subtitleCell.font = { name: 'Calibri', size: 14, bold: true };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    if (subtitle) {
        worksheet.mergeCells('A3:H3');
        const dateCell = worksheet.getCell('A3');
        dateCell.value = subtitle;
        dateCell.font = { name: 'Calibri', size: 11, italic: true };
        dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Add spacing
    worksheet.getRow(4).height = 10;
}

// Style header row
export function styleHeaderRow(row, cellCount = 8) {
    row.height = 25;
    row.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF6F00' }
    };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
}

// Apply borders to cell range
export function applyBorders(worksheet, startRow, startCol, endRow, endCol) {
    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const cell = worksheet.getRow(row).getCell(col);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        }
    }
}

// Color cell based on status
export function colorCellByStatus(cell, status) {
    const color = STATUS_COLORS[status?.toLowerCase()];
    if (color) {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: color
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
}

// Auto-fit columns
export function autoFitColumns(worksheet) {
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellValue = cell.value ? cell.value.toString() : '';
            maxLength = Math.max(maxLength, cellValue.length);
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });
}

// Add footer with generation info
export function addFooter(worksheet, rowNumber) {
    const footerRow = worksheet.getRow(rowNumber);
    worksheet.mergeCells(rowNumber, 1, rowNumber, 8);
    const footerCell = footerRow.getCell(1);
    footerCell.value = `Generated on ${new Date().toLocaleString('en-IN', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata'
    })} IST`;
    footerCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF666666' } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'right' };
}

// Format time string
export function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Calculate hours between two times
export function calculateHours(startTime, endTime) {
    if (!startTime || !endTime) return 0;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const diffMinutes = endMinutes - startMinutes;
    return parseFloat((diffMinutes / 60).toFixed(2));
}

// Calculate working days in date range (exclude weekends)
export function calculateWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

// Check if date is weekend
export function isWeekend(date) {
    const d = new Date(date);
    return d.getDay() === 0 || d.getDay() === 6;
}

// Generate filename with timestamp
export function generateFilename(type, employeeName = '', dateRange = '') {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedName = employeeName.replace(/[^a-z0-9]/gi, '_');

    if (employeeName && dateRange) {
        return `${type}_${sanitizedName}_${dateRange}_${timestamp}.xlsx`;
    } else if (dateRange) {
        return `${type}_${dateRange}_${timestamp}.xlsx`;
    } else {
        return `${type}_${timestamp}.xlsx`;
    }
}

// Convert Excel buffer to base64 (for sending to frontend)
export async function workbookToBuffer(workbook) {
    return await workbook.xlsx.writeBuffer();
}
