import React, { useState, useEffect } from 'react';

interface Holiday {
  id: number;
  holiday_name: string;
  holiday_date: string;
  description: string;
  is_recurring: boolean;
}

interface HolidayManagementProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  onHolidayAdd?: () => void;
}

const HolidayManagement: React.FC<HolidayManagementProps> = ({ isOpen, onClose, token: propToken, onHolidayAdd }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    holidayName: '',
    holidayDate: '',
    description: '',
    isRecurring: false
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const token = propToken || localStorage.getItem('token');

  useEffect(() => {
    if (isOpen) {
      loadHolidays();
    }
  }, [isOpen]);

  const loadHolidays = async () => {
    try {
      const response = await fetch(`${API_URL}/holidays?year=${new Date().getFullYear()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHolidays(data);
    } catch (error) {
      console.error('Error loading holidays:', error);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/admin/holidays`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadHolidays();
        setShowAddForm(false);
        setFormData({
          holidayName: '',
          holidayDate: '',
          description: '',
          isRecurring: false
        });
      }
    } catch (error) {
      console.error('Error adding holiday:', error);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      await fetch(`${API_URL}/admin/holidays/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await loadHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content holiday-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="modal-icon">📅</span>
            HOLIDAY MANAGEMENT
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!showAddForm ? (
            <>
              <button
                className="btn-add-holiday"
                onClick={() => setShowAddForm(true)}
              >
                + ADD NEW HOLIDAY
              </button>

              <div className="holidays-list">
                {holidays.map(holiday => (
                  <div key={holiday.id} className="holiday-item">
                    <div className="holiday-info">
                      <div className="holiday-name">{holiday.holiday_name}</div>
                      <div className="holiday-date">
                        {new Date(holiday.holiday_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      {holiday.description && (
                        <div className="holiday-desc">{holiday.description}</div>
                      )}
                      {holiday.is_recurring && (
                        <span className="holiday-badge">RECURRING</span>
                      )}
                    </div>
                    <button
                      className="btn-delete-small"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                    >
                      DELETE
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={handleAddHoliday} className="holiday-form">
              <div className="form-group">
                <label className="form-label">HOLIDAY NAME</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.holidayName}
                  onChange={(e) => setFormData({ ...formData, holidayName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">DATE</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.holidayDate}
                  onChange={(e) => setFormData({ ...formData, holidayDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">DESCRIPTION</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  />
                  <span>RECURRING HOLIDAY</span>
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddForm(false)}>
                  CANCEL
                </button>
                <button type="submit" className="btn-submit">
                  ADD HOLIDAY
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default HolidayManagement;