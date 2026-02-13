import React, { useState, useEffect } from 'react';

interface User {
    id: number;
    username: string;
    email: string;
    fullName: string;
    role: string;
    employeeId: string;
    department: string;
    isActive: boolean;
    telegramId?: number | null;
    joiningDate?: string | null;
}

interface UserManagementProps {
    token: string;
    onClose: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ token, onClose }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingTelegramId, setEditingTelegramId] = useState<number | null>(null);
    const [telegramIdInput, setTelegramIdInput] = useState('');
    const [editingDepartment, setEditingDepartment] = useState<number | null>(null);
    const [departmentInput, setDepartmentInput] = useState('');
    const [editingJoiningDate, setEditingJoiningDate] = useState<number | null>(null);
    const [joiningDateInput, setJoiningDateInput] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        fullName: '',
        role: 'employee',
        employeeId: '',
        department: ''
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch users');

            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`${API_URL}/admin/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create user');
            }

            setSuccess(`User "${formData.username}" created successfully!`);
            setShowCreateForm(false);
            setFormData({
                username: '',
                password: '',
                email: '',
                fullName: '',
                role: 'employee',
                employeeId: '',
                department: ''
            });
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeactivate = async (userId: number) => {
        if (!confirm('Are you sure you want to deactivate this user?')) return;

        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/deactivate`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to deactivate user');

            setSuccess('User deactivated successfully');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleUpdateTelegramId = async (userId: number) => {
        const telegramId = telegramIdInput ? parseInt(telegramIdInput) : null;

        if (telegramIdInput && (isNaN(Number(telegramIdInput)) || Number(telegramIdInput) <= 0)) {
            setError('Invalid Telegram ID. Must be a positive number.');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/telegram`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ telegramId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update Telegram ID');
            }

            setSuccess('Telegram ID updated successfully');
            setEditingTelegramId(null);
            setTelegramIdInput('');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleUpdateDepartment = async (userId: number) => {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/department`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ department: departmentInput || null })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update department');
            }

            setSuccess('Department updated successfully');
            setEditingDepartment(null);
            setDepartmentInput('');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleUpdateJoiningDate = async (userId: number) => {
        try {
            const response = await fetch(`${API_URL}/salary/joining-date/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ joining_date: joiningDateInput || null })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update joining date');
            }

            setSuccess('Joining date updated successfully');
            setEditingJoiningDate(null);
            setJoiningDateInput('');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-IN');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content user-management-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2> USER MANAGEMENT</h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message">⚠️ {error}</div>}
                    {success && <div className="success-message">✅ {success}</div>}

                    <div className="user-management-actions">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="btn-create-user"
                        >
                            {showCreateForm ? '❌ CANCEL' : '➕ CREATE NEW USER'}
                        </button>
                    </div>

                    {showCreateForm && (
                        <form onSubmit={handleSubmit} className="create-user-form">
                            <h3>CREATE NEW EMPLOYEE</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">USERNAME *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        required
                                        placeholder="john.doe"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">PASSWORD *</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        placeholder="Minimum 6 characters"
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">FULL NAME *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        required
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">EMAIL *</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        placeholder="john@company.com"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">EMPLOYEE ID *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.employeeId}
                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        required
                                        placeholder="EMP001"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">DEPARTMENT</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="Engineering"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">ROLE</label>
                                <select
                                    className="form-input"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="employee">Employee</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-submit" disabled={isLoading}>
                                    {isLoading ? 'CREATING...' : '✅ CREATE USER'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="users-list">
                        <h3>ALL USERS ({users.length})</h3>
                        <div className="users-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Employee ID</th>
                                        <th>Name</th>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Department</th>
                                        <th>Joining Date</th>
                                        <th>Telegram ID</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className={!user.isActive ? 'inactive-user' : ''}>
                                            <td>{user.employeeId}</td>
                                            <td>{user.fullName}</td>
                                            <td>{user.username}</td>
                                            <td>{user.email}</td>
                                            <td>
                                                {editingDepartment === user.id ? (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <select
                                                            value={departmentInput}
                                                            onChange={(e) => setDepartmentInput(e.target.value)}
                                                            style={{
                                                                width: '140px',
                                                                padding: '6px',
                                                                fontSize: '11px',
                                                                fontFamily: 'Press Start 2P, monospace',
                                                                background: 'var(--bg-primary)',
                                                                border: '2px solid var(--border)',
                                                                color: 'var(--text-primary)',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <option value="">- None -</option>
                                                            <option value="Software">Software</option>
                                                            <option value="Data">Data</option>
                                                            <option value="Calibration">Calibration</option>
                                                        </select>
                                                        <button
                                                            onClick={() => handleUpdateDepartment(user.id)}
                                                            style={{
                                                                padding: '6px 10px',
                                                                fontSize: '11px',
                                                                background: 'var(--success-green)',
                                                                color: 'white',
                                                                border: '2px solid var(--border)',
                                                                cursor: 'pointer',
                                                                fontFamily: 'Press Start 2P, monospace',
                                                                boxShadow: '0 2px 0 var(--border)'
                                                            }}
                                                        >
                                                            ✔
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditingDepartment(null); setDepartmentInput(''); }}
                                                            style={{
                                                                padding: '6px 10px',
                                                                fontSize: '11px',
                                                                background: '#ff6b6b',
                                                                color: 'white',
                                                                border: '2px solid var(--border)',
                                                                cursor: 'pointer',
                                                                fontFamily: 'Press Start 2P, monospace',
                                                                boxShadow: '0 2px 0 var(--border)'
                                                            }}
                                                        >
                                                            ✖
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <span style={{
                                                            fontFamily: 'Courier New, monospace',
                                                            fontSize: '12px',
                                                            color: user.department ? 'var(--text-primary)' : 'var(--text-muted)'
                                                        }}>
                                                            {user.department || '-'}
                                                        </span>
                                                        <button
                                                            onClick={() => { setEditingDepartment(user.id); setDepartmentInput(user.department || ''); }}
                                                            style={{
                                                                padding: '4px 8px',
                                                                fontSize: '10px',
                                                                background: '#FF9800',
                                                                color: 'white',
                                                                border: '2px solid var(--border)',
                                                                cursor: 'pointer',
                                                                fontFamily: 'Press Start 2P, monospace',
                                                                boxShadow: '0 2px 0 var(--border)'
                                                            }}
                                                            title="Edit Department"
                                                        >
                                                            ✏️
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {editingJoiningDate === user.id ? (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <input
                                                            type="date"
                                                            value={joiningDateInput}
                                                            onChange={(e) => setJoiningDateInput(e.target.value)}
                                                            style={{
                                                                width: '130px',
                                                                padding: '6px',
                                                                fontSize: '11px',
                                                                fontFamily: 'Courier New, monospace',
                                                                background: 'var(--bg-primary)',
                                                                border: '2px solid var(--border)',
                                                                color: 'var(--text-primary)'
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => handleUpdateJoiningDate(user.id)}
                                                            style={{
                                                                padding: '6px 10px',
                                                                fontSize: '11px',
                                                                background: 'var(--success-green)',
                                                                color: 'white',
                                                                border: '2px solid var(--border)',
                                                                cursor: 'pointer',
                                                                fontFamily: 'Press Start 2P, monospace',
                                                                boxShadow: '0 2px 0 var(--border)'
                                                            }}
                                                        >
                                                            ✔
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditingJoiningDate(null); setJoiningDateInput(''); }}
                                                            style={{
                                                                padding: '6px 10px',
                                                                fontSize: '11px',
                                                                background: '#ff6b6b',
                                                                color: 'white',
                                                                border: '2px solid var(--border)',
                                                                cursor: 'pointer',
                                                                fontFamily: 'Press Start 2P, monospace',
                                                                boxShadow: '0 2px 0 var(--border)'
                                                            }}
                                                        >
                                                            ✖
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <span style={{
                                                            fontFamily: 'Courier New, monospace',
                                                            fontSize: '12px',
                                                            color: user.joiningDate ? 'var(--text-primary)' : 'var(--text-muted)'
                                                        }}>
                                                            {formatDate(user.joiningDate)}
                                                        </span>
                                                        <button
                                                            onClick={() => { setEditingJoiningDate(user.id); setJoiningDateInput(user.joiningDate?.split('T')[0] || ''); }}
                                                            style={{
                                                                padding: '4px 8px',
                                                                fontSize: '10px',
                                                                background: '#9C27B0',
                                                                color: 'white',
                                                                border: '2px solid var(--border)',
                                                                cursor: 'pointer',
                                                                fontFamily: 'Press Start 2P, monospace',
                                                                boxShadow: '0 2px 0 var(--border)'
                                                            }}
                                                            title="Edit Joining Date"
                                                        >
                                                            📅
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {editingTelegramId === user.id ? (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <input
                                                            type="text"
                                                            value={telegramIdInput}
                                                            onChange={(e) => setTelegramIdInput(e.target.value)}
                                                            placeholder="Telegram ID"
                                                            style={{ width: '120px', padding: '4px', fontSize: '11px' }}
                                                        />
                                                        <button
                                                            onClick={() => handleUpdateTelegramId(user.id)}
                                                            style={{ padding: '4px 8px', fontSize: '10px', background: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            ✔
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditingTelegramId(null); setTelegramIdInput(''); }}
                                                            style={{ padding: '4px 8px', fontSize: '10px', background: '#f44336', color: 'white', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            ✖
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <span>{user.telegramId || '-'}</span>
                                                        <button
                                                            onClick={() => { setEditingTelegramId(user.id); setTelegramIdInput(user.telegramId?.toString() || ''); }}
                                                            style={{ padding: '2px 6px', fontSize: '10px', background: '#FF9800', color: 'white', border: 'none', cursor: 'pointer' }}
                                                            title="Edit Telegram ID"
                                                        >
                                                            ✏️
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`role-badge role-${user.role}`}>
                                                    {user.role.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                                                    {user.isActive ? '✅ ACTIVE' : '❌ INACTIVE'}
                                                </span>
                                            </td>
                                            <td>
                                                {user.isActive && (
                                                    <button
                                                        onClick={() => handleDeactivate(user.id)}
                                                        className="btn-deactivate"
                                                    >
                                                        DEACTIVATE
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
