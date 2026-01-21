import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface OAuthCallbackPageProps {
    onLogin: (token: string, user: any) => void;
}

const OAuthCallbackPage: React.FC<OAuthCallbackPageProps> = ({ onLogin }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    useEffect(() => {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
            console.error('OAuth error:', error);
            navigate('/login?error=' + error);
            return;
        }

        if (token) {
            fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(user => {
                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(user));
                    onLogin(token, user);
                    navigate('/calendar');
                })
                .catch(err => {
                    console.error('Failed to fetch user:', err);
                    navigate('/login?error=auth_failed');
                });
        } else {
            navigate('/login');
        }
    }, [searchParams, navigate, onLogin, API_URL]);

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1 className="login-title">Authenticating...</h1>
                    <p className="login-subtitle">Please wait</p>
                </div>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner"></div>
                </div>
            </div>
        </div>
    );
};

export default OAuthCallbackPage;
