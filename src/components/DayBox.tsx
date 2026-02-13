import React from 'react';

interface DayBoxProps {
  day: number | null;
  state: 'past' | 'today' | 'future' | 'placeholder' | 'holiday';
  onClick?: () => void;
  hasEntry?: boolean;
  holidayName?: string;
  attendanceStatus?: string;
  taskCount?: number;
  hasUrgentTask?: boolean;
}

const DayBox: React.FC<DayBoxProps> = ({
  day,
  state,
  onClick,
  hasEntry,
  holidayName,
  attendanceStatus,
  taskCount = 0,
  hasUrgentTask = false
}) => {
  return (
    <div
      className={`day-box ${state} ${hasEntry ? 'has-entry' : ''} ${day !== null ? 'clickable' : ''} ${attendanceStatus ? `attendance-${attendanceStatus}` : ''}`}
      onClick={day !== null ? onClick : undefined}
      title={holidayName || (attendanceStatus ? `Status: ${attendanceStatus}` : taskCount ? `${taskCount} task(s)` : undefined)}
    >
      {day !== null && (
        <>
          <span className="day-number">{day}</span>
          {hasEntry && <div className="entry-indicator">●</div>}
          {holidayName && <div className="holiday-indicator">🎉</div>}
          {taskCount > 0 && (
            <div className={`calendar-task-count ${hasUrgentTask ? 'has-urgent' : ''}`}>
              {taskCount}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DayBox;