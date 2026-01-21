import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface AuthCallbackProps {
    onLogin: (token: string, user: any) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onLogin }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
            console.error('OAuth error:', error);
            navigate('/?error=' + error);
            return;
        }

        if (token) {
            // Fetch user info with the token
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

            fetch(`${API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => res.json())
                .then(user => {
                    // Store in localStorage
                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(user));

                    // Call parent's onLogin
                    onLogin(token, user);

                    // Redirect to home
                    navigate('/');
                })
                .catch(err => {
                    console.error('Failed to fetch user:', err);
                    navigate('/?error=auth_failed');
                });
        } else {
            navigate('/');
        }
    }, [searchParams, navigate, onLogin]);

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

export default AuthCallback;
