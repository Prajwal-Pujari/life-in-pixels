import React, { useState, useEffect } from 'react';

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

interface JournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: { year: number; month: number; day: number } | null;
  entry: JournalEntry;
  onSave: (entry: JournalEntry) => void;
  onDelete: () => void;
}

const JournalModal: React.FC<JournalModalProps> = ({ 
  isOpen, 
  onClose, 
  date, 
  entry, 
  onSave,
  onDelete 
}) => {
  const [journalEntry, setJournalEntry] = useState<JournalEntry>(entry);

  useEffect(() => {
    setJournalEntry(entry);
  }, [entry]);

  if (!isOpen || !date) return null;

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const moods = [
    { emoji: '😊', value: 'happy', label: 'Happy' },
    { emoji: '😌', value: 'peaceful', label: 'Peaceful' },
    { emoji: '😐', value: 'neutral', label: 'Neutral' },
    { emoji: '😔', value: 'sad', label: 'Sad' },
    { emoji: '😴', value: 'tired', label: 'Tired' }
  ];

  const sections = [
    { 
      key: 'morning', 
      emoji: '🌅', 
      label: 'MORNING', 
      placeholder: 'How did your day start?'
    },
    { 
      key: 'work', 
      emoji: '💼', 
      label: 'WORK / STUDY', 
      placeholder: 'What did you work on today?'
    },
    { 
      key: 'moments', 
      emoji: '✨', 
      label: 'MOMENTS', 
      placeholder: 'Anything memorable today?'
    },
    { 
      key: 'thoughts', 
      emoji: '💭', 
      label: 'THOUGHTS', 
      placeholder: 'What stayed in your mind?'
    },
    { 
      key: 'gratitude', 
      emoji: '🙏', 
      label: 'GRATITUDE', 
      placeholder: 'Something you\'re thankful for...'
    },
    { 
      key: 'endOfDay', 
      emoji: '🌙', 
      label: 'END OF DAY', 
      placeholder: 'Looking back, how was today?'
    }
  ];

  const updateField = (field: keyof JournalEntry, value: string) => {
    setJournalEntry(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(journalEntry);
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  // Check if entry has any content
  const hasContent = journalEntry.oneSentence || journalEntry.mood || 
                     journalEntry.morning || journalEntry.work || 
                     journalEntry.moments || journalEntry.thoughts || 
                     journalEntry.gratitude || journalEntry.endOfDay ||
                     journalEntry.studyStartTime || journalEntry.studyEndTime;

  // Calculate study duration
 const calculateStudyDuration = () => {
  if (!journalEntry.studyStartTime || !journalEntry.studyEndTime) return null;

  const start = new Date(`2000-01-01T${journalEntry.studyStartTime}`);
  const end = new Date(`2000-01-01T${journalEntry.studyEndTime}`);

  const diffMs = end.getTime() - start.getTime(); // ✅ FIX

  if (diffMs <= 0) return null;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {monthNames[date.month]} {date.day}, {date.year}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {/* One Sentence Summary */}
          <div className="journal-one-sentence">
            <label className="section-label">TODAY IN ONE SENTENCE</label>
            <input
              type="text"
              className="one-sentence-input"
              value={journalEntry.oneSentence}
              onChange={(e) => updateField('oneSentence', e.target.value)}
              placeholder="Today felt like..."
            />
          </div>

          {/* Mood Selector */}
          <div className="journal-mood-section">
            <label className="section-label">HOW ARE YOU FEELING?</label>
            <div className="mood-selector">
              {moods.map(mood => (
                <button
                  key={mood.value}
                  className={`mood-btn ${journalEntry.mood === mood.value ? 'active' : ''}`}
                  onClick={() => updateField('mood', mood.value)}
                  title={mood.label}
                >
                  {mood.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Study Time Tracker */}
          <div className="journal-study-section">
            <label className="section-label">
              <span className="section-emoji">📚</span>
              STUDY TIME
            </label>
            <div className="study-time-inputs">
              <div className="time-input-group">
                <label className="time-label">FROM</label>
                <input
                  type="time"
                  className="time-input"
                  value={journalEntry.studyStartTime}
                  onChange={(e) => updateField('studyStartTime', e.target.value)}
                />
              </div>
              <div className="time-separator">→</div>
              <div className="time-input-group">
                <label className="time-label">TO</label>
                <input
                  type="time"
                  className="time-input"
                  value={journalEntry.studyEndTime}
                  onChange={(e) => updateField('studyEndTime', e.target.value)}
                />
              </div>
              {calculateStudyDuration() && (
                <div className="study-duration">
                  <span className="duration-label">DURATION:</span>
                  <span className="duration-value">{calculateStudyDuration()}</span>
                </div>
              )}
            </div>
            <input
              type="text"
              className="study-subject-input"
              value={journalEntry.studySubject}
              onChange={(e) => updateField('studySubject', e.target.value)}
              placeholder="What did you study?"
            />
            <textarea
              className="journal-textarea"
              value={journalEntry.studyNotes}
              onChange={(e) => updateField('studyNotes', e.target.value)}
              placeholder="Study notes or reflections..."
              rows={2}
            />
          </div>

          {/* Journal Sections */}
          <div className="journal-sections">
            {sections.map(section => (
              <div key={section.key} className="journal-section">
                <label className="section-label">
                  <span className="section-emoji">{section.emoji}</span>
                  {section.label}
                </label>
                <textarea
                  className="journal-textarea"
                  value={journalEntry[section.key as keyof JournalEntry]}
                  onChange={(e) => updateField(section.key as keyof JournalEntry, e.target.value)}
                  placeholder={section.placeholder}
                  rows={3}
                />
              </div>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          {hasContent && (
            <button className="btn-delete" onClick={handleDelete}>DELETE</button>
          )}
          <button className="btn-save" onClick={handleSave}>SAVE</button>
        </div>
      </div>
    </div>
  );
};

export default JournalModal;