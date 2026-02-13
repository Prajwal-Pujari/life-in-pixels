import React, { useState, useEffect } from 'react';
import '../task-styles.css';

interface TaskDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    onTaskClick: (taskId: number) => void;
    onNewTask: () => void;
}

interface DashboardStats {
    open_count: number;
    in_progress_count: number;
    pending_count: number;
    completed_today: number;
    overdue_count: number;
    due_today: number;
    urgent_count: number;
    total_tasks: number;
}

interface Task {
    id: number;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    customer_name: string | null;
    assigned_to_name: string | null;
}

const TaskDashboard: React.FC<TaskDashboardProps> = ({
    isOpen,
    onClose,
    token,
    onTaskClick,
    onNewTask
}) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentTasks, setRecentTasks] = useState<Task[]>([]);
    const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: 'all', priority: 'all' });
    const [view, setView] = useState<'dashboard' | 'list'>('dashboard');

    useEffect(() => {
        if (isOpen) {
            loadDashboard();
            loadAllTasks();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            loadAllTasks();
        }
    }, [filter]);

    const loadDashboard = async () => {
        try {
            const response = await fetch(`${API_URL}/tasks/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
                setRecentTasks(data.recentTasks || []);
                setUpcomingTasks(data.upcomingTasks || []);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    };

    const loadAllTasks = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filter.status !== 'all') params.append('status', filter.status);
            if (filter.priority !== 'all') params.append('priority', filter.priority);

            const response = await fetch(`${API_URL}/tasks?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAllTasks(data);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDueDate = (dateStr: string | null) => {
        if (!dateStr) return 'No due date';
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(date);
        dueDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, class: 'overdue' };
        if (diffDays === 0) return { text: 'Today', class: 'today' };
        if (diffDays === 1) return { text: 'Tomorrow', class: '' };
        return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), class: '' };
    };

    if (!isOpen) return null;

    return (
        <div className="task-modal-overlay" onClick={onClose}>
            <div className="task-modal" style={{ maxWidth: '1000px' }} onClick={e => e.stopPropagation()}>
                <div className="task-modal-header">
                    <h2>TASK DASHBOARD</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className={`task-btn-secondary ${view === 'dashboard' ? 'active' : ''}`}
                            onClick={() => setView('dashboard')}
                            style={{ padding: '5px 12px' }}
                        >
                            OVERVIEW
                        </button>
                        <button
                            className={`task-btn-secondary ${view === 'list' ? 'active' : ''}`}
                            onClick={() => setView('list')}
                            style={{ padding: '5px 12px' }}
                        >
                            ALL TASKS
                        </button>
                        <button className="btn-new-task" onClick={onNewTask}>
                            + NEW TASK
                        </button>
                        <button className="task-modal-close" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="task-dashboard">
                    {view === 'dashboard' ? (
                        <>
                            {/* Stats Grid */}
                            <div className="task-stats-grid">
                                <div className={`task-stat-card ${stats?.urgent_count ? 'urgent' : ''}`}>
                                    <div className="task-stat-value">{stats?.urgent_count || 0}</div>
                                    <div className="task-stat-label">URGENT</div>
                                </div>
                                <div className={`task-stat-card ${stats?.overdue_count ? 'overdue' : ''}`}>
                                    <div className="task-stat-value">{stats?.overdue_count || 0}</div>
                                    <div className="task-stat-label">OVERDUE</div>
                                </div>
                                <div className="task-stat-card">
                                    <div className="task-stat-value">{stats?.due_today || 0}</div>
                                    <div className="task-stat-label">DUE TODAY</div>
                                </div>
                                <div className="task-stat-card">
                                    <div className="task-stat-value">{stats?.open_count || 0}</div>
                                    <div className="task-stat-label">OPEN</div>
                                </div>
                                <div className="task-stat-card">
                                    <div className="task-stat-value">{stats?.in_progress_count || 0}</div>
                                    <div className="task-stat-label">IN PROGRESS</div>
                                </div>
                                <div className="task-stat-card">
                                    <div className="task-stat-value">{stats?.pending_count || 0}</div>
                                    <div className="task-stat-label">PENDING</div>
                                </div>
                                <div className="task-stat-card">
                                    <div className="task-stat-value">{stats?.completed_today || 0}</div>
                                    <div className="task-stat-label">DONE TODAY</div>
                                </div>
                                <div className="task-stat-card">
                                    <div className="task-stat-value">{stats?.total_tasks || 0}</div>
                                    <div className="task-stat-label">TOTAL</div>
                                </div>
                            </div>

                            {/* Recent and Upcoming Tasks */}
                            <div className="task-form-grid">
                                <div className="task-list-container">
                                    <div className="task-list-header">
                                        <h3>RECENT TASKS</h3>
                                    </div>
                                    <div className="task-list">
                                        {recentTasks.length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '8px' }}>
                                                No recent tasks
                                            </div>
                                        ) : (
                                            recentTasks.map(task => {
                                                const due = formatDueDate(task.due_date);
                                                return (
                                                    <div key={task.id} className="task-item" onClick={() => onTaskClick(task.id)}>
                                                        <div className={`task-priority-indicator ${task.priority}`}></div>
                                                        <div className="task-item-content">
                                                            <div className="task-item-title">{task.title}</div>
                                                            <div className="task-item-meta">
                                                                {task.customer_name || 'No customer'} • {task.assigned_to_name || 'Unassigned'}
                                                            </div>
                                                        </div>
                                                        <div className={`task-item-due ${typeof due === 'object' ? due.class : ''}`}>
                                                            {typeof due === 'object' ? due.text : due}
                                                        </div>
                                                        <span className={`task-status-badge ${task.status}`}>
                                                            {task.status.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="task-list-container">
                                    <div className="task-list-header">
                                        <h3>UPCOMING TASKS</h3>
                                    </div>
                                    <div className="task-list">
                                        {upcomingTasks.length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '8px' }}>
                                                No upcoming tasks
                                            </div>
                                        ) : (
                                            upcomingTasks.map(task => {
                                                const due = formatDueDate(task.due_date);
                                                return (
                                                    <div key={task.id} className="task-item" onClick={() => onTaskClick(task.id)}>
                                                        <div className={`task-priority-indicator ${task.priority}`}></div>
                                                        <div className="task-item-content">
                                                            <div className="task-item-title">{task.title}</div>
                                                            <div className="task-item-meta">
                                                                {task.customer_name || 'No customer'}
                                                            </div>
                                                        </div>
                                                        <div className={`task-item-due ${typeof due === 'object' ? due.class : ''}`}>
                                                            {typeof due === 'object' ? due.text : due}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* All Tasks List View */
                        <div className="task-list-container">
                            <div className="task-list-header">
                                <h3>ALL TASKS ({allTasks.length})</h3>
                                <div className="task-filters">
                                    <select
                                        value={filter.status}
                                        onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="pending">Pending</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                    <select
                                        value={filter.priority}
                                        onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
                                    >
                                        <option value="all">All Priority</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                            </div>
                            <div className="task-list" style={{ maxHeight: '500px' }}>
                                {loading ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '8px' }}>
                                        Loading...
                                    </div>
                                ) : allTasks.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '8px' }}>
                                        No tasks found
                                    </div>
                                ) : (
                                    allTasks.map(task => {
                                        const due = formatDueDate(task.due_date);
                                        return (
                                            <div key={task.id} className="task-item" onClick={() => onTaskClick(task.id)}>
                                                <div className={`task-priority-indicator ${task.priority}`}></div>
                                                <div className="task-item-content">
                                                    <div className="task-item-title">{task.title}</div>
                                                    <div className="task-item-meta">
                                                        {task.customer_name || 'No customer'} • {task.assigned_to_name || 'Unassigned'}
                                                    </div>
                                                </div>
                                                <div className={`task-item-due ${typeof due === 'object' ? due.class : ''}`}>
                                                    {typeof due === 'object' ? due.text : due}
                                                </div>
                                                <span className={`task-status-badge ${task.status}`}>
                                                    {task.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskDashboard;
