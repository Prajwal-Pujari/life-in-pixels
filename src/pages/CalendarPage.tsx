import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MonthGrid from '../components/MonthGrid';
import TimeCounter from '../components/TimeCounter';
import AttendanceModal from '../components/AttendanceModal';
import MonthlySummaryModal from '../components/MonthlySummaryModal';
import JournalPageView from '../components/JournalPageView';
import TaskModal from '../components/TaskModal';
import TaskDashboard from '../components/TaskDashboard';
import '../task-styles.css';

interface CalendarPageProps {
    token: string;
    user: any;
    onLogout: () => void;
}

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

const emptyEntry: JournalEntry = {
    oneSentence: '',
    mood: '',
    morning: '',
    work: '',
    moments: '',
    thoughts: '',
    gratitude: '',
    endOfDay: '',
    studyStartTime: '',
    studyEndTime: '',
    studySubject: '',
    studyNotes: ''
};

const CalendarPage: React.FC<CalendarPageProps> = ({ token, user, onLogout }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [entries, setEntries] = useState<Record<string, JournalEntry>>({});
    const [holidays, setHolidays] = useState<Record<string, string>>({});
    const [attendance, setAttendance] = useState<Record<string, string>>({});
    const [selectedDate, setSelectedDate] = useState<{ year: number; month: number; day: number } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPageViewOpen, setIsPageViewOpen] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [viewingUserId, setViewingUserId] = useState<number | null>(null);
    const [tasks, setTasks] = useState<Record<string, any[]>>({});
    const [isTaskDashboardOpen, setIsTaskDashboardOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [taskDate, setTaskDate] = useState<{ year: number; month: number; day: number } | null>(null);
    const [employees, setEmployees] = useState<any[]>([]);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    useEffect(() => {
        const userId = searchParams.get('userId');
        if (userId) {
            setViewingUserId(parseInt(userId));
        }
    }, [searchParams]);

    useEffect(() => {
        const updateTime = () => {
            setCurrentDate(new Date());
        };

        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        loadEntries();
        loadHolidays();
        loadAttendance();
        loadTasks();
        if (user.role === 'admin') {
            loadEmployees();
        }
    }, [viewingUserId, currentDate]);

    const loadEntries = async () => {
        try {
            let url = `${API_URL}/entries`;
            if (viewingUserId) {
                url += `?userId=${viewingUserId}`;
            }

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            const entriesMap: Record<string, JournalEntry> = {};
            data.forEach((entry: any) => {
                const date = new Date(entry.entry_date);
                const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                entriesMap[key] = {
                    oneSentence: entry.one_sentence || '',
                    mood: entry.mood || '',
                    morning: entry.morning_routine || '',
                    work: entry.work_summary || '',
                    moments: entry.special_moments || '',
                    thoughts: entry.evening_reflections || '',
                    gratitude: entry.gratitude || '',
                    endOfDay: entry.end_of_day_note || '',
                    studyStartTime: entry.study_hours_start || '',
                    studyEndTime: entry.study_hours_end || '',
                    studySubject: entry.study_subject || '',
                    studyNotes: entry.study_notes || ''
                };
            });

            setEntries(entriesMap);
        } catch (error) {
            console.error('Error loading entries:', error);
        }
    };

    const loadHolidays = async () => {
        try {
            const year = new Date().getFullYear();
            const response = await fetch(`${API_URL}/holidays?year=${year}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            const holidaysMap: Record<string, string> = {};
            data.forEach((holiday: any) => {
                const date = new Date(holiday.holiday_date);
                const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                holidaysMap[key] = holiday.holiday_name;
            });

            setHolidays(holidaysMap);
        } catch (error) {
            console.error('Error loading holidays:', error);
        }
    };

    const loadAttendance = async () => {
        try {
            const year = new Date().getFullYear();
            const month = new Date().getMonth() + 1;
            let url = `${API_URL}/attendance?month=${year}-${String(month).padStart(2, '0')}`;
            if (viewingUserId) {
                url += `&userId=${viewingUserId}`;
            }

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            const attendanceMap: Record<string, string> = {};
            if (Array.isArray(data)) {
                data.forEach((att: any) => {
                    const date = new Date(att.date);
                    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                    attendanceMap[key] = att.status;
                });
            }

            setAttendance(attendanceMap);
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    };

    const loadTasks = async () => {
        try {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const response = await fetch(`${API_URL}/tasks/calendar?month=${year}-${month}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const tasksMap: Record<string, any[]> = {};
                data.forEach((task: any) => {
                    if (task.due_date) {
                        const dateKey = task.due_date.split('T')[0];
                        if (!tasksMap[dateKey]) tasksMap[dateKey] = [];
                        tasksMap[dateKey].push(task);
                    }
                });
                setTasks(tasksMap);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    };

    const loadEmployees = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/employees`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setEmployees(data);
            }
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    };

    const handleTaskClick = (taskId: number) => {
        setSelectedTaskId(taskId);
        setTaskDate(null);
        setIsTaskModalOpen(true);
        setIsTaskDashboardOpen(false);
    };

    const handleNewTask = () => {
        setSelectedTaskId(null);
        setTaskDate(null);
        setIsTaskModalOpen(true);
        setIsTaskDashboardOpen(false);
    };

    const handleTaskSaved = () => {
        loadTasks();
    };

    const handleDayClick = (year: number, month: number, day: number) => {
        setSelectedDate({ year, month, day });
        setIsModalOpen(true);
    };

    const handleSaveEntry = async (entry: JournalEntry) => {
        if (!selectedDate) return;

        try {
            const entryDate = `"${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}"`;

            const response = await fetch(`${API_URL}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    entryDate: entryDate,
                    oneSentence: entry.oneSentence,
                    mood: entry.mood,
                    morningRoutine: entry.morning,
                    workSummary: entry.work,
                    specialMoments: entry.moments,
                    eveningReflections: entry.thoughts,
                    gratitude: entry.gratitude,
                    endOfDayNote: entry.endOfDay,
                    studyHoursStart: entry.studyStartTime,
                    studyHoursEnd: entry.studyEndTime,
                    studySubject: entry.studySubject,
                    studyNotes: entry.studyNotes
                })
            });

            if (response.ok) {
                const key = `${selectedDate.year}-${selectedDate.month + 1}-${selectedDate.day}`;
                setEntries(prev => ({ ...prev, [key]: entry }));
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error('Error saving entry:', error);
        }
    };

    const handleDeleteEntry = async () => {
        if (!selectedDate) return;

        try {
            const entryDate = `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`;

            const response = await fetch(`${API_URL}/entries/${entryDate}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const key = `${selectedDate.year}-${selectedDate.month + 1}-${selectedDate.day}`;
                setEntries(prev => {
                    const newEntries = { ...prev };
                    delete newEntries[key];
                    return newEntries;
                });
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
        }
    };

    const getCurrentEntry = () => {
        if (!selectedDate) return emptyEntry;
        const key = `${selectedDate.year}-${selectedDate.month + 1}-${selectedDate.day}`;
        return entries[key] || emptyEntry;
    };

    const handleNavigateEntry = (direction: 'prev' | 'next') => {
        if (!selectedDate) return;

        const sortedDates = Object.keys(entries).sort();
        const currentKey = `${selectedDate.year}-${selectedDate.month + 1}-${selectedDate.day}`;
        const currentIndex = sortedDates.indexOf(currentKey);

        if (direction === 'prev' && currentIndex > 0) {
            const prevKey = sortedDates[currentIndex - 1];
            const [year, month, day] = prevKey.split('-').map(Number);
            setSelectedDate({ year, month: month - 1, day });
        } else if (direction === 'next' && currentIndex < sortedDates.length - 1) {
            const nextKey = sortedDates[currentIndex + 1];
            const [year, month, day] = nextKey.split('-').map(Number);
            setSelectedDate({ year, month: month - 1, day });
        }
    };

    return (
        <div className="app">
            <div className="app-header">
                <div className="user-info">
                    <div className="user-name">{viewingUserId ? `Viewing Employee ${viewingUserId}` : user.fullName}</div>
                    <div className="user-role">{user.role === 'admin' ? '👑 ADMIN' : '👤 EMPLOYEE'}</div>
                </div>

                <div className="header-actions">
                    {viewingUserId && user.role === 'admin' && (
                        <button className="btn-back-admin" onClick={() => navigate('/admin')}>
                            ← BACK TO DASHBOARD
                        </button>
                    )}
                    {user.role === 'admin' && !viewingUserId && (
                        <button className="btn-admin-dashboard" onClick={() => navigate('/admin')}>
                            <span className="btn-emoji">👑</span>
                            ADMIN DASHBOARD
                        </button>
                    )}
                    <button className="btn-logout" onClick={onLogout}>
                        LOGOUT
                    </button>
                </div>
            </div>

            <div className="app-container">
                <div className="left-section">
                    <TimeCounter currentDate={currentDate} />

                    <button
                        className="monthly-summary-btn"
                        onClick={() => setIsSummaryModalOpen(true)}
                    >
                        <span className="btn-emoji">📊</span>
                        MONTHLY WRAP-UP
                    </button>

                    <button
                        className="view-journal-btn"
                        onClick={() => {
                            if (Object.keys(entries).length > 0) {
                                const sortedDates = Object.keys(entries).sort().reverse();
                                const latestKey = sortedDates[0];
                                const [year, month, day] = latestKey.split('-').map(Number);
                                setSelectedDate({ year, month: month - 1, day });
                                setIsPageViewOpen(true);
                            }
                        }}
                    >
                        <span className="btn-emoji">📖</span>
                        VIEW JOURNAL
                    </button>

                    <button
                        className="btn-tasks"
                        onClick={() => setIsTaskDashboardOpen(true)}
                    >
                        <span className="btn-emoji">📋</span>
                        MY TASKS
                    </button>
                </div>

                <div className="right-section">
                    <div className="month-grid-container">
                        <MonthGrid
                            currentDate={currentDate}
                            entries={entries}
                            holidays={holidays}
                            attendance={attendance}
                            tasks={tasks}
                            onDayClick={handleDayClick}
                        />
                    </div>
                </div>
            </div>

            <AttendanceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                date={selectedDate}
                token={token}
                userRole={user.role}
                userId={viewingUserId || undefined}
                userDepartment={user.department}
            />

            <JournalPageView
                isOpen={isPageViewOpen}
                onClose={() => setIsPageViewOpen(false)}
                date={selectedDate}
                entry={getCurrentEntry()}
                onNavigate={handleNavigateEntry}
            />

            <MonthlySummaryModal
                isOpen={isSummaryModalOpen}
                onClose={() => setIsSummaryModalOpen(false)}
                year={currentDate.getFullYear()}
                month={currentDate.getMonth()}
            />

            <TaskDashboard
                isOpen={isTaskDashboardOpen}
                onClose={() => setIsTaskDashboardOpen(false)}
                token={token}
                onTaskClick={handleTaskClick}
                onNewTask={handleNewTask}
            />

            {user.role === 'admin' && (
                <TaskModal
                    isOpen={isTaskModalOpen}
                    onClose={() => setIsTaskModalOpen(false)}
                    token={token}
                    date={taskDate}
                    taskId={selectedTaskId}
                    onTaskSaved={handleTaskSaved}
                    employees={employees}
                />
            )}
        </div>
    );
};

export default CalendarPage;
