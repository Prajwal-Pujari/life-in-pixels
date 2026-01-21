import React from 'react';

interface JournalEntry {
  oneSentence: string;
  mood: string;
  morning: string;
  work: string;
  moments: string;
  thoughts: string;
  gratitude: string;
  endOfDay: string;
  studyStartTime: string;
  studyEndTime: string;
  studySubject: string;
  studyNotes: string;
}

interface JournalPageViewProps {
  isOpen: boolean;
  onClose: () => void;
  date: { year: number; month: number; day: number } | null;
  entry: JournalEntry;
  onNavigate: (direction: 'prev' | 'next') => void;
}

const JournalPageView: React.FC<JournalPageViewProps> = ({ 
  isOpen, 
  onClose, 
  date, 
  entry,
  onNavigate
}) => {
  if (!isOpen || !date) return null;

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  const moodEmojis: Record<string, string> = {
    happy: '😊',
    peaceful: '😌',
    neutral: '😐',
    sad: '😔',
    tired: '😴'
  };

  const fullDate = new Date(date.year, date.month, date.day);
  const dayName = dayNames[fullDate.getDay()];

  // Calculate study duration
  const calculateStudyDuration = () => {
    if (!entry.studyStartTime || !entry.studyEndTime) return null;
    
    const start = new Date(`2000-01-01T${entry.studyStartTime}`);
    const end = new Date(`2000-01-01T${entry.studyEndTime}`);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs <= 0) return null;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes} minutes`;
    if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
  };

  // Check if entry has any content
  const hasContent = entry.oneSentence || entry.mood || entry.morning || 
                     entry.work || entry.moments || entry.thoughts || 
                     entry.gratitude || entry.endOfDay || entry.studyStartTime;

  return (
    <div className="journal-page-overlay" onClick={onClose}>
      <div className="journal-page-container" onClick={(e) => e.stopPropagation()}>
        {/* Navigation */}
        <div className="journal-page-nav">
          <button className="nav-btn" onClick={() => onNavigate('prev')}>
            ← PREV
          </button>
          <button className="nav-close" onClick={onClose}>
            ✕ CLOSE
          </button>
          <button className="nav-btn" onClick={() => onNavigate('next')}>
            NEXT →
          </button>
        </div>

        {/* Page Content */}
        <div className="journal-page-content">
          {/* Header */}
          <div className="journal-page-header">
            <div className="page-date-main">
              {monthNames[date.month]} {date.day}, {date.year}
            </div>
            <div className="page-day-name">{dayName}</div>
            {entry.mood && (
              <div className="page-mood">
                {moodEmojis[entry.mood]} {entry.mood.toUpperCase()}
              </div>
            )}
          </div>

          {hasContent ? (
            <div className="journal-page-body">
              {/* One Sentence */}
              {entry.oneSentence && (
                <div className="page-section page-one-sentence">
                  <div className="page-quote">"</div>
                  <p className="one-sentence-text">{entry.oneSentence}</p>
                  <div className="page-quote">"</div>
                </div>
              )}

              {/* Study Time */}
              {(entry.studyStartTime || entry.studySubject) && (
                <div className="page-section">
                  <div className="page-section-header">
                    <span className="page-icon">📚</span>
                    STUDY TIME
                  </div>
                  <div className="page-content">
                    {entry.studySubject && (
                      <div className="study-subject-display">
                        <strong>Subject:</strong> {entry.studySubject}
                      </div>
                    )}
                    {calculateStudyDuration() && (
                      <div className="study-duration-display">
                        <strong>Duration:</strong> {calculateStudyDuration()}
                        <span className="study-time-range">
                          ({entry.studyStartTime} - {entry.studyEndTime})
                        </span>
                      </div>
                    )}
                    {entry.studyNotes && (
                      <div className="study-notes-display">
                        {entry.studyNotes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Morning */}
              {entry.morning && (
                <div className="page-section">
                  <div className="page-section-header">
                    <span className="page-icon">🌅</span>
                    MORNING
                  </div>
                  <div className="page-content">{entry.morning}</div>
                </div>
              )}

              {/* Work */}
              {entry.work && (
                <div className="page-section">
                  <div className="page-section-header">
                    <span className="page-icon">💼</span>
                    WORK / STUDY
                  </div>
                  <div className="page-content">{entry.work}</div>
                </div>
              )}

              {/* Moments */}
              {entry.moments && (
                <div className="page-section">
                  <div className="page-section-header">
                    <span className="page-icon">✨</span>
                    MEMORABLE MOMENTS
                  </div>
                  <div className="page-content">{entry.moments}</div>
                </div>
              )}

              {/* Thoughts */}
              {entry.thoughts && (
                <div className="page-section">
                  <div className="page-section-header">
                    <span className="page-icon">💭</span>
                    THOUGHTS & FEELINGS
                  </div>
                  <div className="page-content">{entry.thoughts}</div>
                </div>
              )}

              {/* Gratitude */}
              {entry.gratitude && (
                <div className="page-section page-gratitude">
                  <div className="page-section-header">
                    <span className="page-icon">🙏</span>
                    GRATITUDE
                  </div>
                  <div className="page-content gratitude-text">{entry.gratitude}</div>
                </div>
              )}

              {/* End of Day */}
              {entry.endOfDay && (
                <div className="page-section">
                  <div className="page-section-header">
                    <span className="page-icon">🌙</span>
                    END OF DAY REFLECTION
                  </div>
                  <div className="page-content">{entry.endOfDay}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="page-no-content">
              <div className="no-content-icon">📖</div>
              <p>NO ENTRY FOR THIS DAY</p>
              <p className="no-content-hint">Click a day with a green dot to view entries</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalPageView;