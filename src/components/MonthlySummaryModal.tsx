import React, { useState, useEffect } from 'react';

interface MonthlySummaryData {
  year: number;
  month: number;
  totalEntries: number;
  totalStudyHours: string;
  mostCommonMood: string;
  gratitudeCount: number;
  studySubjects: string[];
  summary: string;
  entries: any[];
}

interface MonthlySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
}

const MonthlySummaryModal: React.FC<MonthlySummaryModalProps> = ({ 
  isOpen, 
  onClose, 
  year, 
  month 
}) => {
  const [summaryData, setSummaryData] = useState<MonthlySummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMonthlySummary();
    }
  }, [isOpen, year, month]);

  const loadMonthlySummary = async () => {
    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/monthly-summary/${year}/${month}`);
      const data = await response.json();
      setSummaryData(data);
    } catch (error) {
      console.error('Error loading monthly summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const moodEmojis: Record<string, string> = {
    happy: '😊',
    peaceful: '😌',
    neutral: '😐',
    sad: '😔',
    tired: '😴'
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {monthNames[month]} {year} WRAP-UP
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {isLoading ? (
            <div className="loading-message">LOADING YOUR MONTH...</div>
          ) : summaryData ? (
            <div className="summary-content">
              {/* Header Summary */}
              <div className="summary-header">
                <div className="summary-emoji">🎉</div>
                <p className="summary-text">{summaryData.summary}</p>
              </div>

              {/* Stats Grid */}
              <div className="summary-stats-grid">
                <div className="summary-stat-card">
                  <div className="stat-icon">📝</div>
                  <div className="stat-value">{summaryData.totalEntries}</div>
                  <div className="stat-label">DAYS JOURNALED</div>
                </div>

                <div className="summary-stat-card">
                  <div className="stat-icon">📚</div>
                  <div className="stat-value">{summaryData.totalStudyHours}h</div>
                  <div className="stat-label">STUDY TIME</div>
                </div>

                <div className="summary-stat-card">
                  <div className="stat-icon">
                    {summaryData.mostCommonMood ? moodEmojis[summaryData.mostCommonMood] : '😐'}
                  </div>
                  <div className="stat-value">{summaryData.mostCommonMood || 'N/A'}</div>
                  <div className="stat-label">COMMON MOOD</div>
                </div>

                <div className="summary-stat-card">
                  <div className="stat-icon">🙏</div>
                  <div className="stat-value">{summaryData.gratitudeCount}</div>
                  <div className="stat-label">GRATITUDE</div>
                </div>
              </div>

              {/* Study Subjects */}
              {summaryData.studySubjects && summaryData.studySubjects.length > 0 && (
                <div className="summary-section">
                  <h4 className="summary-section-title">📚 WHAT YOU STUDIED</h4>
                  <div className="study-subjects-list">
                    {summaryData.studySubjects.map((subject, index) => (
                      <div key={index} className="subject-tag">
                        {subject}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Moments */}
              {summaryData.entries && summaryData.entries.length > 0 && (
                <div className="summary-section">
                  <h4 className="summary-section-title">✨ YOUR MONTH IN MOMENTS</h4>
                  <div className="moments-timeline">
                    {summaryData.entries
                      .filter(entry => entry.one_sentence)
                      .slice(0, 5)
                      .map((entry, index) => {
                        const entryDate = new Date(entry.entry_date);
                        return (
                          <div key={index} className="moment-item">
                            <div className="moment-date">
                              {monthNames[entryDate.getMonth()].slice(0, 3)} {entryDate.getDate()}
                            </div>
                            <div className="moment-text">{entry.one_sentence}</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-data-message">
              NO DATA AVAILABLE FOR THIS MONTH
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-save" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
};

export default MonthlySummaryModal;