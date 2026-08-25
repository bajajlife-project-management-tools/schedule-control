import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { api } from '../api/client.js';

export default function ImportWizard() {
  const { loadProjects, selectProject } = useProject();
  const [step, setStep] = useState(1); // 1: Upload, 2: Select Sheet, 3: Map Columns, 4: Validate, 5: Review & Import
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [projectManager, setProjectManager] = useState('');
  const [columnMapping, setColumnMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setProjectName(uploadedFile.name.replace(/\.[^/.]+$/, ''));

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      setUploading(true);
      const res = await api.parseExcel(formData);
      setParsedData(res);
      if (res.sheets && res.sheets.length > 0) {
        setSelectedSheetIndex(0);
        // Auto-detect columns for the first sheet
        const detected = await api.detectColumns(res.sheets[0].headers);
        setColumnMapping(detected);
        setStep(3); // jump directly to column mapping
      }
    } catch (err) {
      alert('Failed to parse Excel: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleValidate = async () => {
    if (!parsedData || !parsedData.sheets[selectedSheetIndex]) return;
    const currentSheet = parsedData.sheets[selectedSheetIndex];
    try {
      const res = await api.validateImport(currentSheet.rows, columnMapping);
      setValidationResult(res);
      setStep(4);
    } catch (err) {
      alert('Validation error: ' + err.message);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedData || !parsedData.sheets[selectedSheetIndex]) return;
    const currentSheet = parsedData.sheets[selectedSheetIndex];
    try {
      setImporting(true);
      const res = await api.executeImport({
        projectName: projectName || 'Imported Schedule Project',
        projectManager: projectManager || 'Unassigned PM',
        rows: currentSheet.rows,
        mapping: columnMapping,
        statusDate: new Date().toISOString().split('T')[0],
      });
      alert(`Project "${res.project.name}" imported successfully with ${res.taskCount} tasks and ${res.milestoneCount} milestones!`);
      await loadProjects();
      selectProject(res.project.id);
      window.location.href = '/';
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const requiredFields = [
    { key: 'task_id', label: 'Task / Activity ID' },
    { key: 'milestone', label: 'Milestone / Phase' },
    { key: 'task_name', label: 'Task / Activity Name' },
    { key: 'planned_start', label: 'Planned / Baseline Start' },
    { key: 'planned_end', label: 'Planned / Baseline End' },
  ];

  const optionalFields = [
    { key: 'actual_start', label: 'Actual Start' },
    { key: 'actual_end', label: 'Actual End' },
    { key: 'owner', label: 'Owner / Resource' },
    { key: 'predecessor', label: 'Predecessor(s)' },
    { key: 'successor', label: 'Successor(s)' },
    { key: 'dependency_type', label: 'Dependency Type (FS/SS/FF/SF)' },
  ];

  const currentHeaders = parsedData?.sheets[selectedSheetIndex]?.headers || [];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Excel Project Plan Import Wizard</h1>
          <div className="breadcrumb">
            Transform Basic Excel Schedules into a Full PMP Schedule Control System
          </div>
        </div>
      </div>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        <div className={`wizard-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <div className="wizard-step-number">1</div>
          <span>Upload File</span>
        </div>
        <div className={`wizard-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <div className="wizard-step-number">2</div>
          <span>Select Sheet</span>
        </div>
        <div className={`wizard-step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
          <div className="wizard-step-number">3</div>
          <span>Column Mapping</span>
        </div>
        <div className={`wizard-step ${step === 4 ? 'active' : step > 4 ? 'completed' : ''}`}>
          <div className="wizard-step-number">4</div>
          <span>12-Point PMP Validation</span>
        </div>
        <div className={`wizard-step ${step === 5 ? 'active' : step > 5 ? 'completed' : ''}`}>
          <div className="wizard-step-number">5</div>
          <span>Enrich &amp; Build System</span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <div
            className="upload-zone"
            onClick={() => document.getElementById('file-upload-input').click()}
          >
            <input
              id="file-upload-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div className="upload-zone-icon">📁</div>
            <div className="upload-zone-text">
              <strong>Drag &amp; Drop your Project Plan Excel file here</strong>, or click to browse
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Supports .xlsx, .xls, .csv with basic milestone, task, baseline start/end, and dependency columns
            </div>
          </div>
          {uploading && (
            <div style={{ textAlign: 'center', marginTop: 'var(--space-4)', color: 'var(--color-accent)' }}>
              Parsing workbook structure &amp; detecting columns...
            </div>
          )}
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === 3 && parsedData && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Step 3: Intelligent Column Mapping</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Verify auto-detected columns or manually map your Excel columns
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="grid-2" style={{ marginBottom: 'var(--space-5)' }}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project Manager</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Lead PM"
                  value={projectManager}
                  onChange={(e) => setProjectManager(e.target.value)}
                />
              </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-red)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
              Mandatory Schedule Control Fields
            </div>
            <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
              {requiredFields.map((f) => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label} *</label>
                  <select
                    className="form-select"
                    value={columnMapping[f.key] !== undefined ? columnMapping[f.key] : ''}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [f.key]: e.target.value !== '' ? parseInt(e.target.value) : undefined })}
                  >
                    <option value="">-- Select Column --</option>
                    {currentHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        Column {String.fromCharCode(65 + i)}: {h || `(Column ${i + 1})`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-blue)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
              Optional Execution &amp; Dependency Fields
            </div>
            <div className="grid-2">
              {optionalFields.map((f) => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <select
                    className="form-select"
                    value={columnMapping[f.key] !== undefined ? columnMapping[f.key] : ''}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [f.key]: e.target.value !== '' ? parseInt(e.target.value) : undefined })}
                  >
                    <option value="">-- Not Mapped --</option>
                    {currentHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        Column {String.fromCharCode(65 + i)}: {h || `(Column ${i + 1})`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              ← Back to File
            </button>
            <button className="btn btn-primary" onClick={handleValidate}>
              Run 12-Point PMP Validation →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Validation Summary */}
      {step === 4 && validationResult && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Step 4: PMP Schedule Validation Summary</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Rigorous inspection for invalid dates, circular loops, missing IDs, or dependency breaks
              </div>
            </div>
            {validationResult.errors.length === 0 ? (
              <span style={{ color: 'var(--color-green)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                ✅ ALL 12 VALIDATION CHECKS PASSED
              </span>
            ) : (
              <span style={{ color: 'var(--color-red)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                ⚠️ {validationResult.errors.length} CRITICAL ERROR(S) FOUND
              </span>
            )}
          </div>

          <div className="card-body">
            <div className="grid-3" style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ background: 'var(--color-bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>VALIDATED TASKS</div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {validationResult.tasks.length}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>MILESTONES IDENTIFIED</div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
                  {validationResult.milestoneIds.length}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>WARNINGS</div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: validationResult.warnings.length > 0 ? 'var(--color-amber)' : 'var(--color-green)' }}>
                  {validationResult.warnings.length}
                </div>
              </div>
            </div>

            {/* Error List */}
            {validationResult.errors.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ color: 'var(--color-red)', fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                  Errors to Resolve before Import:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {validationResult.errors.map((err, idx) => (
                    <div key={idx} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-red-bg)', border: '1px solid var(--color-red-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-red)' }}>
                      Row {err.row}: [{err.field}] {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning List */}
            {validationResult.warnings.length > 0 && (
              <div>
                <div style={{ color: 'var(--color-amber)', fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                  Non-Blocking Warnings:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {validationResult.warnings.map((w, idx) => (
                    <div key={idx} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-amber-bg)', border: '1px solid var(--color-amber-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-amber)' }}>
                      Row {w.row || 'General'}: [{w.field}] {w.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)}>
              ← Back to Mapping
            </button>
            <button
              className="btn btn-success"
              onClick={handleExecuteImport}
              disabled={validationResult.errors.length > 0 || importing}
            >
              {importing ? 'Building Schedule System...' : '🚀 Import & Transform to Schedule Control System'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
