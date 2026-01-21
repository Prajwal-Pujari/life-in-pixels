import React, { useState, useEffect } from 'react';

interface PendingUser {
    id: number;
    full_name: string;
    username: string;
    email: string;
    employee_id: string;
    avatar_url?: string;
    created_at: string;
}

interface UserApprovalProps {
    token: string;
}

const UserApproval: React.FC<UserApprovalProps> = ({ token }) => {
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [departments, setDepartments] = useState<string[]>(['Engineering', 'HR', 'Sales', 'Marketing', 'Operations', 'Finance']);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [approvingUserId, setApprovingUserId] = useState<number | null>(null);
    const [selectedRole, setSelectedRole] = useState<'admin' | 'employee'>('employee');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [newDepartment, setNewDepartment] = useState('');
    const [showDepartmentInput, setShowDepartmentInput] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    useEffect(() => {
        loadPendingUsers();
    }, []);

    const loadPendingUsers = async () => {
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/admin/pending-users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load pending users');
            }

            const data = await response.json();
            setPendingUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartApproval = (userId: number) => {
        setApprovingUserId(userId);
        setSelectedRole('employee');
        setSelectedDepartment('');
        setError('');
        setSuccessMessage('');
    };

    const handleAddDepartment = () => {
        if (newDepartment.trim() && !departments.includes(newDepartment.trim())) {
            setDepartments([...departments, newDepartment.trim()]);
            setSelectedDepartment(newDepartment.trim());
            setNewDepartment('');
            setShowDepartmentInput(false);
        }
    };

    const handleApprove = async (userId: number) => {
        if (!selectedDepartment) {
            setError('Please select a department');
            return;
        }

        setError('');
        setSuccessMessage('');

        try {
            const response = await fetch(`${API_URL}/admin/approve-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId,
                    role: selectedRole,
                    department: selectedDepartment
                })
            });

            if (!response.ok) {
                throw new Error('Failed to approve user');
            }

            const data = await response.json();
            setSuccessMessage(`✓ ${data.user.full_name} approved as ${selectedRole} in ${selectedDepartment}`);

            setPendingUsers(prev => prev.filter(u => u.id !== userId));
            setApprovingUserId(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleReject = async (userId: number, userName: string) => {
        if (!confirm(`Are you sure you want to reject ${userName}? This will delete their account.`)) {
            return;
        }

        setError('');
        setSuccessMessage('');

        try {
            const response = await fetch(`${API_URL}/admin/reject-user/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to reject user');
            }

            setSuccessMessage(`✓ ${userName} rejected and removed`);
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
            setApprovingUserId(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (isLoading) {
        return <div className="approval-loading">⏳ Loading pending users...</div>;
    }

    return (
        <div className="user-approval-container">
            <div className="approval-header">
                <h2>👥 PENDING USER APPROVALS</h2>
                <p className="approval-subtitle">
                    {pendingUsers.length} user{pendingUsers.length !== 1 ? 's' : ''} waiting for approval
                </p>
            </div>

            {error && (
                <div className="error-message">⚠️ {error}</div>
            )}

            {successMessage && (
                <div className="success-message">{successMessage}</div>
            )}

            {pendingUsers.length === 0 ? (
                <div className="no-pending-users">
                    <div className="check-icon">✓</div>
                    <p>No pending users</p>
                    <p className="sub-text">All users have been approved or rejected</p>
                </div>
            ) : (
                <div className="pending-users-list">
                    {pendingUsers.map(user => (
                        <div key={user.id} className={`pending-user-card ${approvingUserId === user.id ? 'approving' : ''}`}>
                            <div className="user-card-header">
                                {user.avatar_url && (
                                    <img
                                        src={user.avatar_url}
                                        alt={user.full_name}
                                        className="pending-user-avatar"
                                    />
                                )}
                                <div className="user-card-info">
                                    <h3>{user.full_name}</h3>
                                    <p className="user-email">📧 {user.email}</p>
                                    <p className="user-meta">
                                        <span className="employee-id-badge">{user.employee_id}</span>
                                        <span className="joined-date">
                                            📅 {new Date(user.created_at).toLocaleDateString()}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {approvingUserId === user.id ? (
                                <div className="approval-form">
                                    <div className="form-section">
                                        <label className="form-label">ASSIGN ROLE:</label>
                                        <div className="role-selector">
                                            <button
                                                className={`role-option ${selectedRole === 'employee' ? 'active' : ''}`}
                                                onClick={() => setSelectedRole('employee')}
                                            >
                                                👤 EMPLOYEE
                                            </button>
                                            <button
                                                className={`role-option ${selectedRole === 'admin' ? 'active' : ''}`}
                                                onClick={() => setSelectedRole('admin')}
                                            >
                                                👑 ADMIN
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-section">
                                        <label className="form-label">DEPARTMENT:</label>
                                        <select
                                            value={selectedDepartment}
                                            onChange={(e) => setSelectedDepartment(e.target.value)}
                                            className="department-select"
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(dept => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </select>

                                        {showDepartmentInput ? (
                                            <div className="new-dept-input">
                                                <input
                                                    type="text"
                                                    value={newDepartment}
                                                    onChange={(e) => setNewDepartment(e.target.value)}
                                                    placeholder="New department name..."
                                                    className="dept-input"
                                                />
                                                <button onClick={handleAddDepartment} className="btn-add-dept">ADD</button>
                                                <button onClick={() => {
                                                    setShowDepartmentInput(false);
                                                    setNewDepartment('');
                                                }} className="btn-cancel-dept">✕</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowDepartmentInput(true)}
                                                className="btn-new-department"
                                            >
                                                + NEW DEPARTMENT
                                            </button>
                                        )}
                                    </div>

                                    <div className="approval-actions">
                                        <button
                                            onClick={() => handleApprove(user.id)}
                                            className="btn-confirm-approve"
                                            disabled={!selectedDepartment}
                                        >
                                            ✓ CONFIRM APPROVAL
                                        </button>
                                        <button
                                            onClick={() => setApprovingUserId(null)}
                                            className="btn-cancel-approval"
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="user-card-actions">
                                    <button
                                        onClick={() => handleStartApproval(user.id)}
                                        className="btn-approve"
                                    >
                                        ✓ APPROVE
                                    </button>
                                    <button
                                        onClick={() => handleReject(user.id, user.full_name)}
                                        className="btn-reject"
                                    >
                                        ✗ REJECT
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserApproval;
