import React from 'react';
import DayBox from './DayBox';

interface Task {
  id: number;
  title: string;
  priority: string;
  status: string;
}

interface MonthGridProps {
  currentDate: Date;
  entries: Record<string, any>;
  holidays: Record<string, string>;
  attendance: Record<string, string>;
  tasks?: Record<string, Task[]>;
  onDayClick: (year: number, month: number, day: number) => void;
  onTaskClick?: (taskId: number) => void;
}

const MonthGrid: React.FC<MonthGridProps> = ({ currentDate, onDayClick, entries, holidays, attendance, tasks = {}, onTaskClick }) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const getDayState = (day: number): 'past' | 'today' | 'future' | 'holiday' => {
    const currentDayDate = new Date(year, month, day);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Check if it's a holiday first
    const dayKey = `${year}-${month + 1}-${day}`;
    if (holidays[dayKey]) return 'holiday';

    if (currentDayDate < todayDate) return 'past';
    if (currentDayDate.getTime() === todayDate.getTime()) return 'today';
    return 'future';
  };

  const hasEntry = (day: number): boolean => {
    const key = `${year}-${month + 1}-${day}`;
    return !!entries[key];
  };

  const getHolidayName = (day: number): string | undefined => {
    const key = `${year}-${month + 1}-${day}`;
    return holidays[key];
  };

  const getAttendanceStatus = (day: number): string | undefined => {
    const key = `${year}-${month + 1}-${day}`;
    return attendance[key];
  };

  const getTasksForDay = (day: number): Task[] => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks[key] || [];
  };

  const days = [];

  // Add placeholder boxes for days before month starts
  for (let i = 0; i < startWeekday; i++) {
    days.push(<div key={`placeholder-${i}`} className="day-box placeholder"></div>);
  }

  // Add actual day boxes
  for (let day = 1; day <= daysInMonth; day++) {
    const dayTasks = getTasksForDay(day);
    days.push(
      <DayBox
        key={day}
        day={day}
        state={getDayState(day)}
        hasEntry={hasEntry(day)}
        holidayName={getHolidayName(day)}
        attendanceStatus={getAttendanceStatus(day)}
        taskCount={dayTasks.length}
        hasUrgentTask={dayTasks.some(t => t.priority === 'urgent')}
        onClick={() => onDayClick(year, month, day)}
      />
    );
  }

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="month-container">
      <div className="month-header">
        <h2>{monthNames[month]} {year}</h2>
      </div>
      <div className="weekday-labels">
        {weekdays.map(day => (
          <div key={day} className="weekday-label">{day}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {days}
      </div>
    </div>
  );
};

export default MonthGrid;