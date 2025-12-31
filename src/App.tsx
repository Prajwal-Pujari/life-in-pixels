import React, { useState, useEffect } from 'react';
import MonthGrid from './components/MonthGrid';
import TimeCounter from './components/TimeCounter';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const updateTime = () => {
      setCurrentDate(new Date());
    };

    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <div className="app-container">
        <div className="left-section">
          <TimeCounter currentDate={currentDate} />
        </div>
        <div className="right-section">
          <MonthGrid 
            year={currentDate.getFullYear()} 
            month={currentDate.getMonth()} 
            today={currentDate}
          />
        </div>
      </div>
    </div>
  );
};

export default App;