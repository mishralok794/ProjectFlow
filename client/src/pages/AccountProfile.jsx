import React, { useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const inputStyle = { width: '100%', background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 9, padding: '10px 12px', marginTop: 6 };

export function AccountProfile() {
  const { user, updateProfile } = useAuth();
  const isStudent = (user?.role || '').toLowerCase() === 'student';
  const [form, setForm] = useState({ name: user?.name || '', department: user?.department || '', rollNumber: user?.rollNumber || '', batch: user?.batch || '', avatarUrl: user?.avatarUrl || '', gender: user?.gender || 'Prefer not to say', designation: user?.designation || '', bio: user?.bio || '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const save = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try { updateProfile(await api.updateMyProfile(form)); setMessage('Profile saved.'); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  return <form onSubmit={save} className="glass-panel" style={{ maxWidth: 760, margin: '20px auto', padding: 28, color: '#e2e8f0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>{form.avatarUrl ? <img src={form.avatarUrl} alt="Profile" style={{ width: 62, height: 62, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 62, height: 62, display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#0369a1' }}><UserRound /></div>}<div><h2 style={{ margin: 0, color: 'white' }}>Your profile</h2><span style={{ color: '#94a3b8' }}>{user?.email} · {user?.institutionId || 'Institution not linked'}</span></div></div>
    {error && <p role="alert" style={{ color: '#fda4af' }}>{error}</p>}{message && <p role="status" style={{ color: '#6ee7b7' }}>{message}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>{[['name','Full name'],['department','Department / branch'], ...(isStudent ? [['rollNumber','Roll number'],['batch','Batch']] : [['designation','Designation']]), ['avatarUrl','Profile picture URL']].map(([key,label]) => <label key={key}>{label}<input style={inputStyle} value={form[key]} onChange={e => update(key,e.target.value)} /></label>)}{isStudent && <label>Gender<select style={inputStyle} value={form.gender} onChange={e => update('gender',e.target.value)}>{['Prefer not to say','Female','Male','Non-binary'].map(value => <option key={value}>{value}</option>)}</select></label>}</div>
    {!isStudent && <label style={{ display: 'block', marginTop: 14 }}>About / teaching areas<textarea style={{ ...inputStyle, minHeight: 100 }} value={form.bio} onChange={e => update('bio',e.target.value)} /></label>}
    <button type="submit" className="btn btn-primary" style={{ marginTop: 18 }} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save profile'}</button>
  </form>;
}
