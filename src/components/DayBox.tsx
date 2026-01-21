import React from 'react';

interface DayBoxProps {
  day: number | null;
  state: 'past' | 'today' | 'future' | 'placeholder' | 'holiday';
  onClick?: () => void;
  hasEntry?: boolean;
  holidayName?: string;
  attendanceStatus?: string;
}

const DayBox: React.FC<DayBoxProps> = ({ day, state, onClick, hasEntry, holidayName, attendanceStatus }) => {
  return (
    <div
      className={`day-box ${state} ${hasEntry ? 'has-entry' : ''} ${day !== null ? 'clickable' : ''} ${attendanceStatus ? `attendance-${attendanceStatus}` : ''}`}
      onClick={day !== null ? onClick : undefined}
      title={holidayName || (attendanceStatus ? `Status: ${attendanceStatus}` : undefined)}
    >
      {day !== null && (
        <>
          <span className="day-number">{day}</span>
          {hasEntry && <div className="entry-indicator">●</div>}
          {holidayName && <div className="holiday-indicator">🎉</div>}
        </>
      )}
    </div>
  );
};

export default DayBox;