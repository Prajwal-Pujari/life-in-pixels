import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import UserManagement from '../components/UserManagement';
import HolidayManagement from '../components/HolidayManagement';
import UserApproval from '../components/UserApproval';
import ExportCenter from '../components/ExportCenter';

interface AdminPageProps {
    token: string;
    user: any;
    onLogout: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ token, user, onLogout }) => {
    const [showUserManagement, setShowUserManagement] = useState(false);
    const [showHolidayManagement, setShowHolidayManagement] = useState(false);
    const [showUserApproval, setShowUserApproval] = useState(false);
    const [showExportCenter, setShowExportCenter] = useState(false);
    const [viewingUserId, setViewingUserId] = useState<number | null>(null);
    const [sendingTelegram, setSendingTelegram] = useState(false);
    const [telegramMessage, setTelegramMessage] = useState('');
    const navigate = useNavigate();

    const handleViewEmployee = (userId: number) => {
        navigate(`/calendar?userId=${userId}`);
    };

    const handleSendTelegramReport = async () => {
        setSendingTelegram(true);
        setTelegramMessage('');

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_URL}/admin/telegram-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });

            const data = await response.json();

            if (response.ok) {
                setTelegramMessage('✅ Report sent to Telegram successfully!');
                setTimeout(() => setTelegramMessage(''), 5000);
            } else {
                setTelegramMessage(`❌ Error: ${data.error || 'Failed to send report'}`);
            }
        } catch (error: any) {
            setTelegramMessage(`❌ Error: ${error.message}`);
        } finally {
            setSendingTelegram(false);
        }
    };

    return (
        <div className="app">
            <div className="app-header">
                <div className="user-info">
                    <div className="user-name">{user.fullName}</div>
                    <div className="user-role">👑 ADMIN</div>
                </div>

                <div className="header-actions">
                    <button
                        className="btn-back-admin"
                        onClick={() => navigate('/calendar')}
                    >
                        📅 CALENDAR
                    </button>
                    <button
                        className="btn-admin-dashboard"
                        onClick={() => setShowUserManagement(true)}
                    >
                        <span className="btn-emoji">👥</span>
                        USER MANAGEMENT
                    </button>
                    <button
                        className="btn-admin-dashboard"
                        onClick={() => setShowUserApproval(true)}
                    >
                        <span className="btn-emoji">⏳</span>
                        PENDING APPROVALS
                    </button>
                    <button
                        className="btn-admin-dashboard"
                        onClick={() => setShowHolidayManagement(true)}
                    >
                        <span className="btn-emoji">🎉</span>
                        HOLIDAYS
                    </button>
                    <button
                        className="btn-admin-dashboard telegram-btn"
                        onClick={handleSendTelegramReport}
                        disabled={sendingTelegram}
                    >
                        <span className="btn-emoji">📱</span>
                        {sendingTelegram ? 'SENDING...' : 'TELEGRAM REPORT'}
                    </button>
                    <button
                        className="btn-admin-dashboard"
                        onClick={() => setShowExportCenter(true)}
                    >
                        <span className="btn-emoji">📊</span>
                        EXPORT DATA
                    </button>
                    <button className="btn-logout" onClick={onLogout}>
                        LOGOUT
                    </button>
                </div>
            </div>

            {telegramMessage && (
                <div className={`telegram-notification ${telegramMessage.includes('✅') ? 'success' : 'error'}`}>
                    {telegramMessage}
                </div>
            )}

            <div className="admin-content">
                <AdminDashboard
                    onViewEmployee={handleViewEmployee}
                    onManageHolidays={() => setShowHolidayManagement(true)}
                />
            </div>

            {showHolidayManagement && (
                <HolidayManagement
                    isOpen={showHolidayManagement}
                    onClose={() => setShowHolidayManagement(false)}
                    token={token}
                />
            )}

            {showUserManagement && (
                <UserManagement
                    token={token}
                    onClose={() => setShowUserManagement(false)}
                />
            )}

            {showUserApproval && (
                <div className="modal-overlay" onClick={() => setShowUserApproval(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowUserApproval(false)}>✕</button>
                        <UserApproval token={token} />
                    </div>
                </div>
            )}

            {showExportCenter && (
                <ExportCenter
                    token={token}
                    onClose={() => setShowExportCenter(false)}
                />
            )}
        </div>
    );
};

export default AdminPage;
