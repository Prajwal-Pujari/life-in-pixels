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
                                className="report-type-btn disabled"
                                disabled
                                title="Coming soon!"
                            >
                                Bulk Export
                            </button>
                            <button
                                className="report-type-btn disabled"
                                disabled
                                title="Coming soon!"
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

                    <div className="export-info">
                        <h4>📊 Individual Employee Report Includes:</h4>
                        <ul>
                            <li>✅ Employee profile & details</li>
                            <li>✅ Daily attendance breakdown</li>
                            <li>✅ Summary statistics (Present, WFH, Leave, Absent)</li>
                            <li>✅ Average hours & total hours worked</li>
                            <li>✅ Punctuality score</li>
                            <li>✅ Color-coded status cells</li>
                            <li>✅ Professional Excel formatting</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ExportCenter;
