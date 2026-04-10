// pages/AuthPage.jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import { loginSchema, signupSchema } from '../lib/schemas';
import { FieldError } from '../components/ui';

export default function AuthPage() {
  const [page, setPage]     = useState('login');
  const [apiErr, setApiErr] = useState('');
  const { login, signup }   = useAuth();

  const isLogin = page === 'login';
  const schema  = isLogin ? loginSchema : signupSchema;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setApiErr('');
    try {
      if (isLogin) await login(data);
      else         await signup(data);
    } catch (e) {
      setApiErr(e.message);
    }
  };

  const switchPage = (p) => {
    setPage(p);
    setApiErr('');
    reset();
  };

  return (
    <div className="auth-bg">
      <div className="auth-wrap">

        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">⬡</div>
          <div>
            <div className="auth-logo-title">NetCalc Pro</div>
            <div className="auth-logo-sub">VLSM · CISCO CLI · OFFLINE</div>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card">
          <h1 className="auth-card-title">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="auth-card-sub">
            {isLogin
              ? 'Sign in to your NetCalc Pro account'
              : 'Start calculating subnets and generating Cisco CLI'}
          </p>

          {apiErr && <div className="auth-error">⚠ {apiErr}</div>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>

            <div className="field">
              <label className="field-label">Username</label>
              <input
                className={`input ${errors.username ? 'input-error' : ''}`}
                type="text"
                placeholder="Enter username"
                autoComplete="username"
                {...register('username')}
              />
              <FieldError error={errors.username} />
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <input
                className={`input ${errors.password ? 'input-error' : ''}`}
                type="password"
                placeholder="Enter password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                {...register('password')}
              />
              <FieldError error={errors.password} />
            </div>

            {!isLogin && (
              <div className="field">
                <label className="field-label">Confirm Password</label>
                <input
                  className={`input ${errors.confirm ? 'input-error' : ''}`}
                  type="password"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  {...register('confirm')}
                />
                <FieldError error={errors.confirm} />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Please wait…'
                : isLogin ? '→ Sign In' : '→ Create Account'}
            </button>
          </form>

          <div className="auth-divider" />

          <p className="auth-switch">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="link-btn"
              onClick={() => switchPage(isLogin ? 'signup' : 'login')}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        <p className="auth-secure">
          <span className="secure-dot" />
          Passwords hashed with bcrypt · Sessions encrypted
        </p>
      </div>
    </div>
  );
}
