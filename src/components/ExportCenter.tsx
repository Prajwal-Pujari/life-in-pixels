// Export Center Component - MVP Version
// Simple UI for testing Excel exports

import React, { useState, useEffect } from 'react';

interface ExportCenterProps {
    token: string;
    onClose: () => void;
}

interface Employee {
    id: number;
    full_name: string;
    employee_id: string;
    department: string;
}

const ExportCenter: React.FC<ExportCenterProps> = ({ token, onClose }) => {
    const [reportType, setReportType] = useState<string>('individual');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<number>(0);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    // Set default date range (current month)
    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
    }, []);

    // Fetch employees
    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/all-users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.error('Failed to fetch employees');
                return;
            }

            const data = await response.json();
            setEmployees(data);
            if (data.length > 0) {
                setSelectedEmployee(data[0].id);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const handleExportIndividual = async () => {
        if (!selectedEmployee || !startDate || !endDate) {
            setMessage('❌ Please fill all fields');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/admin/export/individual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: selectedEmployee,
                    startDate,
                    endDate
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'report.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

                setMessage('✅ Report downloaded successfully!');
            } else {
                const error = await response.json();
                setMessage(`❌ Error: ${error.error}`);
            }
        } catch (error: any) {
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExportBulk = async () => {
        if (!startDate || !endDate) {
            setMessage('❌ Please fill all fields');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/admin/export/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ startDate, endDate })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'bulk_report.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setMessage('✅ Bulk report downloaded successfully!');
            } else {
                const error = await response.json();
                setMessage(`❌ Error: ${error.error}`);
            }
        } catch (error: any) {
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExportMonthlySummary = async () => {
        setLoading(true);
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/admin/export/monthly-summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ year: selectedYear, month: selectedMonth })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'monthly_summary.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setMessage('✅ Monthly summary downloaded successfully!');
            } else {
                const error = await response.json();
                setMessage(`❌ Error: ${error.error}`);
            }
        } catch (error: any) {
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content export-center-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📊 EXPORT CENTER</h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                <div className="export-center-body">
                    <div className="export-type-selector">
                        <label>📋 Report Type:</label>
                        <div className="report-types">
                            <button
                                className={`report-type-btn ${reportType === 'individual' ? 'active' : ''}`}
                                onClick={() => setReportType('individual')}
                            >
                                Individual Employee
                            </button>
                            <button
                                className={`report-type-btn ${reportType === 'bulk' ? 'active' : ''}`}
                                onClick={() => setReportType('bulk')}
                            >
                                Bulk Export
                            </button>
                            <button
                                className={`report-type-btn ${reportType === 'monthly' ? 'active' : ''}`}
                                onClick={() => setReportType('monthly')}
                            >
                                Monthly Summary
                            </button>
                        </div>
                    </div>

                    {reportType === 'individual' && (
                        <div className="export-form">
                            <div className="form-group">
                                <label>👤 Select Employee:</label>
                                <select
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(parseInt(e.target.value))}
                                    className="export-select"
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name} ({emp.employee_id}) - {emp.department || 'No Dept'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>📅 Date Range:</label>
                                <div className="date-range">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="export-input"
                                    />
                                    <span>to</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="export-input"
                                    />
                                </div>
                            </div>

                            <div className="export-actions">
                                <button
                                    onClick={handleExportIndividual}
                                    disabled={loading}
                                    className="btn-export"
                                >
                                    {loading ? '⏳ Generating...' : '📥 EXPORT TO EXCEL'}
                                </button>
                            </div>

                            {message && (
                                <div className={`export-message ${message.includes('✅') ? 'success' : 'error'}`}>
                                    {message}
                                </div>
                            )}
                        </div>
                    )}

                    {reportType === 'bulk' && (
                        <div className="export-form">
                            <div className="form-group">
                                <label>📅 Date Range:</label>
                                <div className="date-range">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="export-input"
                                    />
                                    <span>to</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="export-input"
                                    />
                                </div>
                            </div>

                            <div className="export-actions">
                                <button
                                    onClick={handleExportBulk}
                                    disabled={loading}
                                    className="btn-export"
                                >
                                    {loading ? '⏳ Generating...' : '📥 EXPORT ALL EMPLOYEES'}
                                </button>
                            </div>

                            {message && (
                                <div className={`export-message ${message.includes('✅') ? 'success' : 'error'}`}>
                                    {message}
                                </div>
                            )}
                        </div>
                    )}

                    {reportType === 'monthly' && (
                        <div className="export-form">
                            <div className="form-group">
                                <label>📅 Select Month:</label>
                                <div className="date-range">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                        className="export-select"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                            <option key={month} value={month}>
                                                {new Date(2024, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        className="export-select"
                                    >
                                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="export-actions">
                                <button
                                    onClick={handleExportMonthlySummary}
                                    disabled={loading}
                                    className="btn-export"
                                >
                                    {loading ? '⏳ Generating...' : '📥 EXPORT MONTHLY SUMMARY'}
                                </button>
                            </div>

                            {message && (
                                <div className={`export-message ${message.includes('✅') ? 'success' : 'error'}`}>
                                    {message}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="export-info">
                        {reportType === 'individual' && (
                            <>
                                <h4>📊 Individual Employee Report Includes:</h4>
                                <ul>
                                    <li>✅ Employee profile & details</li>
                                    <li>✅ Daily attendance breakdown</li>
                                    <li>✅ Summary statistics</li>
                                    <li>✅ Hours & punctuality score</li>
                                    <li>✅ Orange-themed formatting</li>
                                </ul>
                            </>
                        )}
                        {reportType === 'bulk' && (
                            <>
                                <h4>📊 Bulk Export Includes:</h4>
                                <ul>
                                    <li>✅ Summary sheet with all employees</li>
                                    <li>✅ Individual sheet per employee</li>
                                    <li>✅ Complete attendance breakdown</li>
                                    <li>✅ Orange-themed formatting</li>
                                </ul>
                            </>
                        )}
                        {reportType === 'monthly' && (
                            <>
                                <h4>📊 Monthly Summary Includes:</h4>
                                <ul>
                                    <li>✅ Matrix view (employees × days)</li>
                                    <li>✅ Color-coded attendance status</li>
                                    <li>✅ Statistics per employee</li>
                                    <li>✅ Legend with status codes</li>
                                    <li>✅ Orange-themed formatting</li>
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ExportCenter;
