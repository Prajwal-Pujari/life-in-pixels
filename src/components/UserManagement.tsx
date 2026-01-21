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
                                            <td>{user.department || '-'}</td>
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
