import React, { useEffect, useState } from 'react';

interface PendingApprovalProps {
    user: {
        full_name: string;
        email: string;
        employee_id: string;
        avatar_url?: string;
    };
    onLogout: () => void;
}

const PendingApproval: React.FC<PendingApprovalProps> = ({ user, onLogout }) => {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="pending-approval-container">
            <div className="pixel-bg"></div>

            <div className="pending-approval-card">
                <div className="pending-icon-container">
                    <div className="pending-icon">⏳</div>
                    <div className="loading-dots">{dots}</div>
                </div>

                <h1 className="pending-title">WAITING FOR APPROVAL</h1>

                <div className="status-bar">
                    <div className="status-bar-fill"></div>
                </div>

                <p className="pending-message">
                    Your account is being reviewed by the administrator.
                    <br />
                    This usually takes a few minutes.
                </p>

                <div className="user-info-box">
                    {user.avatar_url && (
                        <div className="avatar-container">
                            <img
                                src={user.avatar_url}
                                alt={user.full_name}
                                className="user-avatar"
                            />
                            <div className="avatar-glow"></div>
                        </div>
                    )}

                    <div className="info-grid">
                        <div className="info-row">
                            <span className="info-label">👤 NAME</span>
                            <span className="info-value">{user.full_name}</span>
                        </div>

                        <div className="info-row">
                            <span className="info-label">📧 EMAIL</span>
                            <span className="info-value">{user.email}</span>
                        </div>

                        <div className="info-row">
                            <span className="info-label">🆔 EMPLOYEE ID</span>
                            <span className="info-value glow-text">{user.employee_id}</span>
                        </div>
                    </div>
                </div>

                <div className="pending-steps">
                    <div className="step complete">
                        <div className="step-icon">✓</div>
                        <div className="step-text">Account Created</div>
                    </div>
                    <div className="step-connector active"></div>
                    <div className="step active">
                        <div className="step-icon pulse">⏳</div>
                        <div className="step-text">Admin Review</div>
                    </div>
                    <div className="step-connector"></div>
                    <div className="step">
                        <div className="step-icon">🚀</div>
                        <div className="step-text">Access Granted</div>
                    </div>
                </div>

                <div className="pending-note">
                    <div className="note-icon">💡</div>
                    <p>We'll send you an email once your account is approved!</p>
                    <p>You can safely close this page and check back later.</p>
                </div>

                <button
                    onClick={onLogout}
                    className="btn-logout-pending"
                >
                    ← LOGOUT
                </button>
            </div>
        </div>
    );
};

export default PendingApproval;
