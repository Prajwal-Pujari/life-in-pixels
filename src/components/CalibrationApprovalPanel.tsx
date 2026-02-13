import React, { useState, useEffect } from 'react';
import '../calibration-styles.css';

interface PendingApproval {
    id: number;
    user_id: number;
    full_name: string;
    employee_id: string;
    visit_date: string;
    location: string;
    company_name: string;
    num_gauges: number;
    visit_summary: string;
    conclusion: string;
    submitted_at: string;
    total_expenses: number;
    expense_count: number;
}

const CalibrationApprovalPanel: React.FC = () => {
    const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
    const [selectedApproval, setSelectedApproval] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectDialog, setShowRejectDialog] = useState<number | null>(null);

    useEffect(() => {
        loadPendingApprovals();
    }, []);

    const loadPendingApprovals = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');

        try {
            const res = await fetch('/api/admin/calibration/pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setPendingApprovals(data);
            } else {
                setError('Failed to load pending approvals');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: number, fullName: string, amount: number) => {
        if (!window.confirm(`Approve expense of ₹${amount.toFixed(2)} for ${fullName}?`)) {
            return;
        }

        const token = localStorage.getItem('token');

        try {
            const res = await fetch(`/api/admin/calibration/approve/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                alert('Expense approved successfully!');
                loadPendingApprovals();
            } else {
                const data = await res.json();
                alert(`Failed to approve: ${data.error}`);
            }
        } catch (err) {
            alert('Network error');
        }
    };

    const handleReject = async (id: number) => {
        if (!rejectionReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        const token = localStorage.getItem('token');

        try {
            const res = await fetch(`/api/admin/calibration/reject/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason: rejectionReason })
            });

            if (res.ok) {
                alert('Expense rejected');
                setShowRejectDialog(null);
                setRejectionReason('');
                loadPendingApprovals();
            } else {
                const data = await res.json();
                alert(`Failed to reject: ${data.error}`);
            }
        } catch (err) {
            alert('Network error');
        }
    };

    const toggleDetails = (id: number) => {
        setSelectedApproval(selectedApproval === id ? null : id);
    };

    const calculateTotalPending = (): number => {
        return pendingApprovals.reduce((sum, approval) => sum + parseFloat(approval.total_expenses.toString()), 0);
    };

    if (loading) {
        return <div className="loading">Loading pending approvals...</div>;
    }

    return (
        <div className="calibration-approval-panel">
            <div className="panel-header">
                <h2>🔧 Calibration Expense Approvals</h2>
                <div className="stats">
                    <div className="stat-badge">
                        <span className="stat-label">Pending:</span>
                        <span className="stat-value">{pendingApprovals.length}</span>
                    </div>
                    <div className="stat-badge">
                        <span className="stat-label">Total Amount:</span>
                        <span className="stat-value">₹{calculateTotalPending().toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {error && <div className="error-message">⚠️ {error}</div>}

            {pendingApprovals.length === 0 ? (
                <div className="empty-state">
                    <p>✅ No pending expense approvals</p>
                </div>
            ) : (
                <div className="approvals-list">
                    {pendingApprovals.map((approval) => (
                        <div key={approval.id} className="approval-card">
                            <div className="approval-summary" onClick={() => toggleDetails(approval.id)}>
                                <div className="approval-info">
                                    <h3>{approval.full_name}</h3>
                                    <p className="approval-meta">
                                        <span>📅 {new Date(approval.visit_date).toLocaleDateString()}</span>
                                        <span>📍 {approval.location}</span>
                                        <span>🏢 {approval.company_name}</span>
                                    </p>
                                    <p className="approval-gauges">
                                        ⚙️ {approval.num_gauges} gauges • {approval.expense_count} expense items
                                    </p>
                                </div>
                                <div className="approval-amount">
                                    <div className="amount-label">Total</div>
                                    <div className="amount-value">₹{parseFloat(approval.total_expenses.toString()).toFixed(2)}</div>
                                </div>
                                <div className="expand-icon">
                                    {selectedApproval === approval.id ? '▼' : '▶'}
                                </div>
                            </div>

                            {selectedApproval === approval.id && (
                                <div className="approval-details">
                                    <div className="detail-section">
                                        <h4>Visit Summary</h4>
                                        <p>{approval.visit_summary || 'No summary provided'}</p>
                                    </div>

                                    <div className="detail-section">
                                        <h4>Conclusion</h4>
                                        <p>{approval.conclusion || 'No conclusion provided'}</p>
                                    </div>

                                    <div className="detail-section">
                                        <p className="submitted-info">
                                            Submitted: {new Date(approval.submitted_at).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className="approval-actions">
                                        <button
                                            className="btn-approve"
                                            onClick={() => handleApprove(
                                                approval.id,
                                                approval.full_name,
                                                parseFloat(approval.total_expenses.toString())
                                            )}
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            className="btn-reject"
                                            onClick={() => {
                                                setShowRejectDialog(approval.id);
                                                setRejectionReason('');
                                            }}
                                        >
                                            ✕ Reject
                                        </button>
                                    </div>
                                </div>
                            )}

                            {showRejectDialog === approval.id && (
                                <div className="reject-dialog">
                                    <h4>Rejection Reason</h4>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Enter reason for rejecting this expense claim..."
                                        rows={3}
                                    />
                                    <div className="dialog-actions">
                                        <button
                                            className="btn-submit-reject"
                                            onClick={() => handleReject(approval.id)}
                                        >
                                            Submit Rejection
                                        </button>
                                        <button
                                            className="btn-cancel-reject"
                                            onClick={() => {
                                                setShowRejectDialog(null);
                                                setRejectionReason('');
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CalibrationApprovalPanel;
