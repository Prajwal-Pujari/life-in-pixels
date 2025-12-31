import React from 'react';

interface DayBoxProps {
  day: number | null;
  state: 'past' | 'today' | 'future' | 'placeholder';
}

const DayBox: React.FC<DayBoxProps> = ({ day, state }) => {
  return (
    <div className={`day-box ${state}`}>
      {day !== null && <span>{day}</span>}
    </div>
  );
};

export default DayBox;