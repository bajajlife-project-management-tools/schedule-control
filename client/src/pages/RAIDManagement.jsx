import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import Modal from '../components/common/Modal.jsx';
import { api } from '../api/client.js';

export default function RAIDManagement() {
  const { dashboardData, activeProjectId, refresh, currentUser } = useProject();
  const [selectedType, setSelectedType] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    type: 'Risk',
    raid_id: '',
    description: '',
    probability: 'Medium',
    impact: 'Medium',
    owner: '',
    due_date: '',
    mitigation: '',
    linked_schedule_id: '',
    rebaseline_trigger: false,
    status: 'Open',
  });
  const [saving, setSaving] = useState(false);

  const raidItems = dashboardData?.raidItems || [];
  const tasks = dashboardData?.tasks || [];

  const filteredItems = raidItems.filter((r) => {
    if (selectedType !== 'ALL' && r.type !== selectedType) return false;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      type: 'Risk',
      raid_id: `RAID-${Date.now().toString().slice(-4)}`,
      description: '',
      probability: 'Medium',
      impact: 'Medium',
      owner: currentUser.display_name,
      due_date: '',
      mitigation: '',
      linked_schedule_id: '',
      rebaseline_trigger: false,
      status: 'Open',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      raid_id: item.raid_id,
      description: item.description,
      probability: item.probability || 'Medium',
      impact: item.impact || 'Medium',
      owner: item.owner || '',
      due_date: item.due_date || '',
      mitigation: item.mitigation || '',
      linked_schedule_id: item.linked_schedule_id || '',
      rebaseline_trigger: item.rebaseline_trigger ? true : false,
      status: item.status || 'Open',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingItem) {
        await api.updateRAID(editingItem.id, formData);
      } else {
        await api.createRAID({
          project_id: activeProjectId,
          ...formData,
        });
      }
      await refresh();
      setModalOpen(false);
    } catch (err) {
      alert('Failed to save RAID item: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this RAID item?')) return;
    try {
      await api.deleteRAID(id);
      await refresh();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>RAID &amp; Schedule Assurance</h1>
          <div className="breadcrumb">
            Risks &bull; Assumptions &bull; Issues &bull; Dependencies &bull; Schedule Linkage
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            + Log RAID Item
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        {['ALL', 'Risk', 'Issue', 'Dependency', 'Assumption'].map((t) => (
          <div
            key={t}
            className={`tab ${selectedType === t ? 'active' : ''}`}
            onClick={() => setSelectedType(t)}
          >
            {t === 'ALL' ? `All Items (${raidItems.length})` : `${t}s (${raidItems.filter(r => r.type === t).length})`}
          </div>
        ))}
      </div>

      {/* RAID Table */}
      <div className="card">
        <div className="data-table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Probability</th>
                <th>Impact</th>
                <th>Owner</th>
                <th>Due Date</th>
                <th>Mitigation / Recovery</th>
                <th>Linked Task</th>
                <th>Rebaseline Trigger?</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No RAID items logged under this category.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const linkedTask = tasks.find(t => t.task_id === item.linked_schedule_id);
                  const isCriticalRisk = (item.impact === 'High' || item.impact === 'Critical') && linkedTask?.is_critical_path;

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{item.raid_id}</td>
                      <td>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          background: item.type === 'Risk' ? 'var(--color-amber-bg)' : (item.type === 'Issue' ? 'var(--color-red-bg)' : 'var(--color-blue-bg)'),
                          color: item.type === 'Risk' ? 'var(--color-amber)' : (item.type === 'Issue' ? 'var(--color-red)' : 'var(--color-blue)')
                        }}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }} title={item.description}>
                        {item.description}
                      </td>
                      <td>{item.probability || '—'}</td>
                      <td>
                        <span style={{
                          fontWeight: 600,
                          color: item.impact === 'Critical' || item.impact === 'High' ? 'var(--color-red)' : (item.impact === 'Medium' ? 'var(--color-amber)' : 'var(--color-green)')
                        }}>
                          {item.impact}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{item.owner || '—'}</td>
                      <td>{item.due_date || '—'}</td>
                      <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--font-size-xs)' }}>
                        {item.mitigation || '—'}
                      </td>
                      <td>
                        {item.linked_schedule_id ? (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isCriticalRisk ? 'var(--color-red-bg)' : 'var(--color-bg-tertiary)',
                            color: isCriticalRisk ? 'var(--color-red)' : 'var(--color-text-primary)',
                            fontWeight: isCriticalRisk ? 700 : 500,
                            fontSize: 'var(--font-size-xs)'
                          }}>
                            {item.linked_schedule_id} {isCriticalRisk ? '⚡ CP RISK' : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.rebaseline_trigger ? (
                          <span style={{ color: 'var(--color-amber)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>⚠️ YES</span>
                        ) : 'No'}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          background: item.status === 'Closed' || item.status === 'Mitigated' ? 'var(--color-green-bg)' : 'var(--color-bg-tertiary)',
                          color: item.status === 'Closed' || item.status === 'Mitigated' ? 'var(--color-green)' : 'var(--color-text-primary)'
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.65rem' }} onClick={() => handleOpenEdit(item)}>
                            Edit
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.65rem', color: 'var(--color-red)' }} onClick={() => handleDelete(item.id)}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit RAID Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? `Edit RAID Item: ${editingItem.raid_id}` : 'Log New RAID Item'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save RAID Item'}
            </button>
          </>
        }
      >
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">RAID Type</label>
            <select
              className="form-select"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="Risk">Risk</option>
              <option value="Issue">Issue</option>
              <option value="Dependency">Dependency</option>
              <option value="Assumption">Assumption</option>
              <option value="Change Request">Change Request</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">RAID ID / Tag</label>
            <input
              type="text"
              className="form-input"
              value={formData.raid_id}
              onChange={(e) => setFormData({ ...formData, raid_id: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            placeholder="Detailed description of the risk, assumption, issue or dependency..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Probability</label>
            <select
              className="form-select"
              value={formData.probability}
              onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Impact</label>
            <select
              className="form-select"
              value={formData.impact}
              onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Owner</label>
            <input
              type="text"
              className="form-input"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target / Due Date</label>
            <input
              type="date"
              className="form-input"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Mitigation / Recovery Strategy</label>
          <textarea
            className="form-textarea"
            placeholder="Actionable mitigation, contingency, or recovery plan..."
            value={formData.mitigation}
            onChange={(e) => setFormData({ ...formData, mitigation: e.target.value })}
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Linked Activity ID (WBS)</label>
            <select
              className="form-select"
              value={formData.linked_schedule_id}
              onChange={(e) => setFormData({ ...formData, linked_schedule_id: e.target.value })}
            >
              <option value="">None (Project Wide)</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.task_id}>
                  {t.task_id} - {t.name} {t.is_critical_path ? '(Critical)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Open">Open</option>
              <option value="Monitoring">Monitoring</option>
              <option value="Mitigated">Mitigated</option>
              <option value="Closed">Closed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-amber)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.rebaseline_trigger}
              onChange={(e) => setFormData({ ...formData, rebaseline_trigger: e.target.checked })}
            />
            This item is a potential Rebaseline Trigger (Material scope/dependency impact)
          </label>
        </div>
      </Modal>
    </div>
  );
}
