/**
 * BruClinic — Backup & Restore (Admin Only)
 *
 * Lets an administrator download a complete, checksummed JSON snapshot and
 * restore one safely: validate first (dry run), choose merge or full replace,
 * and review the per-table outcome before leaving the page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Database, Download, FileJson, History,
  RefreshCw, ShieldCheck, Upload,
} from 'lucide-react';
import { apiDownload, apiGet, apiPost } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useClinic } from '../context/ClinicContext';
import type { BackupRestoreSummary, BackupRun, BackupTableStat } from '../types';
import './AdminBackup.css';

type RestoreMode = 'merge' | 'replace';

interface LoadedBackup {
  name: string;
  payload: unknown;
  counts: Record<string, number>;
  createdAt?: string;
  checksum?: string;
}

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The request failed.';
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function totalRows(counts: Record<string, number>) {
  return Object.values(counts).reduce((total, value) => total + Number(value || 0), 0);
}

export default function AdminBackup() {
  const { token } = useAuth();
  const { refresh } = useClinic();
  const fileInput = useRef<HTMLInputElement>(null);

  const [tables, setTables] = useState<BackupTableStat[]>([]);
  const [history, setHistory] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(true);

  const [includeUsers, setIncludeUsers] = useState(true);
  const [includeAudit, setIncludeAudit] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [file, setFile] = useState<LoadedBackup | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [confirmation, setConfirmation] = useState('');
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [validation, setValidation] = useState<BackupRestoreSummary | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<{ data: BackupTableStat[]; history: BackupRun[] }>('/admin/backup/tables', token);
      setTables(response.data);
      setHistory(response.history);
    } catch (cause) {
      setMessage({ type: 'error', text: errorText(cause) });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      await apiDownload(
        `/admin/backup?includeUsers=${includeUsers ? 'true' : 'false'}&includeAudit=${includeAudit ? 'true' : 'false'}`,
        'bruclinic-backup.json',
        token,
      );
      setMessage({ type: 'success', text: 'Snapshot downloaded. Store it somewhere encrypted — it contains patient data and password hashes.' });
      await load();
    } catch (cause) {
      setMessage({ type: 'error', text: errorText(cause) });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (selected?: File) => {
    if (!selected) return;
    setMessage(null);
    setValidation(null);
    try {
      const text = await selected.text();
      const payload = JSON.parse(text);
      if (payload?.format !== 'bruclinic-backup' || !payload?.tables || typeof payload.tables !== 'object') {
        throw new Error('This file is not a BruClinic backup.');
      }
      const counts: Record<string, number> = {};
      for (const [table, rows] of Object.entries(payload.tables)) {
        if (!Array.isArray(rows)) throw new Error(`Table "${table}" is not a valid list of rows.`);
        counts[table] = rows.length;
      }
      setFile({
        name: selected.name,
        payload,
        counts,
        createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : undefined,
        checksum: typeof payload.checksum === 'string' ? payload.checksum : undefined,
      });
      setMode('merge');
      setConfirmation('');
    } catch (cause) {
      setFile(null);
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'Could not read that file.' });
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setMessage(null);
    try {
      const response = await apiPost<{ message: string; data: BackupRestoreSummary }>(
        '/admin/backup/restore',
        { backup: file.payload, mode, dryRun: true },
        token,
      );
      setValidation(response.data);
      setMessage({ type: 'info', text: response.message });
    } catch (cause) {
      setValidation(null);
      setMessage({ type: 'error', text: errorText(cause) });
    } finally {
      setValidating(false);
    }
  };

  const handleRestore = async () => {
    if (!file) return;
    if (mode === 'replace' && confirmation.trim().toUpperCase() !== 'REPLACE') {
      setMessage({ type: 'error', text: 'Type REPLACE to confirm a full restore.' });
      return;
    }
    setRestoring(true);
    setMessage(null);
    try {
      const response = await apiPost<{ message: string; data: BackupRestoreSummary }>(
        '/admin/backup/restore',
        { backup: file.payload, mode, dryRun: false, confirm: confirmation },
        token,
      );
      setValidation(response.data);
      setMessage({ type: 'success', text: response.message });
      setFile(null);
      setConfirmation('');
      if (fileInput.current) fileInput.current.value = '';
      await refresh();
      await load();
    } catch (cause) {
      setMessage({ type: 'error', text: errorText(cause) });
    } finally {
      setRestoring(false);
    }
  };

  const lastExport = history.find(entry => entry.kind === 'export');
  const busy = exporting || validating || restoring;

  return (
    <div className="backup-page">
      <div className="page-header backup-page-header">
        <div>
          <h1 className="page-title">Backup &amp; Restore</h1>
          <p className="page-subtitle">
            Download a complete clinic snapshot or restore one. Every export and import is audited.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={busy || loading}>
          <RefreshCw size={15} className={loading ? 'backup-spin' : ''} /> Refresh
        </button>
      </div>

      {message && (
        <div className={`backup-message ${message.type}`} role="status">
          {message.type === 'error' ? <AlertTriangle size={16} /> : message.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="backup-grid">
        {/* ── Snapshot ─────────────────────────────────────────── */}
        <section className="card backup-card">
          <div className="backup-card-head">
            <div className="backup-icon"><Database size={18} /></div>
            <div>
              <h2>Create snapshot</h2>
              <p>Every core table in one checksummed JSON file.</p>
            </div>
          </div>

          <div className="backup-table-list">
            {tables.map(entry => (
              <div className="backup-table-row" key={entry.table}>
                <span>{entry.label}<code>{entry.table}</code></span>
                <strong>{entry.missing ? 'missing' : entry.rows.toLocaleString()}</strong>
              </div>
            ))}
            {!tables.length && <div className="backup-empty">{loading ? 'Reading table sizes…' : 'No tables available.'}</div>}
          </div>

          <div className="backup-options">
            <label className="backup-option">
              <input type="checkbox" checked={includeUsers} onChange={event => setIncludeUsers(event.target.checked)} />
              <span>
                <strong>Include staff accounts</strong>
                <small>Required for a complete disaster-recovery file. Includes password hashes.</small>
              </span>
            </label>
            <label className="backup-option">
              <input type="checkbox" checked={includeAudit} onChange={event => setIncludeAudit(event.target.checked)} />
              <span>
                <strong>Include audit &amp; security logs</strong>
                <small>Adds historical audit entries; makes the file much larger.</small>
              </span>
            </label>
          </div>

          <div className="backup-actions">
            <button type="button" className="btn btn-primary" onClick={() => void handleExport()} disabled={busy}>
              <Download size={16} /> {exporting ? 'Preparing…' : 'Download backup'}
            </button>
          </div>

          <p className="backup-note">
            <ShieldCheck size={14} />
            {lastExport ? `Last export ${formatWhen(lastExport.created_at)} by ${lastExport.actor || 'an administrator'}.` : 'No export recorded yet.'}
          </p>
        </section>

        {/* ── Restore ──────────────────────────────────────────── */}
        <section className="card backup-card">
          <div className="backup-card-head">
            <div className="backup-icon backup-icon-warn"><Upload size={18} /></div>
            <div>
              <h2>Restore from backup</h2>
              <p>Validate first; nothing is written during a dry run.</p>
            </div>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            id="backup-file"
            className="backup-file-input"
            onChange={event => void handleFileSelected(event.target.files?.[0])}
          />
          <label htmlFor="backup-file" className="backup-dropzone">
            <FileJson size={22} />
            <strong>{file ? file.name : 'Choose a backup file'}</strong>
            <span>{file ? `${totalRows(file.counts).toLocaleString()} rows · created ${formatWhen(file.createdAt)}` : 'JSON files only'}</span>
          </label>

          {file && (
            <>
              <div className="backup-mode-grid">
                <label className={`backup-mode ${mode === 'merge' ? 'selected' : ''}`}>
                  <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                  <span>
                    <strong>Merge</strong>
                    <small>Keep current data and insert or update matching records.</small>
                  </span>
                </label>
                <label className={`backup-mode ${mode === 'replace' ? 'selected' : ''}`}>
                  <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  <span>
                    <strong>Replace</strong>
                    <small>Delete the tables in this file, then load the snapshot.</small>
                  </span>
                </label>
              </div>

              {mode === 'replace' && (
                <div className="backup-warning">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>This replaces live clinic data.</strong>
                    <p>Type <code>REPLACE</code> below to confirm. Your own active administrator account must exist in the file.</p>
                    <input
                      value={confirmation}
                      onChange={event => setConfirmation(event.target.value)}
                      placeholder="REPLACE"
                      aria-label="Type REPLACE to confirm"
                    />
                  </div>
                </div>
              )}

              <div className="backup-actions">
                <button type="button" className="btn btn-secondary" onClick={() => void handleValidate()} disabled={busy}>
                  <ShieldCheck size={15} /> {validating ? 'Validating…' : 'Validate file'}
                </button>
                <button
                  type="button"
                  className={`btn ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => void handleRestore()}
                  disabled={busy || (mode === 'replace' && confirmation.trim().toUpperCase() !== 'REPLACE')}
                >
                  <Upload size={15} /> {restoring ? 'Restoring…' : mode === 'replace' ? 'Replace database' : 'Import backup'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Validation / restore result ─────────────────────────── */}
      {validation && (
        <section className="card backup-card backup-result">
          <div className="backup-card-head">
            <div className="backup-icon backup-icon-ok"><CheckCircle2 size={18} /></div>
            <div>
              <h2>{validation.dryRun ? 'Validation result' : 'Restore result'}</h2>
              <p>
                {validation.dryRun ? 'No changes were written.' : 'Database restored.'} Mode: {validation.mode}. Finished {formatWhen(validation.finishedAt)}.
              </p>
            </div>
          </div>

          {validation.warnings.length > 0 && (
            <ul className="backup-warnings">
              {validation.warnings.map(warning => <li key={warning}><AlertTriangle size={13} /> {warning}</li>)}
            </ul>
          )}

          <div className="backup-table-list">
            {Object.entries(validation.tables)
              .filter(([, result]) => (result.received || 0) > 0 || (result.removed || 0) > 0)
              .map(([table, result]) => (
                <div className="backup-table-row" key={table}>
                  <span>{table}</span>
                  <strong>
                    {result.applied ?? 0} applied
                    {result.removed ? ` · ${result.removed} removed` : ''}
                  </strong>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ── History ────────────────────────────────────────────── */}
      <section className="card backup-card backup-history">
        <div className="backup-card-head">
          <div className="backup-icon"><History size={18} /></div>
          <div>
            <h2>Backup history</h2>
            <p>Exports, validation runs and completed restores.</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Actor</th>
                <th>Rows</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={5} className="backup-empty">No backup activity recorded yet.</td></tr>
              ) : history.map(entry => (
                <tr key={entry.id}>
                  <td>{formatWhen(entry.created_at)}</td>
                  <td>
                    <span className={`backup-kind ${entry.kind}`}>{entry.kind === 'export' ? 'Export' : 'Import'}</span>
                    {entry.mode && <small className="backup-kind-mode">{entry.mode}</small>}
                  </td>
                  <td>{entry.actor || '—'}</td>
                  <td>{totalRows(entry.counts).toLocaleString()}</td>
                  <td>
                    <span className={`backup-status ${entry.status}`}>
                      {entry.dry_run ? 'validated' : entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
