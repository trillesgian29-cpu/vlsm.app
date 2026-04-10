// components/ui.jsx — Reusable UI building blocks

export function FieldError({ error }) {
  if (!error) return null;
  return <p className="field-error">⚠ {error.message}</p>;
}

export function Input({ label, error, ...props }) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <input className={`input ${error ? 'input-error' : ''}`} {...props} />
      <FieldError error={error} />
    </div>
  );
}

export function CopyButton({ text, label = 'COPY' }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handle}>
      {copied ? 'COPIED!' : label}
    </button>
  );
}

export function Badge({ children, variant = 'blue' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function Card({ children, className = '' }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ icon, iconVariant = 'blue', title, subtitle, right }) {
  return (
    <div className="card-header">
      <div className={`card-icon icon-${iconVariant}`}>{icon}</div>
      <div>
        <h2 className="card-title">{title}</h2>
        {subtitle && <p className="card-sub">{subtitle}</p>}
      </div>
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

import { useState } from 'react';
