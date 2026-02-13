import React, { useState, useEffect } from 'react';
import './SalaryManagement.css';

interface User {
    id: number;
    full_name: string;
    employee_id: string;
    department: string;
    joining_date: string | null;
    total_payments: number;
    total_amount_paid: number;
}

interface Payment {
    id: number;
    amount: number;
    payment_date: string;
    payment_type: string;
    payment_month: string;
    notes: string;
    created_at: string;
}

interface SalaryManagementProps {
    token: string;
    onClose: () => void;
}

const SalaryManagement: React.FC<SalaryManagementProps> = ({ token, onClose }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'salary',
        payment_month: new Date().toISOString().slice(0, 7),
        notes: ''
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/salary/summary/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch users');
            }
            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserPayments = async (userId: number) => {
        setError('');
        try {
            const response = await fetch(`${API_URL}/salary/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch payments');
            }
            const data = await response.json();
            setPayments(data.payments);
        } catch (err: any) {
            setError(err.message);
            setPayments([]);
        }
    };

    const handleSelectUser = (user: User) => {
        setSelectedUser(user);
        fetchUserPayments(user.id);
        setShowAddForm(false);
        setError('');
        setSuccess('');
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/salary/${selectedUser.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: parseFloat(formData.amount),
                    payment_date: formData.payment_date,
                    payment_type: formData.payment_type,
                    payment_month: formData.payment_month,
                    notes: formData.notes
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to add payment');

            setSuccess('Payment added successfully!');
            setShowAddForm(false);
            setFormData({
                amount: '',
                payment_date: new Date().toISOString().split('T')[0],
                payment_type: 'salary',
                payment_month: new Date().toISOString().slice(0, 7),
                notes: ''
            });
            fetchUserPayments(selectedUser.id);
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeletePayment = async (paymentId: number) => {
        if (!confirm('Are you sure you want to delete this payment?')) return;
        if (!selectedUser) return;

        try {
            const response = await fetch(`${API_URL}/salary/payment/${paymentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete payment');

            setSuccess('Payment deleted');
            fetchUserPayments(selectedUser.id);
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleExport = async (userId: number) => {
        try {
            const response = await fetch(`${API_URL}/salary/export/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to export');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `salary_${selectedUser?.employee_id || userId}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const getPaymentTypeColor = (type: string) => {
        switch (type) {
            case 'salary': return '#4CAF50';
            case 'bonus': return '#FF9800';
            case 'reimbursement': return '#2196F3';
            case 'advance': return '#9C27B0';
            case 'incentive': return '#E91E63';
            default: return '#607D8B';
        }
    };

    const filteredUsers = users.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="salary-overlay" onClick={onClose}>
            <div className="salary-modal" onClick={(e) => e.stopPropagation()}>
                <div className="salary-header">
                    <div className="salary-title">
                        <span className="salary-icon">💰</span>
                        <h2>SALARY MANAGEMENT</h2>
                    </div>
                    <button onClick={onClose} className="salary-close">✕</button>
                </div>

                {error && <div className="salary-error">⚠️ {error}</div>}
                {success && <div className="salary-success">✅ {success}</div>}

                <div className="salary-content">
                    {/* User List Panel */}
                    <div className="salary-sidebar">
                        <div className="sidebar-header">
                            <h3>EMPLOYEES</h3>
                            <span className="user-count">{users.length}</span>
                        </div>

                        <input
                            type="text"
                            className="salary-search"
                            placeholder="🔍 Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />

                        {isLoading && !selectedUser ? (
                            <div className="salary-loading">Loading...</div>
                        ) : (
                            <div className="user-list">
                                {filteredUsers.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleSelectUser(user)}
                                        className={`user-card ${selectedUser?.id === user.id ? 'selected' : ''}`}
                                    >
                                        <div className="user-avatar">
                                            {user.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="user-info">
                                            <div className="user-name">{user.full_name}</div>
                                            <div className="user-meta">
                                                {user.employee_id} • {user.department || 'N/A'}
                                            </div>
                                        </div>
                                        <div className="user-total">
                                            {formatCurrency(user.total_amount_paid || 0)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Payment Details Panel */}
                    <div className="salary-main">
                        {selectedUser ? (
                            <>
                                {/* Employee Header */}
                                <div className="employee-header">
                                    <div className="employee-info">
                                        <div className="employee-avatar">
                                            {selectedUser.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3>{selectedUser.full_name}</h3>
                                            <div className="employee-meta">
                                                <span className="meta-badge">{selectedUser.employee_id}</span>
                                                <span className="meta-badge">{selectedUser.department || 'N/A'}</span>
                                                {selectedUser.joining_date && (
                                                    <span className="meta-badge joining">
                                                        📅 Joined: {formatDate(selectedUser.joining_date)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="employee-actions">
                                        <button
                                            onClick={() => setShowAddForm(!showAddForm)}
                                            className={`btn-action ${showAddForm ? 'cancel' : 'primary'}`}
                                        >
                                            {showAddForm ? '✕ CANCEL' : '➕ ADD PAYMENT'}
                                        </button>
                                        <button
                                            onClick={() => handleExport(selectedUser.id)}
                                            className="btn-action secondary"
                                        >
                                            📊 EXPORT
                                        </button>
                                    </div>
                                </div>

                                {/* Summary Cards */}
                                <div className="summary-cards">
                                    <div className="summary-card total">
                                        <div className="summary-label">TOTAL PAID</div>
                                        <div className="summary-value">{formatCurrency(selectedUser.total_amount_paid || 0)}</div>
                                    </div>
                                    <div className="summary-card count">
                                        <div className="summary-label">PAYMENTS</div>
                                        <div className="summary-value">{payments.length}</div>
                                    </div>
                                </div>

                                {/* Add Payment Form */}
                                {showAddForm && (
                                    <form onSubmit={handleAddPayment} className="payment-form">
                                        <h4>ADD NEW PAYMENT</h4>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>AMOUNT (₹) *</label>
                                                <input
                                                    type="number"
                                                    value={formData.amount}
                                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                    required
                                                    min="1"
                                                    placeholder="Enter amount"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>TYPE</label>
                                                <select
                                                    value={formData.payment_type}
                                                    onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                                                >
                                                    <option value="salary">💵 Salary</option>
                                                    <option value="bonus">🎁 Bonus</option>
                                                    <option value="reimbursement">💳 Reimbursement</option>
                                                    <option value="advance">📤 Advance</option>
                                                    <option value="incentive">⭐ Incentive</option>
                                                    <option value="other">📦 Other</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>PAYMENT DATE *</label>
                                                <input
                                                    type="date"
                                                    value={formData.payment_date}
                                                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>FOR MONTH</label>
                                                <input
                                                    type="month"
                                                    value={formData.payment_month}
                                                    onChange={(e) => setFormData({ ...formData, payment_month: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group full-width">
                                            <label>NOTES</label>
                                            <input
                                                type="text"
                                                value={formData.notes}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                placeholder="Optional notes..."
                                            />
                                        </div>
                                        <button type="submit" className="btn-submit" disabled={isLoading}>
                                            {isLoading ? '⏳ SAVING...' : '✅ SAVE PAYMENT'}
                                        </button>
                                    </form>
                                )}

                                {/* Payment History */}
                                <div className="payment-history">
                                    <h4>PAYMENT HISTORY</h4>
                                    {payments.length === 0 ? (
                                        <div className="no-payments">
                                            <span className="empty-icon">📭</span>
                                            <p>No payments recorded yet.</p>
                                            <p className="hint">Click "ADD PAYMENT" to record the first payment.</p>
                                        </div>
                                    ) : (
                                        <div className="payments-table">
                                            <div className="table-header">
                                                <div className="th">DATE</div>
                                                <div className="th">TYPE</div>
                                                <div className="th">FOR MONTH</div>
                                                <div className="th amount">AMOUNT</div>
                                                <div className="th">NOTES</div>
                                                <div className="th action">ACTION</div>
                                            </div>
                                            {payments.map(payment => (
                                                <div key={payment.id} className="table-row">
                                                    <div className="td">{formatDate(payment.payment_date)}</div>
                                                    <div className="td">
                                                        <span
                                                            className="type-badge"
                                                            style={{ backgroundColor: getPaymentTypeColor(payment.payment_type) }}
                                                        >
                                                            {payment.payment_type.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="td">{payment.payment_month || '-'}</div>
                                                    <div className="td amount">{formatCurrency(payment.amount)}</div>
                                                    <div className="td notes">{payment.notes || '-'}</div>
                                                    <div className="td action">
                                                        <button
                                                            onClick={() => handleDeletePayment(payment.id)}
                                                            className="btn-delete"
                                                            title="Delete payment"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="no-selection">
                                <span className="select-icon">👈</span>
                                <h3>Select an Employee</h3>
                                <p>Choose an employee from the list to view and manage their salary payments.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalaryManagement;
