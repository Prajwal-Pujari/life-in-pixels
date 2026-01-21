import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
    children: React.ReactNode;
    isAuthenticated: boolean;
    requiredRole?: 'admin' | 'employee';
    userRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    isAuthenticated,
    requiredRole,
    userRole
}) => {
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && userRole !== requiredRole) {
        return <Navigate to="/calendar" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
