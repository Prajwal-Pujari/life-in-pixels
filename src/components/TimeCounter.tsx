import React from 'react';

interface TimeCounterProps {
  currentDate: Date;
}

const TimeCounter: React.FC<TimeCounterProps> = ({ currentDate }) => {
  const calculateTimeRemaining = (date: Date) => {
    const endOfYear = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
    const diff = Math.max(endOfYear.getTime() - date.getTime(), 0);

    const totalSeconds = Math.floor(diff / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    return {
      days: totalDays,
      hours: totalHours,
      minutes: totalMinutes,
      seconds: totalSeconds,
    };
  };

  const timeRemaining = calculateTimeRemaining(currentDate);

  return (
    <div className="time-counter-wrapper">
      <div className="counter-main">
        <div className="counter-number">{timeRemaining.days}</div>
        <div className="counter-label">DAYS REMAINING</div>
      </div>
      <div className="time-stats">
        <div className="stat-box">
          <div className="stat-number">{timeRemaining.hours.toLocaleString()}</div>
          <div className="stat-label">HOURS</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{timeRemaining.minutes.toLocaleString()}</div>
          <div className="stat-label">MINUTES</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{timeRemaining.seconds.toLocaleString()}</div>
          <div className="stat-label">SECONDS</div>
        </div>
      </div>
    </div>
  );
};

export default TimeCounter;