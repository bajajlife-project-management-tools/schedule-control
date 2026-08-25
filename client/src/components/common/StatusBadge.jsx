import React from 'react';

export default function StatusBadge({ status }) {
  if (!status) return <span className="status-badge forecast-required">NO STATUS</span>;

  const normalized = status.toUpperCase().trim();
  let className = 'status-badge';
  let label = status;

  if (normalized.includes('COMPLETED') && normalized.includes('ON TIME')) {
    className += ' completed-on-time';
    label = 'COMPLETED - ON TIME';
  } else if (normalized.includes('COMPLETED') && normalized.includes('LATE')) {
    className += ' completed-late';
    label = 'COMPLETED - LATE';
  } else if (normalized.includes('COMPLETED')) {
    className += ' completed-on-time';
  } else if (normalized.includes('ON TRACK')) {
    className += ' on-track';
    label = 'ON TRACK';
  } else if (normalized.includes('PROTECTED')) {
    className += ' at-risk-protected';
    label = 'AT RISK - FINAL PROTECTED';
  } else if (normalized.includes('AT RISK')) {
    className += ' at-risk';
    label = 'AT RISK';
  } else if (normalized.includes('DELAYED')) {
    className += ' delayed';
    label = 'DELAYED';
  } else if (normalized.includes('RECOVERED')) {
    className += ' recovered';
    label = 'RECOVERED';
  } else if (normalized.includes('FORECAST REQUIRED') || normalized.includes('REQUIRED')) {
    className += ' forecast-required';
    label = 'FORECAST REQUIRED';
  } else {
    className += ' forecast-required';
  }

  return (
    <span className={className} title={status}>
      {label}
    </span>
  );
}
