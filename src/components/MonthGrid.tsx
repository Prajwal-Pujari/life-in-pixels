import React from 'react';
import DayBox from './DayBox';

interface MonthGridProps {
  year: number;
  month: number;
  today: Date;
}

const MonthGrid: React.FC<MonthGridProps> = ({ year, month, today }) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const getDayState = (day: number): 'past' | 'today' | 'future' => {
    const currentDate = new Date(year, month, day);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (currentDate < todayDate) return 'past';
    if (currentDate.getTime() === todayDate.getTime()) return 'today';
    return 'future';
  };

  const days = [];
  
  for (let i = 0; i < startWeekday; i++) {
    days.push(<DayBox key={`placeholder-${i}`} day={null} state="placeholder" />);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(<DayBox key={day} day={day} state={getDayState(day)} />);
  }

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="month-grid">
      <h2 className="month-title">{monthNames[month]} {year}</h2>
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