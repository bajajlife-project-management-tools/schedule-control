import React from 'react';
import { NavLink } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext.jsx';

export default function Sidebar() {
  const { activeProject } = useProject();

  const navItems = [
    { section: 'EXECUTIVE & GOVERNANCE' },
    { to: '/', label: 'Executive Dashboard', icon: '📊' },
    { to: '/cto-view', label: 'CTO 60-Sec View', icon: '🎯' },
    { to: '/weekly-control', label: 'Weekly Control & Review', icon: '📅' },
    { to: '/reports', label: 'Executive Reports', icon: '📑' },

    { section: 'SCHEDULE & NETWORK' },
    { to: '/schedule', label: 'Schedule Tracker', icon: '📋' },
    { to: '/gantt', label: 'Interactive Gantt', icon: '📈' },
    { to: '/milestones', label: 'Milestone Control', icon: '🏁' },
    { to: '/critical-path', label: 'Critical Path & Float', icon: '⚡' },

    { section: 'CONTROL & ASSURANCE' },
    { to: '/raid', label: 'RAID Management', icon: '🛡️' },
    { to: '/change-control', label: 'Change Control / Rebaseline', icon: '🔄' },
    { to: '/import', label: 'Excel Import Wizard', icon: '📥' },

    { section: 'ADMINISTRATION' },
    { to: '/settings', label: 'Calendar & Tolerance', icon: '⚙️' },
    { to: '/audit-log', label: 'Audit Trail', icon: '📜' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">SC</div>
        <div>
          <div className="sidebar-brand-text">SCHEDULE CONTROL</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            &amp; PROJECT GOVERNANCE
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, idx) => {
          if (item.section) {
            return (
              <div key={idx} className="sidebar-section-label">
                {item.section}
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
              end={item.to === '/'}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {activeProject && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-tertiary)',
          fontSize: 'var(--font-size-xs)'
        }}>
          <div style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Project
          </div>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeProject.name}
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem', marginTop: '2px' }}>
            PM: {activeProject.project_manager || 'Not Assigned'}
          </div>
        </div>
      )}
    </aside>
  );
}
