import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { api } from '../api/client.js';

export default function ProjectSettings() {
  const { activeProjectId, dashboardData, refresh } = useProject();
  const [calendarConfig, setCalendarConfig] = useState({
    working_monday: 1,
    working_tuesday: 1,
    working_wednesday: 1,
    working_thursday: 1,
    working_friday: 1,
    working_saturday: 0,
    working_sunday: 0,
  });
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'public' });
  const [toleranceDays, setToleranceDays] = useState(5);
  const [saving, setSaving] = useState(false);

  const loadCalendar = async () => {
    if (!activeProjectId) return;
    try {
      const res = await api.getCalendar(activeProjectId);
      if (res.config) setCalendarConfig(res.config);
      if (res.holidays) setHolidays(res.holidays);
      if (dashboardData?.project?.tolerance_days) {
        setToleranceDays(dashboardData.project.tolerance_days);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [activeProjectId]);

  const handleSaveCalendar = async () => {
    try {
      setSaving(true);
      await api.updateCalendar(activeProjectId, calendarConfig);
      await api.updateProject(activeProjectId, { tolerance_days: parseInt(toleranceDays) || 5 });
      await api.recalculateProject(activeProjectId);
      await refresh();
      alert('Calendar configuration, tolerance, and schedule recalculation completed!');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date) {
      alert('Please provide a date');
      return;
    }
    try {
      await api.addHoliday(activeProjectId, newHoliday);
      setNewHoliday({ date: '', name: '', type: 'public' });
      await loadCalendar();
      await api.recalculateProject(activeProjectId);
      await refresh();
    } catch (err) {
      alert('Failed to add holiday: ' + err.message);
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      await api.deleteHoliday(activeProjectId, id);
      await loadCalendar();
      await api.recalculateProject(activeProjectId);
      await refresh();
    } catch (err) {
      alert('Failed to delete holiday: ' + err.message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Calendar &amp; Governance Settings</h1>
          <div className="breadcrumb">
            Project Working Calendar &bull; Statutory Holidays &bull; Schedule Tolerance Configuration
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Working Days & Tolerance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Project Working Calendar (Rule 6)</div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              All float, variance, and forecast calculations use working-day mathematics based on these rules rather than simple calendar subtraction.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
              {[
                { key: 'working_monday', label: 'Monday (Default: Working)' },
                { key: 'working_tuesday', label: 'Tuesday (Default: Working)' },
                { key: 'working_wednesday', label: 'Wednesday (Default: Working)' },
                { key: 'working_thursday', label: 'Thursday (Default: Working)' },
                { key: 'working_friday', label: 'Friday (Default: Working)' },
                { key: 'working_saturday', label: 'Saturday (Default: Non-Working)' },
                { key: 'working_sunday', label: 'Sunday (Default: Non-Working)' },
              ].map((day) => (
                <label key={day.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!calendarConfig[day.key]}
                    onChange={(e) => setCalendarConfig({ ...calendarConfig, [day.key]: e.target.checked ? 1 : 0 })}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Schedule At-Risk Tolerance (Working Days)</label>
              <input
                type="number"
                min="0"
                max="30"
                className="form-input"
                value={toleranceDays}
                onChange={(e) => setToleranceDays(e.target.value)}
              />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Delays ≤ tolerance are classified as <strong>AT RISK</strong>. Delays &gt; tolerance are classified as <strong>DELAYED</strong>.
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSaveCalendar} disabled={saving}>
              {saving ? 'Saving...' : 'Save & Recalculate Project Schedule'}
            </button>
          </div>
        </div>

        {/* Holidays & Non-Working Days */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Holidays &amp; Blackout Dates</div>
          </div>
          <div className="card-body">
            <div className="grid-3" style={{ marginBottom: 'var(--space-4)', gridTemplateColumns: '1.2fr 1.2fr 0.6fr' }}>
              <input
                type="date"
                className="form-input"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Holiday Name (e.g. Labor Day)"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
              />
              <button className="btn btn-secondary" onClick={handleAddHoliday}>
                + Add
              </button>
            </div>

            <div className="data-table-container" style={{ maxHeight: '350px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Holiday / Non-Working Description</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                        No specific holidays defined. Standard weekends apply.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((h) => (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 600 }}>{h.date}</td>
                        <td>{h.name || 'Statutory Holiday'}</td>
                        <td>{h.type}</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '0.65rem', color: 'var(--color-red)' }}
                            onClick={() => handleDeleteHoliday(h.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
