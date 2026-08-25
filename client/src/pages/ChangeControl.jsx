import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import Modal from '../components/common/Modal.jsx';
import { api } from '../api/client.js';

export default function ChangeControl() {
  const { dashboardData, activeProjectId, refresh, currentUser } = useProject();
  const [changeRequests, setChangeRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedCR, setSelectedCR] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [formData, setFormData] = useState({
    change_id: '',
    change_type: 'Schedule & Scope',
    description: '',
    reason: '',
    affected_scope: '',
    affected_tasks: '',
    schedule_impact_wd: 0,
    cost_impact: '',
    resource_impact: '',
    proposed_new_baseline: '',
    recommendation: 'Approve formal rebaseline',
  });
  const [saving, setSaving] = useState(false);

  const loadCRs = async () => {
    if (!activeProjectId) return;
    try {
      const list = await api.getChangeRequests({ project_id: activeProjectId });
      setChangeRequests(list || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCRs();
  }, [activeProjectId]);

  const handleOpenCreate = () => {
    setFormData({
      change_id: `CR-${Date.now().toString().slice(-4)}`,
      change_type: 'Schedule & Scope',
      description: '',
      reason: '',
      affected_scope: '',
      affected_tasks: '',
      schedule_impact_wd: 0,
      cost_impact: '',
      resource_impact: '',
      proposed_new_baseline: dashboardData?.kpis?.forecastFinish || '',
      recommendation: 'Approve formal rebaseline',
    });
    setModalOpen(true);
  };

  const handleSaveCR = async () => {
    try {
      setSaving(true);
      await api.createChangeRequest({
        project_id: activeProjectId,
        requested_by: currentUser.display_name,
        original_baseline_finish: dashboardData?.kpis?.originalBaselineFinish,
        current_baseline_finish: dashboardData?.kpis?.currentBaselineFinish,
        ...formData,
      });
      await loadCRs();
      await refresh();
      setModalOpen(false);
      alert('Formal Change Request submitted.');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedCR) return;
    try {
      setSaving(true);
      await api.approveChangeRequest(selectedCR.id, {
        approver: currentUser.display_name,
        decision_notes: decisionNotes,
      });
      await loadCRs();
      await refresh();
      setApproveModalOpen(false);
      alert('Change Request Approved. Current Baseline updated and baseline version snapshot created. Original Baseline preserved.');
    } catch (err) {
      alert('Approval failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedCR) return;
    try {
      setSaving(true);
      await api.rejectChangeRequest(selectedCR.id, {
        approver: currentUser.display_name,
        decision_notes: decisionNotes,
      });
      await loadCRs();
      await refresh();
      setApproveModalOpen(false);
    } catch (err) {
      alert('Reject failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Change Control &amp; Rebaseline Governance</h1>
          <div className="breadcrumb">
            Formal Change Control &bull; Baseline Versioning &bull; Impact Assessment (Rules 5, 6, 7)
          </div>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            + Raise Rebaseline Request
          </button>
        </div>
      </div>

      {/* Governance Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(15, 23, 42, 0.9))',
        border: '1px solid var(--color-blue-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-6)'
      }}>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase' }}>
          REBASELINE GOVERNANCE CHARTER
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
          A missed milestone or delay does <strong>not</strong> trigger an automatic rebaseline. Current Baseline changes require formal Change Control approval, retaining the immutable Original Baseline, historical variance, and an auditable approval snapshot.
        </div>
      </div>

      {/* Change Requests Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Change Requests &amp; Rebaseline Register</div>
        </div>
        <div className="data-table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Change ID</th>
                <th>Request Date</th>
                <th>Requested By</th>
                <th>Description</th>
                <th>Reason</th>
                <th>Proposed New BL</th>
                <th className="cell-number">Schedule Impact (WD)</th>
                <th>Status</th>
                <th>Approver</th>
                <th>Effective Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No change requests or rebaselines logged for this project.
                  </td>
                </tr>
              ) : (
                changeRequests.map((cr) => (
                  <tr key={cr.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{cr.change_id}</td>
                    <td>{cr.request_date}</td>
                    <td>{cr.requested_by}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                      {cr.description}
                    </td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--font-size-xs)' }}>
                      {cr.reason}
                    </td>
                    <td style={{ color: 'var(--color-blue)', fontWeight: 600 }}>
                      {cr.proposed_new_baseline || '—'}
                    </td>
                    <td className="cell-number" style={{ color: cr.schedule_impact_wd > 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                      {cr.schedule_impact_wd > 0 ? `+${cr.schedule_impact_wd} WD` : '0 WD'}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: 'var(--font-size-xs)',
                        background: cr.approval_status === 'Approved' ? 'var(--color-green-bg)' : (cr.approval_status === 'Rejected' ? 'var(--color-red-bg)' : 'var(--color-amber-bg)'),
                        color: cr.approval_status === 'Approved' ? 'var(--color-green)' : (cr.approval_status === 'Rejected' ? 'var(--color-red)' : 'var(--color-amber)')
                      }}>
                        {cr.approval_status}
                      </span>
                    </td>
                    <td>{cr.approver || '—'}</td>
                    <td>{cr.effective_date || '—'}</td>
                    <td>
                      {cr.approval_status === 'Draft' || cr.approval_status === 'Pending Approval' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.65rem' }}
                          onClick={() => {
                            setSelectedCR(cr);
                            setDecisionNotes('');
                            setApproveModalOpen(true);
                          }}
                        >
                          Review &amp; Decide
                        </button>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Decided</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Change Request Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Raise Formal Rebaseline / Change Request"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveCR} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit for PMO Approval'}
            </button>
          </>
        }
      >
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Change Request ID</label>
            <input
              type="text"
              className="form-input"
              value={formData.change_id}
              onChange={(e) => setFormData({ ...formData, change_id: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Change Category</label>
            <select
              className="form-select"
              value={formData.change_type}
              onChange={(e) => setFormData({ ...formData, change_type: e.target.value })}
            >
              <option value="Approved Scope Change">Approved Scope Change</option>
              <option value="Strategic Priority Shift">Strategic Priority Shift</option>
              <option value="Material Dependency Change">Material Dependency Change</option>
              <option value="Resource / Delivery Model Change">Resource / Delivery Model Change</option>
              <option value="Major Planning Assumption Invalidated">Major Planning Assumption Invalidated</option>
              <option value="External Mandate / Regulatory">External Mandate / Regulatory</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Change Title &amp; Description</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Ingestion pipeline scope expansion approved by Steering Committee"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Formal Business Justification (Rule 26: 'Task is late' is invalid)</label>
          <textarea
            className="form-textarea"
            placeholder="Provide formal justification, steering committee approval references, or contract addendum..."
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Proposed New Baseline Finish</label>
            <input
              type="date"
              className="form-input"
              value={formData.proposed_new_baseline}
              onChange={(e) => setFormData({ ...formData, proposed_new_baseline: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Schedule Impact (Working Days)</label>
            <input
              type="number"
              className="form-input"
              value={formData.schedule_impact_wd}
              onChange={(e) => setFormData({ ...formData, schedule_impact_wd: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Affected Activities / WBS IDs (comma-separated)</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 2.1, 2.2, 3.1"
            value={formData.affected_tasks}
            onChange={(e) => setFormData({ ...formData, affected_tasks: e.target.value })}
          />
        </div>
      </Modal>

      {/* Decision / Approval Modal */}
      {selectedCR && (
        <Modal
          isOpen={approveModalOpen}
          onClose={() => setApproveModalOpen(false)}
          title={`PMO Governance Decision: ${selectedCR.change_id}`}
          footer={
            <>
              <button className="btn btn-danger" onClick={handleReject} disabled={saving}>
                Reject Request
              </button>
              <button className="btn btn-success" onClick={handleApprove} disabled={saving}>
                {saving ? 'Processing...' : 'Approve & Apply Rebaseline'}
              </button>
            </>
          }
        >
          <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
            <p><strong>Description:</strong> {selectedCR.description}</p>
            <p><strong>Justification:</strong> {selectedCR.reason}</p>
            <p><strong>Proposed New Finish:</strong> {selectedCR.proposed_new_baseline}</p>
            <p><strong>Schedule Impact:</strong> {selectedCR.schedule_impact_wd} WD</p>

            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">Steering Decision Notes / Conditions</label>
              <textarea
                className="form-textarea"
                placeholder="Record formal steering committee decision, approver details, or conditions..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
              />
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-blue-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>
              ℹ️ Approving will update <strong>Current Baseline</strong> to <strong>{selectedCR.proposed_new_baseline}</strong>, snapshot the previous baseline, and preserve the original commitment in perpetuity.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
