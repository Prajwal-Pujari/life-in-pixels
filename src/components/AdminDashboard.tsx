import React, { useState, useEffect } from 'react';

interface Employee {
  id: number;
  username: string;
  full_name: string;
  employee_id: string;
  department: string;
  email: string;
  last_login: string;
}

interface DashboardStats {
  total_employees: number;
  present_today: number;
  pending_leave_requests: number;
  upcoming_holidays: number;
}

interface AdminDashboardProps {
  onViewEmployee: (employeeId: number) => void;
  onManageHolidays: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  onViewEmployee,
  onManageHolidays 
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Load employees
      const employeesRes = await fetch(`${API_URL}/admin/employees`, { headers });
      const employeesData = await employeesRes.json();
      setEmployees(employeesData);

      // Load stats
      const statsRes = await fetch(`${API_URL}/admin/dashboard`, { headers });
      const statsData = await statsRes.json();
      setStats(statsData);

      // Load activity log
      const activityRes = await fetch(`${API_URL}/admin/activity-log?limit=10`, { headers });
      const activityData = await activityRes.json();
      setActivityLog(activityData);

    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return <div className="loading-message">LOADING ADMIN DASHBOARD...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1 className="admin-title">
          <span className="admin-icon">👑</span>
          ADMIN DASHBOARD
        </h1>
        <button className="btn-manage-holidays" onClick={onManageHolidays}>
          <span className="btn-emoji">📅</span>
          MANAGE HOLIDAYS
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.total_employees}</div>
            <div className="stat-label">TOTAL EMPLOYEES</div>
          </div>
          <div className="stat-card stat-present">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{stats.present_today}</div>
            <div className="stat-label">PRESENT TODAY</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{stats.pending_leave_requests}</div>
            <div className="stat-label">PENDING LEAVES</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎉</div>
            <div className="stat-value">{stats.upcoming_holidays}</div>
            <div className="stat-label">UPCOMING HOLIDAYS</div>
          </div>
        </div>
      )}

      {/* Employees List */}
      <div className="admin-section">
        <div className="section-header">
          <h2 className="section-title">EMPLOYEES</h2>
          <input
            type="text"
            className="search-input"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="employees-table">
          <div className="table-header">
            <div className="th">EMPLOYEE ID</div>
            <div className="th">NAME</div>
            <div className="th">DEPARTMENT</div>
            <div className="th">LAST LOGIN</div>
            <div className="th">ACTION</div>
          </div>
          {filteredEmployees.map(employee => (
            <div key={employee.id} className="table-row">
              <div className="td">{employee.employee_id}</div>
              <div className="td">{employee.full_name}</div>
              <div className="td">{employee.department || 'N/A'}</div>
              <div className="td">{formatDate(employee.last_login)}</div>
              <div className="td">
                <button
                  className="btn-view-employee"
                  onClick={() => onViewEmployee(employee.id)}
                >
                  VIEW CALENDAR
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Log */}
      <div className="admin-section">
        <h2 className="section-title">RECENT ACTIVITY</h2>
        <div className="activity-log">
          {activityLog.map((log, index) => (
            <div key={index} className="activity-item">
              <div className="activity-user">{log.full_name}</div>
              <div className="activity-action">{log.action_details}</div>
              <div className="activity-time">{formatDate(log.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;