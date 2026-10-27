import React, { useEffect, useState } from 'react';
import { Clock, Upload, CheckCircle2, FileText, RefreshCw } from 'lucide-react';
import { api } from '../../api';

const card = { background: 'rgba(18,24,38,.72)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 14, padding: 20, color: '#e2e8f0' };

export function CourseLabs({ courseId }) {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [forms, setForms] = useState({});
  const [files, setFiles] = useState({});
  const [busyId, setBusyId] = useState('');
  const [, setTick] = useState(0);

  const refresh = async () => {
    setLoading(true); setError('');
    try { setLabs(await api.getCourseLabs(courseId)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [courseId]);
  useEffect(() => { const timer = setInterval(() => setTick(value => value + 1), 1000); return () => clearInterval(timer); }, []);
  const setForm = (labId, field, value) => setForms(current => ({ ...current, [labId]: { ...(current[labId] || {}), [field]: value } }));
  const chooseFile = (labId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const supported = ['text/plain', 'text/markdown', 'text/javascript', 'application/javascript', 'application/json', 'application/pdf', 'application/zip', 'text/x-python'];
    if (!supported.includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Upload a text/code, PDF, JSON or ZIP file up to 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setFiles(current => ({ ...current, [labId]: { fileName: file.name, mimeType: file.type, fileData: String(reader.result || '') } })); setError(''); };
    reader.onerror = () => setError('Could not read that file. Try again.');
    reader.readAsDataURL(file);
  };
  const submit = async lab => {
    const id = String(lab.id);
    const form = forms[id] || {};
    setBusyId(id); setError(''); setNotice('');
    try {
      await api.submitCourseLab(courseId, id, { content: form.content || '', ...(files[id] || {}) });
      setNotice(`Work submitted for “${lab.title}”.`);
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusyId(''); }
  };
  const countdown = dueAt => {
    const seconds = Math.max(0, Math.floor((new Date(dueAt).getTime() - Date.now()) / 1000));
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
  };

  if (loading) return <div style={{ color: '#94a3b8', padding: 24 }}>Loading lab tasks…</div>;
  return <section style={{ display: 'grid', gap: 14 }}>
    <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ margin: '0 0 5px' }}>Timed lab tasks</h2><span style={{ color: '#94a3b8' }}>Upload your team’s work before the timer ends. Faculty can open and review submissions.</span></div><button className="btn btn-secondary" onClick={refresh}><RefreshCw size={15} /> Refresh</button></div>
    {error && <div role="alert" style={{ ...card, color: '#fda4af', borderColor: '#be123c' }}>{error}</div>}{notice && <div role="status" style={{ ...card, color: '#6ee7b7', borderColor: '#059669' }}>{notice}</div>}
    {!labs.length && <div style={card}>No timed lab tasks have been assigned to this class yet.</div>}
    {labs.map(lab => { const closed = lab.status === 'closed'; const current = forms[String(lab.id)] || {}; const submitted = Boolean(lab.submission); return <article key={lab.id} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 800 }}>{lab.durationMinutes / 60}-HOUR LAB</span><h3 style={{ margin: '6px 0' }}>{lab.title}</h3></div><strong style={{ color: closed ? '#fda4af' : '#fbbf24' }}><Clock size={15} /> {closed ? 'Closed' : countdown(lab.dueAt)}</strong></div>
      <p style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>{lab.instructions}</p>
      {lab.teamName ? <div style={{ color: '#94a3b8', marginBottom: 12 }}>Team #{lab.teamNumber || '—'} · {lab.teamName}</div> : <div style={{ color: '#fbbf24', marginBottom: 12 }}>Join a team before submitting lab work.</div>}
      {submitted && <div style={{ color: lab.submission.status === 'Needs revision' ? '#fbbf24' : '#6ee7b7', marginBottom: 10 }}><CheckCircle2 size={16} /> {lab.submission.status} · {new Date(lab.submission.submittedAt).toLocaleString()}{lab.submission.feedback ? ` · ${lab.submission.feedback}` : ''}</div>}
      {lab.submission?.fileName && <div style={{ color: '#94a3b8', marginBottom: 8 }}><FileText size={15} /> Uploaded: {lab.submission.fileName}</div>}
      {lab.teamName && !closed && <><label style={{ display: 'block' }}>Written answer / notes<textarea value={current.content || ''} onChange={event => setForm(lab.id, 'content', event.target.value)} maxLength={20000} rows={5} placeholder="Describe your solution or paste a short code response…" style={{ width: '100%', marginTop: 7, borderRadius: 8, padding: 12, background: '#0b1220', border: '1px solid #334155', color: '#e2e8f0' }} /></label><label style={{ display: 'block', marginTop: 10 }}>Attach code or work file<input type="file" accept=".txt,.md,.js,.jsx,.ts,.py,.json,.pdf,.zip" onChange={event => chooseFile(lab.id, event)} style={{ display: 'block', marginTop: 7 }} />{files[String(lab.id)]?.fileName && <small style={{ color: '#38bdf8' }}>Ready: {files[String(lab.id)].fileName}</small>}</label><button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => submit(lab)} disabled={busyId === String(lab.id)}><Upload size={15} /> {submitted ? 'Update submission' : 'Submit team work'}</button></>}
    </article>; })}
  </section>;
}
