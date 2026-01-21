import React, { useState, useEffect } from 'react';

interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: { year: number; month: number; day: number } | null;
    token: string;
    userRole: 'admin' | 'employee';
    userId?: number;
}

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'wfh' | 'on_leave';

interface AttendanceData {
    id?: number;
    status: AttendanceStatus;
    check_in_time: string;
    check_out_time: string;
    total_hours: number | null;
    notes: string;
    marked_by_admin: boolean;
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({
    isOpen,
    onClose,
    date,
    token,
    userRole,
    userId
}) => {
    const [attendance, setAttendance] = useState<AttendanceData>({
        status: 'present',
        check_in_time: '09:30',
        check_out_time: '18:00',
        total_hours: null,
        notes: '',
        marked_by_admin: false
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [existingAttendance, setExistingAttendance] = useState<AttendanceData | null>(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    useEffect(() => {
        if (isOpen && date) {
            loadExistingAttendance();
        }
    }, [isOpen, date]);

    const loadExistingAttendance = async () => {
        if (!date) return;

        try {
            const dateStr = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
            const response = await fetch(`${API_URL}/attendance?userId=${userId || ''}&month=${date.year}-${String(date.month + 1).padStart(2, '0')}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            const existing = data.find((a: any) => a.date.startsWith(dateStr));
            if (existing) {
                setExistingAttendance(existing);
                setAttendance({
                    id: existing.id,
                    status: existing.status,
                    check_in_time: existing.work_hours_start || '09:30',
                    check_out_time: existing.work_hours_end || '18:00',
                    total_hours: null,
                    notes: existing.notes || '',
                    marked_by_admin: false
                });
            } else {
                setExistingAttendance(null);
                setAttendance({
                    status: 'present',
                    check_in_time: getCurrentTime(),
                    check_out_time: '',
                    total_hours: null,
                    notes: '',
                    marked_by_admin: false
                });
            }
        } catch (err) {
            console.error('Error loading attendance:', err);
        }
    };

    const getCurrentTime = () => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };

    const isToday = () => {
        if (!date) return false;
        const today = new Date();
        return date.year === today.getFullYear() &&
            date.month === today.getMonth() &&
            date.day === today.getDate();
    };

    const canEdit = () => {
        if (userRole === 'admin') return true;
        if (existingAttendance) return false; // Employees can't edit once marked
        return isToday(); // Employees can only mark today
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date) return;

        setIsLoading(true);
        setError('');

        try {
            const attendance_date = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;

            const response = await fetch(`${API_URL}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: userId,
                    attendance_date,
                    status: attendance.status,
                    check_in_time: attendance.check_in_time || null,
                    check_out_time: attendance.check_out_time || null,
                    notes: attendance.notes
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to mark attendance');
            }

            onClose();
            window.location.reload(); // Refresh to show updated calendar
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoCapture = (type: 'in' | 'out') => {
        const currentTime = getCurrentTime();
        if (type === 'in') {
            setAttendance({ ...attendance, check_in_time: currentTime });
        } else {
            setAttendance({ ...attendance, check_out_time: currentTime });
        }
    };

    if (!isOpen || !date) return null;

    const dateStr = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    const dateDisplay = new Date(date.year, date.month, date.day).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content attendance-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{existingAttendance ? '✏️ EDIT ATTENDANCE' : '✓ MARK ATTENDANCE'}</h2>
                    <p className="modal-date">{dateDisplay}</p>
                    {!canEdit() && (
                        <div className="permission-notice">
                            {userRole === 'employee' && existingAttendance ?
                                '🔒 Already marked - Contact admin to edit' :
                                '🔒 Employees can only mark today\'s attendance'}
                        </div>
                    )}
                    {attendance.marked_by_admin && (
                        <div className="admin-badge">👑 Edited by Admin</div>
                    )}
                </div>

                {error && (
                    <div className="error-message">⚠️ {error}</div>
                )}

                <form onSubmit={handleSubmit} className="attendance-form">
                    <div className="form-section">
                        <label className="section-label">STATUS</label>
                        <div className="status-options">
                            {(['present', 'absent', 'half_day', 'wfh', 'on_leave'] as AttendanceStatus[]).map(status => (
                                <button
                                    key={status}
                                    type="button"
                                    className={`status-btn ${attendance.status === status ? 'active' : ''}`}
                                    onClick={() => setAttendance({ ...attendance, status })}
                                    disabled={!canEdit()}
                                >
                                    {status === 'present' && '✅ PRESENT'}
                                    {status === 'absent' && '❌ ABSENT'}
                                    {status === 'half_day' && '⏰ HALF DAY'}
                                    {status === 'wfh' && '🏠 WFH'}
                                    {status === 'on_leave' && '🌴 ON LEAVE'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(attendance.status === 'present' || attendance.status === 'half_day' || attendance.status === 'wfh') && (
                        <>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>CHECK-IN TIME</label>
                                    <div className="time-input-group">
                                        <input
                                            type="time"
                                            value={attendance.check_in_time}
                                            onChange={(e) => setAttendance({ ...attendance, check_in_time: e.target.value })}
                                            className="time-input"
                                            disabled={!canEdit()}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAutoCapture('in')}
                                            className="btn-auto-capture"
                                            disabled={!canEdit()}
                                        >
                                            NOW
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>CHECK-OUT TIME</label>
                                    <div className="time-input-group">
                                        <input
                                            type="time"
                                            value={attendance.check_out_time}
                                            onChange={(e) => setAttendance({ ...attendance, check_out_time: e.target.value })}
                                            className="time-input"
                                            disabled={!canEdit()}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAutoCapture('out')}
                                            className="btn-auto-capture"
                                            disabled={!canEdit()}
                                        >
                                            NOW
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {attendance.total_hours !== null && (
                                <div className="hours-display">
                                    ⏱️ Total Hours: <strong>{attendance.total_hours.toFixed(2)}h</strong>
                                </div>
                            )}
                        </>
                    )}

                    <div className="form-group">
                        <label>NOTES (OPTIONAL)</label>
                        <textarea
                            value={attendance.notes}
                            onChange={(e) => setAttendance({ ...attendance, notes: e.target.value })}
                            placeholder="Reason for late arrival, work summary, etc..."
                            rows={3}
                            className="notes-textarea"
                            disabled={!canEdit()}
                        />
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-cancel"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={isLoading || !canEdit()}
                        >
                            {isLoading ? 'SAVING...' : (existingAttendance ? 'UPDATE' : 'MARK PRESENT')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AttendanceModal;
