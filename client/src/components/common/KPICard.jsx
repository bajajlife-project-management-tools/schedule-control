import React from 'react';

export default function KPICard({ label, value, sub, status = 'blue', valueColor = '' }) {
  let statusClass = `status-${status}`;
  let valColorClass = valueColor || status;

  return (
    <div className={`kpi-card ${statusClass}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valColorClass}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
