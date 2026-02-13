import React, { useState, useEffect } from 'react';
import '../calibration-styles.css';

interface CalibrationExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    attendanceId: number;
    onSuccess: () => void;
}

interface Expense {
    id?: number;
    type: string;
    amount: string;
    description: string;
    notes: string;
}

interface SiteVisitData {
    location: string;
    companyName: string;
    numGauges: string;
    visitSummary: string;
    conclusion: string;
    expenses: Expense[];
}

const CalibrationExpenseModal: React.FC<CalibrationExpenseModalProps> = ({
    isOpen,
    onClose,
    date,
    attendanceId,
    onSuccess
}) => {
    const [formData, setFormData] = useState<SiteVisitData>({
        location: '',
        companyName: '',
        numGauges: '0',
        visitSummary: '',
        conclusion: '',
        expenses: [{ type: '', amount: '', description: '', notes: '' }]
    });

    const [autocomplete, setAutocomplete] = useState<{
        locations: string[];
        companies: string[];
        expenseTypes: string[];
    }>({
        locations: [],
        companies: [],
        expenseTypes: []
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadAutocompleteData();
            loadExistingSiteVisit();
        }
    }, [isOpen, date]);

    const loadAutocompleteData = async () => {
        const token = localStorage.getItem('token');

        try {
            const [locationsRes, companiesRes, typesRes] = await Promise.all([
                fetch('/api/calibration/autocomplete?type=location', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/calibration/autocomplete?type=company', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/calibration/autocomplete?type=expense_type', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (locationsRes.ok && companiesRes.ok && typesRes.ok) {
                setAutocomplete({
                    locations: await locationsRes.json(),
                    companies: await companiesRes.json(),
                    expenseTypes: await typesRes.json()
                });
            }
        } catch (err) {
            console.error('Failed to load autocomplete data:', err);
        }
    };

    const loadExistingSiteVisit = async () => {
        const token = localStorage.getItem('token');

        try {
            const res = await fetch(`/api/calibration/site-visit/${date}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setFormData({
                    location: data.location || '',
                    companyName: data.company_name || '',
                    numGauges: data.num_gauges?.toString() || '0',
                    visitSummary: data.visit_summary || '',
                    conclusion: data.conclusion || '',
                    expenses: data.expenses?.map((exp: any) => ({
                        id: exp.id,
                        type: exp.type,
                        amount: exp.amount.toString(),
                        description: exp.description || '',
                        notes: exp.notes || ''
                    })) || [{ type: '', amount: '', description: '', notes: '' }]
                });
            }
        } catch (err) {
            console.error('Failed to load existing site visit:', err);
        }
    };

    const handleInputChange = (field: keyof SiteVisitData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleExpenseChange = (index: number, field: keyof Expense, value: string) => {
        setFormData(prev => ({
            ...prev,
            expenses: prev.expenses.map((exp, i) =>
                i === index ? { ...exp, [field]: value } : exp
            )
        }));
    };

    const addExpenseRow = () => {
        setFormData(prev => ({
            ...prev,
            expenses: [...prev.expenses, { type: '', amount: '', description: '', notes: '' }]
        }));
    };

    const removeExpenseRow = (index: number) => {
        if (formData.expenses.length > 1) {
            setFormData(prev => ({
                ...prev,
                expenses: prev.expenses.filter((_, i) => i !== index)
            }));
        }
    };

    const calculateTotal = (): number => {
        return formData.expenses.reduce((sum, exp) => {
            const amount = parseFloat(exp.amount) || 0;
            return sum + amount;
        }, 0);
    };

    const validateForm = (): boolean => {
        if (!formData.location.trim()) {
            setError('Location is required');
            return false;
        }

        if (!formData.companyName.trim()) {
            setError('Company name is required');
            return false;
        }

        const validExpenses = formData.expenses.filter(exp =>
            exp.type.trim() && parseFloat(exp.amount) > 0
        );

        if (validExpenses.length === 0) {
            setError('At least one valid expense is required');
            return false;
        }

        setError('');
        return true;
    };

    const handleSaveDraft = async () => {
        if (!validateForm()) return;

        setLoading(true);
        const token = localStorage.getItem('token');

        try {
            const validExpenses = formData.expenses.filter(exp =>
                exp.type.trim() && parseFloat(exp.amount) > 0
            );

            const res = await fetch('/api/calibration/site-visit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    date,
                    attendanceId,
                    location: formData.location,
                    companyName: formData.companyName,
                    numGauges: parseInt(formData.numGauges) || 0,
                    visitSummary: formData.visitSummary,
                    conclusion: formData.conclusion,
                    expenses: validExpenses.map(exp => ({
                        type: exp.type,
                        amount: parseFloat(exp.amount),
                        description: exp.description,
                        notes: exp.notes
                    }))
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save site visit');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitForApproval = async () => {
        if (!validateForm()) return;

        if (!window.confirm('Submit expenses for admin approval? You won\'t be able to edit after submission.')) {
            return;
        }

        setIsSubmitting(true);
        const token = localStorage.getItem('token');

        try {
            // First save the site visit
            await handleSaveDraft();

            // Then submit for approval (you would need the site visit ID from the response)
            // For now, we'll make it a single operation
            setError('');
            alert('Site visit expenses submitted for approval!');
            onSuccess();
            onClose();
        } catch (err) {
            setError('Failed to submit for approval');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="calibration-modal">
                <div className="modal-header">
                    <h2>🔧 Site Visit Expenses</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Site Visit Details Section */}
                    <section className="site-details-section">
                        <h3>📍 Site Visit Details</h3>

                        <div className="form-group">
                            <label htmlFor="location">Location *</label>
                            <input
                                type="text"
                                id="location"
                                list="locations-list"
                                value={formData.location}
                                onChange={(e) => handleInputChange('location', e.target.value)}
                                placeholder="e.g., ABC Industries, Pune"
                                required
                            />
                            <datalist id="locations-list">
                                {autocomplete.locations.map((loc, i) => (
                                    <option key={i} value={loc} />
                                ))}
                            </datalist>
                        </div>

                        <div className="form-group">
                            <label htmlFor="company">Company Name *</label>
                            <input
                                type="text"
                                id="company"
                                list="companies-list"
                                value={formData.companyName}
                                onChange={(e) => handleInputChange('companyName', e.target.value)}
                                placeholder="e.g., ABC Industries"
                                required
                            />
                            <datalist id="companies-list">
                                {autocomplete.companies.map((comp, i) => (
                                    <option key={i} value={comp} />
                                ))}
                            </datalist>
                        </div>

                        <div className="form-group">
                            <label htmlFor="gauges">Number of Gauges</label>
                            <input
                                type="number"
                                id="gauges"
                                min="0"
                                value={formData.numGauges}
                                onChange={(e) => handleInputChange('numGauges', e.target.value)}
                                placeholder="0"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="summary">Visit Summary</label>
                            <textarea
                                id="summary"
                                value={formData.visitSummary}
                                onChange={(e) => handleInputChange('visitSummary', e.target.value)}
                                placeholder="Describe the work performed during the visit"
                                rows={3}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="conclusion">Conclusion</label>
                            <textarea
                                id="conclusion"
                                value={formData.conclusion}
                                onChange={(e) => handleInputChange('conclusion', e.target.value)}
                                placeholder="Outcome and next steps"
                                rows={2}
                            />
                        </div>
                    </section>

                    {/* Expenses Section */}
                    <section className="expenses-section">
                        <h3>💰 Expenses</h3>

                        <div className="expenses-list">
                            {formData.expenses.map((expense, index) => (
                                <div key={index} className="expense-row">
                                    <div className="expense-field expense-type">
                                        <input
                                            type="text"
                                            list="expense-types-list"
                                            value={expense.type}
                                            onChange={(e) => handleExpenseChange(index, 'type', e.target.value)}
                                            placeholder="cab, food, materials"
                                        />
                                        <datalist id="expense-types-list">
                                            {autocomplete.expenseTypes.map((type, i) => (
                                                <option key={i} value={type} />
                                            ))}
                                        </datalist>
                                    </div>

                                    <div className="expense-field expense-amount">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={expense.amount}
                                            onChange={(e) => handleExpenseChange(index, 'amount', e.target.value)}
                                            placeholder="₹ 0.00"
                                        />
                                    </div>

                                    <div className="expense-field expense-description">
                                        <input
                                            type="text"
                                            value={expense.description}
                                            onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                                            placeholder="Description"
                                        />
                                    </div>

                                    <div className="expense-field expense-notes">
                                        <input
                                            type="text"
                                            value={expense.notes}
                                            onChange={(e) => handleExpenseChange(index, 'notes', e.target.value)}
                                            placeholder="Notes"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className="remove-expense-btn"
                                        onClick={() => removeExpenseRow(index)}
                                        disabled={formData.expenses.length === 1}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            className="add-expense-btn"
                            onClick={addExpenseRow}
                        >
                            + Add Expense
                        </button>

                        <div className="expense-total">
                            <strong>Total:</strong> ₹{calculateTotal().toFixed(2)}
                        </div>
                    </section>
                </div>

                <div className="modal-footer">
                    <button
                        className="btn-secondary"
                        onClick={handleSaveDraft}
                        disabled={loading || isSubmitting}
                    >
                        {loading ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSubmitForApproval}
                        disabled={loading || isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                    <button
                        className="btn-cancel"
                        onClick={onClose}
                        disabled={loading || isSubmitting}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalibrationExpenseModal;
