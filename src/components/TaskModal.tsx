import React, { useState, useEffect } from 'react';
import '../task-styles.css';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    date?: { year: number; month: number; day: number } | null;
    taskId?: number | null;
    onTaskSaved?: () => void;
    employees?: Array<{ id: number; full_name: string; employee_id: string }>;
}

interface Customer {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    company_name: string;
}

interface TaskFormData {
    title: string;
    description: string;
    assigned_to: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    company_name: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    due_date: string;
    due_time: string;
    reminder_date: string;
    reminder_time: string;
    send_completion_email: boolean;
    resolution_notes: string;
    status: 'open' | 'in_progress' | 'pending' | 'completed' | 'cancelled';
}

const TaskModal: React.FC<TaskModalProps> = ({
    isOpen,
    onClose,
    token,
    date,
    taskId,
    onTaskSaved,
    employees = []
}) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    const initialFormData: TaskFormData = {
        title: '',
        description: '',
        assigned_to: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        company_name: '',
        priority: 'medium',
        category: '',
        due_date: date
            ? `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
            : '',
        due_time: '',
        reminder_date: '',
        reminder_time: '09:00',
        send_completion_email: true,
        resolution_notes: '',
        status: 'open'
    };

    const [formData, setFormData] = useState<TaskFormData>(initialFormData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [driveLink, setDriveLink] = useState('');
    const [attachments, setAttachments] = useState<any[]>([]);

    // Email verification state
    const [verificationSent, setVerificationSent] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (taskId) {
                loadTask(taskId);
            } else {
                setFormData({
                    ...initialFormData,
                    due_date: date
                        ? `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
                        : ''
                });
                setComments([]);
                setAttachments([]);
            }
            loadCustomers();
        }
    }, [isOpen, taskId, date]);

    const loadTask = async (id: number) => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/tasks/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFormData({
                    title: data.title || '',
                    description: data.description || '',
                    assigned_to: data.assigned_to?.toString() || '',
                    customer_name: data.customer_name || '',
                    customer_email: data.customer_email || '',
                    customer_phone: data.customer_phone || '',
                    company_name: data.company_name || '',
                    priority: data.priority || 'medium',
                    category: data.category || '',
                    due_date: data.due_date ? data.due_date.split('T')[0] : '',
                    due_time: data.due_time || '',
                    reminder_date: data.reminder_date ? data.reminder_date.split('T')[0] : '',
                    reminder_time: data.reminder_time || '09:00',
                    send_completion_email: data.send_completion_email !== false,
                    resolution_notes: data.resolution_notes || '',
                    status: data.status || 'open'
                });
                setComments(data.comments || []);
                setAttachments(data.attachments || []);
                if (data.customer_email) setEmailVerified(true);
            }
        } catch (error) {
            console.error('Error loading task:', error);
            setError('Failed to load task');
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        try {
            const response = await fetch(`${API_URL}/tasks/customers/list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setCustomers(data);
            }
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));

        if (name === 'customer_email' && emailVerified) {
            setEmailVerified(false);
            setVerificationSent(false);
        }
    };

    const selectCustomer = (customer: Customer) => {
        setFormData(prev => ({
            ...prev,
            customer_name: customer.customer_name || '',
            customer_email: customer.customer_email || '',
            customer_phone: customer.customer_phone || '',
            company_name: customer.company_name || ''
        }));
        setShowCustomerDropdown(false);
        if (customer.customer_email) setEmailVerified(true);
    };

    const sendVerificationCode = async () => {
        if (!formData.customer_email) {
            setError('Please enter customer email first');
            return;
        }

        try {
            setVerifying(true);
            const response = await fetch(`${API_URL}/tasks/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email: formData.customer_email })
            });

            if (response.ok) {
                setVerificationSent(true);
                setSuccess('Verification code sent to Telegram!');
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to send verification');
            }
        } catch (error) {
            setError('Failed to send verification code');
        } finally {
            setVerifying(false);
        }
    };

    const confirmVerificationCode = async () => {
        if (!verificationCode) {
            setError('Please enter the verification code');
            return;
        }

        try {
            setVerifying(true);
            const response = await fetch(`${API_URL}/tasks/confirm-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    email: formData.customer_email,
                    code: verificationCode
                })
            });

            if (response.ok) {
                setEmailVerified(true);
                setSuccess('Email verified successfully!');
                setVerificationCode('');
            } else {
                const data = await response.json();
                setError(data.error || 'Invalid verification code');
            }
        } catch (error) {
            setError('Failed to verify email');
        } finally {
            setVerifying(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.title.trim()) {
            setError('Task title is required');
            return;
        }

        try {
            setLoading(true);
            const url = taskId ? `${API_URL}/tasks/${taskId}` : `${API_URL}/tasks`;
            const method = taskId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
                    attachments: driveLink ? [{ file_name: 'Drive Link', drive_link: driveLink }] : []
                })
            });

            if (response.ok) {
                setSuccess(taskId ? 'Task updated!' : 'Task created!');
                if (onTaskSaved) onTaskSaved();
                setTimeout(() => onClose(), 1000);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to save task');
            }
        } catch (error) {
            setError('Failed to save task');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (newStatus: string) => {
        if (!taskId) return;

        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: newStatus,
                    resolution_notes: formData.resolution_notes
                })
            });

            if (response.ok) {
                setFormData(prev => ({ ...prev, status: newStatus as any }));
                setSuccess(`Task marked as ${newStatus}`);
                if (onTaskSaved) onTaskSaved();
            }
        } catch (error) {
            setError('Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    const addComment = async () => {
        if (!taskId || !newComment.trim()) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ comment: newComment })
            });

            if (response.ok) {
                const data = await response.json();
                setComments(prev => [...prev, data]);
                setNewComment('');
            }
        } catch (error) {
            setError('Failed to add comment');
        }
    };

    const addDriveLink = async () => {
        if (!taskId || !driveLink.trim()) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/attachments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    file_name: 'Drive Link',
                    drive_link: driveLink
                })
            });

            if (response.ok) {
                const data = await response.json();
                setAttachments(prev => [...prev, data]);
                setDriveLink('');
            }
        } catch (error) {
            setError('Failed to add link');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="task-modal-overlay" onClick={onClose}>
            <div className="task-modal" onClick={e => e.stopPropagation()}>
                <div className="task-modal-header">
                    <h2>{taskId ? 'EDIT TASK' : 'NEW TASK'}</h2>
                    <button className="task-modal-close" onClick={onClose}>×</button>
                </div>

                {error && <div className="task-error">{error}</div>}
                {success && <div className="task-success">{success}</div>}

                <form onSubmit={handleSubmit} className="task-form">
                    <div className="task-form-grid">
                        {/* Left Column - Task Details */}
                        <div className="task-form-column">
                            <div className="task-form-section">
                                <h3>TASK DETAILS</h3>

                                <div className="task-field">
                                    <label>Title *</label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        placeholder="Task title..."
                                        required
                                    />
                                </div>

                                <div className="task-field">
                                    <label>Description</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Task description..."
                                        rows={3}
                                    />
                                </div>

                                <div className="task-field-row">
                                    <div className="task-field">
                                        <label>Priority</label>
                                        <select name="priority" value={formData.priority} onChange={handleChange}>
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>

                                    <div className="task-field">
                                        <label>Category</label>
                                        <input
                                            type="text"
                                            name="category"
                                            value={formData.category}
                                            onChange={handleChange}
                                            placeholder="e.g. Support, Sales"
                                        />
                                    </div>
                                </div>

                                <div className="task-field-row">
                                    <div className="task-field">
                                        <label>Due Date</label>
                                        <input
                                            type="date"
                                            name="due_date"
                                            value={formData.due_date}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="task-field">
                                        <label>Due Time</label>
                                        <input
                                            type="time"
                                            name="due_time"
                                            value={formData.due_time}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="task-field-row">
                                    <div className="task-field">
                                        <label>Reminder Date</label>
                                        <input
                                            type="date"
                                            name="reminder_date"
                                            value={formData.reminder_date}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="task-field">
                                        <label>Reminder Time</label>
                                        <input
                                            type="time"
                                            name="reminder_time"
                                            value={formData.reminder_time}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="task-field">
                                    <label>Assign To</label>
                                    <select name="assigned_to" value={formData.assigned_to} onChange={handleChange}>
                                        <option value="">-- Unassigned --</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.full_name} ({emp.employee_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Customer Details */}
                        <div className="task-form-column">
                            <div className="task-form-section">
                                <h3>CUSTOMER DETAILS</h3>

                                <div className="task-field customer-search">
                                    <label>Select Existing Customer</label>
                                    <button
                                        type="button"
                                        className="task-btn-secondary"
                                        onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                                    >
                                        {showCustomerDropdown ? 'Hide Customers' : 'Choose Existing'}
                                    </button>
                                    {showCustomerDropdown && customers.length > 0 && (
                                        <div className="customer-dropdown">
                                            {customers.map((c, i) => (
                                                <div
                                                    key={i}
                                                    className="customer-option"
                                                    onClick={() => selectCustomer(c)}
                                                >
                                                    <strong>{c.customer_name || 'Unknown'}</strong>
                                                    <span>{c.company_name}</span>
                                                    <span className="customer-email">{c.customer_email}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="task-field">
                                    <label>Customer Name</label>
                                    <input
                                        type="text"
                                        name="customer_name"
                                        value={formData.customer_name}
                                        onChange={handleChange}
                                        placeholder="Customer name..."
                                    />
                                </div>

                                <div className="task-field">
                                    <label>Company</label>
                                    <input
                                        type="text"
                                        name="company_name"
                                        value={formData.company_name}
                                        onChange={handleChange}
                                        placeholder="Company name..."
                                    />
                                </div>

                                <div className="task-field">
                                    <label>
                                        Email
                                        {emailVerified && <span className="verified-badge">✓ VERIFIED</span>}
                                    </label>
                                    <div className="email-verify-row">
                                        <input
                                            type="email"
                                            name="customer_email"
                                            value={formData.customer_email}
                                            onChange={handleChange}
                                            placeholder="customer@email.com"
                                        />
                                        {!emailVerified && (
                                            <button
                                                type="button"
                                                className="task-btn-verify"
                                                onClick={sendVerificationCode}
                                                disabled={verifying || !formData.customer_email}
                                            >
                                                {verifying ? '...' : 'VERIFY'}
                                            </button>
                                        )}
                                    </div>

                                    {verificationSent && !emailVerified && (
                                        <div className="verification-code-section">
                                            <input
                                                type="text"
                                                value={verificationCode}
                                                onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                                                placeholder="Enter code from Telegram"
                                                maxLength={6}
                                            />
                                            <button
                                                type="button"
                                                className="task-btn-confirm"
                                                onClick={confirmVerificationCode}
                                                disabled={verifying}
                                            >
                                                CONFIRM
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="task-field">
                                    <label>Phone</label>
                                    <input
                                        type="tel"
                                        name="customer_phone"
                                        value={formData.customer_phone}
                                        onChange={handleChange}
                                        placeholder="+91 12345 67890"
                                    />
                                </div>

                                <div className="task-field">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            name="send_completion_email"
                                            checked={formData.send_completion_email}
                                            onChange={handleChange}
                                        />
                                        Send completion email to customer
                                    </label>
                                </div>
                            </div>

                            {/* Drive Links Section */}
                            <div className="task-form-section">
                                <h3>ATTACHMENTS</h3>
                                <div className="task-field">
                                    <label>Google Drive Link</label>
                                    <div className="drive-link-row">
                                        <input
                                            type="url"
                                            value={driveLink}
                                            onChange={(e) => setDriveLink(e.target.value)}
                                            placeholder="https://drive.google.com/..."
                                        />
                                        {taskId && (
                                            <button
                                                type="button"
                                                className="task-btn-add"
                                                onClick={addDriveLink}
                                                disabled={!driveLink}
                                            >
                                                ADD
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {attachments.length > 0 && (
                                    <div className="attachments-list">
                                        {attachments.map((att) => (
                                            <a
                                                key={att.id}
                                                href={att.drive_link || att.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="attachment-link"
                                            >
                                                📎 {att.file_name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Resolution Notes - For editing existing tasks */}
                    {taskId && (
                        <div className="task-form-section task-resolution">
                            <h3>RESOLUTION / MEASURES TAKEN</h3>
                            <textarea
                                name="resolution_notes"
                                value={formData.resolution_notes}
                                onChange={handleChange}
                                placeholder="Describe what measures were taken to complete this task..."
                                rows={3}
                            />
                        </div>
                    )}

                    {/* Comments Section - Only for existing tasks */}
                    {taskId && (
                        <div className="task-form-section task-comments">
                            <h3>ACTIVITY LOG</h3>
                            <div className="comments-list">
                                {comments.length === 0 ? (
                                    <p className="no-comments">No activity yet</p>
                                ) : (
                                    comments.map((c) => (
                                        <div key={c.id} className={`comment ${c.is_system_message ? 'system' : ''}`}>
                                            <div className="comment-header">
                                                <span className="comment-author">{c.user_name || 'System'}</span>
                                                <span className="comment-time">
                                                    {new Date(c.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <p>{c.comment}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="add-comment">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    onKeyPress={(e) => e.key === 'Enter' && addComment()}
                                />
                                <button type="button" onClick={addComment}>ADD</button>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="task-modal-actions">
                        {taskId && formData.status !== 'completed' && (
                            <button
                                type="button"
                                className="task-btn-complete"
                                onClick={() => updateStatus('completed')}
                                disabled={loading}
                            >
                                ✓ MARK COMPLETE
                            </button>
                        )}

                        <button type="button" className="task-btn-cancel" onClick={onClose}>
                            CANCEL
                        </button>

                        <button type="submit" className="task-btn-save" disabled={loading}>
                            {loading ? 'SAVING...' : (taskId ? 'UPDATE TASK' : 'CREATE TASK')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskModal;
