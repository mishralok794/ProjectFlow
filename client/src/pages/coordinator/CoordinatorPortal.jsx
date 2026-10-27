import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Activity, ArrowLeft, ArrowRight, BookOpen, Building2, CalendarDays, CheckCircle2,
  ClipboardList, Globe2, GraduationCap, MapPin, Plus, RefreshCw, School, Users
} from 'lucide-react';

const emptyInstitution = { name: '', type: 'college', city: '', state: '', country: '', address: '', website: '', description: '', logoUrl: '', coverUrl: '', videoUrl: '', galleryUrls: '', galleryUploads: [] };

function institutionPayload(form) {
  const { galleryUrls = '', galleryUploads = [], ...details } = form;
  details.gallery = [
    ...galleryUrls.split(',').map(url => url.trim()).filter(Boolean),
    ...galleryUploads.map(url => ({ url, mediaType: 'image' }))
  ];
  return details;
}

function readMediaFile(file, kind) {
  const maxBytes = kind === 'video' ? 4 * 1024 * 1024 : 2 * 1024 * 1024;
  const accepted = kind === 'video' ? ['video/mp4', 'video/webm'] : ['image/png', 'image/jpeg', 'image/webp'];
  if (!accepted.includes(file.type)) throw new Error(kind === 'video' ? 'Choose an MP4 or WebM video.' : 'Choose a PNG, JPEG, or WebP image.');
  if (file.size > maxBytes) throw new Error(`${kind === 'video' ? 'Video' : 'Image'} must be ${kind === 'video' ? '4' : '2'} MB or smaller.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read this file. Please try another.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlByteLength(value) {
  const payload = String(value).slice(String(value).indexOf(',') + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor(payload.length * 3 / 4) - padding;
}

function Field({ label, children }) {
  return <label className="coord-field"><span>{label}</span>{children}</label>;
}

function PublicInstitutionPage({ institutionId }) {
  const { user } = useAuth();
  const [institution, setInstitution] = useState(null);
  const [error, setError] = useState('');
  const [slide, setSlide] = useState(0);
  const [membership, setMembership] = useState('none');
  const [membershipBranchId, setMembershipBranchId] = useState('');
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState('');
  useEffect(() => {
    api.getInstitution(institutionId).then(setInstitution).catch(err => setError(err.message));
  }, [institutionId]);
  useEffect(() => {
    if (['faculty', 'student'].includes(user?.role?.toLowerCase())) api.getInstitutionMembership(institutionId).then(result => setMembership(result.status)).catch(() => {});
  }, [institutionId, user?.role]);
  const requestMembership = async () => {
    setMembershipBusy(true); setMembershipMessage('');
    try { const result = await api.requestInstitutionMembership(institutionId, membershipBranchId); setMembership(result.status); setMembershipMessage(result.message); }
    catch (err) { setMembershipMessage(err.message); }
    finally { setMembershipBusy(false); }
  };
  const images = useMemo(() => [institution?.coverUrl, ...(institution?.gallery || []).map(item => typeof item === 'string' ? item : item.url)].filter(Boolean), [institution]);
  if (error) return <section className="coord-public-shell"><p role="alert">{error}</p><a href="/">Return to ProjectFlow</a></section>;
  if (!institution) return <section className="coord-public-shell" aria-live="polite">Loading institution profile…</section>;
  return (
    <main className="coord-public-shell">
      <a className="coord-back-link" href="/">← ProjectFlow</a>
      <section className="coord-public-hero" style={images[slide] ? { backgroundImage: `linear-gradient(90deg, rgba(9,13,22,.94), rgba(9,13,22,.30)), url("${images[slide]}")` } : undefined}>
        <div className="coord-public-identity">
          {institution.logoUrl ? <img className="coord-institution-logo" src={institution.logoUrl} alt={`${institution.name} logo`} /> : <div className="coord-institution-logo coord-logo-fallback"><Building2 /></div>}
          <div><span className="coord-eyebrow">{institution.type} profile</span><h1>{institution.name}</h1><p><MapPin size={16} /> {[institution.city, institution.state, institution.country].filter(Boolean).join(', ') || 'Location not provided'}</p></div>
          {['faculty', 'student'].includes(user?.role?.toLowerCase()) && <div className="coord-membership-action"><select aria-label="Choose your branch" value={membershipBranchId} onChange={event => setMembershipBranchId(event.target.value)} disabled={['pending', 'approved'].includes(membership)}><option value="">Choose branch</option>{(institution.branches || []).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><button className="btn btn-primary" disabled={membershipBusy || ['pending', 'approved'].includes(membership) || !membershipBranchId} onClick={requestMembership}>{membershipBusy ? 'Sending…' : membership === 'pending' ? 'Request pending' : membership === 'approved' ? 'Institution member' : membership === 'rejected' ? 'Request again' : 'Request to join'}</button>{membershipMessage && <small role="status">{membershipMessage}</small>}</div>}
        </div>
        {images.length > 1 && <div className="coord-carousel-controls"><button aria-label="Previous image" onClick={() => setSlide((slide + images.length - 1) % images.length)}><ArrowLeft /></button><span>{slide + 1} / {images.length}</span><button aria-label="Next image" onClick={() => setSlide((slide + 1) % images.length)}><ArrowRight /></button></div>}
      </section>
      {!images.length && <div className="coord-empty-gallery"><Building2 /><span>No campus photographs have been published yet.</span></div>}
      {institution.videoUrl && <section className="coord-panel coord-public-video"><span className="coord-eyebrow">Campus video</span><h2>A short look around</h2><video src={institution.videoUrl} controls playsInline preload="metadata" aria-label={`${institution.name} campus video`} /></section>}
      <div className="coord-public-grid">
        <section className="coord-panel coord-public-about"><span className="coord-eyebrow">About the institution</span><h2>Learning, research and community</h2><p>{institution.description || 'This institution has not published an overview yet.'}</p>{institution.website && <a href={institution.website} target="_blank" rel="noreferrer"><Globe2 size={16} /> Official website</a>}</section>
        <section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">Academic structure</span><h2>Branches & programs</h2></div><span className="coord-count">{institution.branches?.length || 0}</span></div>{institution.branches?.length ? <div className="coord-program-list">{institution.branches.map(branch => <article key={branch.id}><School size={18} /><div><strong>{branch.name}</strong><small>{branch.code || 'Branch'}{branch.programs?.length ? ` · ${branch.programs.join(', ')}` : ''}</small></div></article>)}</div> : <p className="coord-muted">Academic programs have not been published.</p>}</section>
        <section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">Institution leadership</span><h2>Coordinators</h2></div><span className="coord-count">{institution.coordinatorCount || 0}</span></div>{institution.coordinators?.length ? <div className="coord-people-list">{institution.coordinators.map(person => <article key={person.id}><div className="coord-avatar">{person.name?.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><div><strong>{person.name}</strong><small>{person.designation || 'Institution coordinator'}{person.department ? ` · ${person.department}` : ''}</small>{person.bio && <p>{person.bio}</p>}</div></article>)}</div> : <p className="coord-muted">No public coordinator profiles are available.</p>}</section>
        <section className="coord-panel"><span className="coord-eyebrow">Placement information</span><h2>Published reports</h2><p className="coord-muted">Placement information has not been published by this institution.</p></section>
      </div>
    </main>
  );
}

export { PublicInstitutionPage };

export function InstitutionDirectoryPage() {
  const [search, setSearch] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => api.getInstitutions(search).then(rows => { if (active) setInstitutions([...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }), 180);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);
  return <main className="coord-public-shell"><a className="coord-back-link" href="/">← ProjectFlow</a><div className="coord-page-head"><div><span className="coord-eyebrow">PROJECTFLOW DIRECTORY</span><h1>Find your institution</h1><p>Browse institution profiles and their published academic programs.</p></div></div><label className="coord-directory-search"><span className="sr-only">Search institutions</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, college, school or location" /></label>{search.trim() && !loading && institutions.length > 0 && <div className="coord-institution-suggestions" role="listbox" aria-label="Matching institutions">{institutions.slice(0, 8).map(row => <a role="option" aria-selected="false" key={`suggest-${row.id}`} href={`/institutions/${row.id}`}><span>{row.name}</span><small>{row.type} · {[row.city, row.state].filter(Boolean).join(', ') || 'Location not provided'}</small></a>)}</div>}{error && <div className="coord-alert coord-alert-error" role="alert">{error}</div>}{loading ? <p className="coord-muted">Searching institutions…</p> : institutions.length ? <div className="coord-directory-grid">{institutions.map(row => <a className="coord-directory-card" key={row.id} href={`/institutions/${row.id}`}><div className="coord-directory-cover" style={row.coverUrl ? { backgroundImage: `linear-gradient(90deg,rgba(9,13,22,.4),rgba(9,13,22,.05)),url("${row.coverUrl}")` } : undefined}>{row.logoUrl ? <img src={row.logoUrl} alt="" /> : <Building2 />}</div><span className="coord-eyebrow">{row.type}</span><h2>{row.name}</h2><p><MapPin size={14} /> {[row.city, row.state, row.country].filter(Boolean).join(', ') || 'Location not provided'}</p><span className="coord-directory-cta">View profile <ArrowRight size={15} /></span></a>)}</div> : <section className="coord-panel"><h2>No matching institutions</h2><p className="coord-muted">Try a different name, or ask an authorized coordinator to create the institution profile.</p></section>}</main>;
}

export function CoordinatorPortal({ activeTab, user }) {
  const [overview, setOverview] = useState(null);
  const [branches, setBranches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [institutionForm, setInstitutionForm] = useState(emptyInstitution);
  const [branchForm, setBranchForm] = useState({ name: '', code: '', programs: '' });
  const [sessionForm, setSessionForm] = useState({ name: '', startYear: '', endYear: '' });
  const [batchForm, setBatchForm] = useState({ name: '', branchId: '', sessionId: '', cohortYear: '', description: '' });
  const [membershipRequests, setMembershipRequests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [courseForm, setCourseForm] = useState({ name: '', code: '', branchId: '', batchId: '', sessionId: '', semester: '', description: '' });
  const [assignmentForm, setAssignmentForm] = useState({ courseId: '', facultyId: '' });
  const [editingInstitution, setEditingInstitution] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [summary, branchRows, sessionRows, batchRows, requests, courseRows, assignmentRows] = await Promise.all([
        api.getCoordinatorOverview(), api.getCoordinatorBranches(), api.getCoordinatorSessions(), api.getCoordinatorBatches(), api.getCoordinatorMemberships(), api.getCoordinatorCourses(), api.getCoordinatorAssignments()
      ]);
      setOverview(summary); setBranches(branchRows); setSessions(sessionRows); setBatches(batchRows); setMembershipRequests(requests);
      setCourses(courseRows); setAssignments(assignmentRows);
      if (summary.institution) setInstitutionForm({ ...emptyInstitution, ...summary.institution, galleryUrls: (summary.institution.gallery || []).filter(item => typeof item === 'string' || !String(item.url || '').startsWith('data:')).map(item => typeof item === 'string' ? item : item.url).join(', '), galleryUploads: (summary.institution.gallery || []).filter(item => typeof item !== 'string' && String(item.url || '').startsWith('data:')).map(item => item.url) });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const save = async (action, message, reset) => {
    setBusy(true); setError(''); setSuccess('');
    try { const result = await action(); reset?.(); setSuccess(typeof message === 'function' ? message(result) : message); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const institution = overview?.institution;
  const pageMap = {
    'coordinator-overview': ['Your institution, at a glance', 'A clear view of your academic setup and recent activity.'],
    'coordinator-institution': ['Institution profile', 'Set up the official profile shown to your community.'],
    'coordinator-branches': ['Branches & programs', 'Organize departments and the programs each branch offers.'],
    'coordinator-courses': ['Courses & subjects', 'Create institution courses using the existing ProjectFlow course model.'],
    'coordinator-sessions': ['Academic sessions', 'Manage the academic calendar for your institution.'],
    'coordinator-batches': ['Batches', 'Create cohorts and keep their branch and session connected.'],
    'coordinator-batch-details': [selectedBatch?.name || 'Batch details', 'View courses and faculty allocations for this cohort.'],
    'coordinator-faculty': ['Faculty directory', 'Faculty associated with your institution.'],
    'coordinator-messages': ['Branch messages', 'Send announcements to faculty, students, or everyone in a selected branch.'],
    'coordinator-assignments': ['Faculty assignments', 'Connect institution faculty with a course and batch.'],
    'coordinator-coordinators': ['Coordinator directory', 'People with coordinator access at your institution.'],
    'coordinator-activity': ['Activity & monitoring', 'Recent changes within your authorized scope.']
  };
  const [title, subtitle] = pageMap[activeTab] || pageMap['coordinator-overview'];

  if (loading && !overview) return <div className="coord-loading" role="status"><RefreshCw className="coord-spin" /> Loading your coordinator workspace…</div>;
  return (
    <div className="coord-page">
      <div className="coord-page-head"><div><span className="coord-eyebrow">COORDINATOR WORKSPACE</span><h1>{title}</h1><p>{subtitle}</p></div><button className="btn btn-secondary" onClick={refresh} aria-label="Refresh coordinator data"><RefreshCw size={16} /> Refresh</button></div>
      {error && <div className="coord-alert coord-alert-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {success && <div className="coord-alert coord-alert-success" role="status"><CheckCircle2 size={17} />{success}<button onClick={() => setSuccess('')} aria-label="Dismiss message">×</button></div>}

      {activeTab === 'coordinator-overview' && <>
        {!institution ? <section className="coord-panel coord-setup-banner"><div className="coord-setup-icon"><Building2 /></div><div><span className="coord-eyebrow">FIRST STEP</span><h2>Set up your institution</h2><p>Create its official profile, then add branches, academic sessions and batches as you are ready.</p></div><button className="btn btn-primary" onClick={() => document.getElementById('institution-setup')?.scrollIntoView({ behavior: 'smooth' })}><Plus size={16} /> Create institution</button></section> : <section className="coord-welcome"><div className="coord-welcome-copy"><span className="coord-eyebrow">{institution.type} · {institution.city || 'Institution workspace'}</span><h2>Welcome back, {user?.name?.split(' ')[0] || 'Coordinator'}.</h2><p>{institution.name} is ready for your next setup step.</p></div><div className="coord-welcome-mark"><Building2 /></div></section>}
        <div className="coord-stat-grid">
          {[['Branches', overview?.stats?.branches || 0, School, 'coordinator-branches'], ['Courses', courses.length, BookOpen, 'coordinator-courses'], ['Academic sessions', overview?.stats?.sessions || 0, CalendarDays, 'coordinator-sessions'], ['Batches', overview?.stats?.batches || 0, ClipboardList, 'coordinator-batches'], ['Faculty', overview?.stats?.faculty || 0, Users, 'coordinator-faculty'], ['Coordinators', overview?.stats?.coordinators || 0, GraduationCap, 'coordinator-coordinators']].map(([label, value, Icon, target]) => <button className="coord-stat-card" key={label} onClick={() => window.dispatchEvent(new CustomEvent('projectflow:navigate', { detail: target }))}><span className="coord-stat-icon"><Icon size={20} /></span><span className="coord-stat-value">{value}</span><span className="coord-stat-label">{label}</span><ArrowRight className="coord-stat-arrow" size={16} /></button>)}
        </div>
        {!institution && <InstitutionForm id="institution-setup" form={institutionForm} setForm={setInstitutionForm} busy={busy} onSubmit={e => { e.preventDefault(); const details = institutionPayload(institutionForm); save(() => api.createInstitution(details), 'Institution profile created.', () => { setInstitutionForm(emptyInstitution); window.location.reload(); }); }} />}
        <div className="coord-content-grid"><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">RECENT SETUP</span><h2>Recently created batches</h2></div><button className="coord-text-button" onClick={() => window.dispatchEvent(new CustomEvent('projectflow:navigate', { detail: 'coordinator-batches' }))}>View all <ArrowRight size={15} /></button></div>{overview?.batches?.length ? <div className="coord-batch-list">{overview.batches.map(batch => <article key={batch._id || batch.id}><span className="coord-batch-symbol"><BookOpen size={18} /></span><div><strong>{batch.name}</strong><small>{batch.branchName} · {batch.sessionName}</small></div><span className="coord-status">Active</span></article>)}</div> : <p className="coord-muted">No batches created yet. Set up a session and branch to get started.</p>}</section><section className="coord-panel coord-activity-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">NEXT STEPS</span><h2>Setup checklist</h2></div><Activity size={18} /></div><div className="coord-checklist">{[['Create institution profile', Boolean(institution)], ['Add an academic branch', branches.length > 0], ['Configure an academic session', sessions.length > 0], ['Create your first batch', batches.length > 0]].map(([label, done]) => <div key={label}><span className={done ? 'coord-check coord-check-done' : 'coord-check'}>{done ? <CheckCircle2 size={16} /> : <span />}</span><span>{label}</span><small>{done ? 'Done' : 'To do'}</small></div>)}</div></section></div>
      </>}

      {activeTab === 'coordinator-institution' && <>{institution && !editingInstitution ? <><InstitutionSummary institution={institution} /><section className="coord-panel coord-public-link-panel"><div><span className="coord-eyebrow">PROFILE MANAGEMENT</span><h2>Keep public details current</h2></div><button className="btn btn-secondary" onClick={() => setEditingInstitution(true)}>Edit institution profile</button></section></> : <InstitutionForm form={institutionForm} setForm={setInstitutionForm} busy={busy} submitLabel={institution ? 'Save changes' : 'Create institution'} onSubmit={e => { e.preventDefault(); const details = institutionPayload(institutionForm); if (institution) save(() => api.updateCoordinatorInstitution(institution.id || institution._id, details), 'Institution profile updated.', () => setEditingInstitution(false)); else save(() => api.createInstitution(details), 'Institution profile created.', () => window.location.reload()); }} />}</>}
      {activeTab === 'coordinator-branches' && <><form className="coord-panel coord-form" onSubmit={e => { e.preventDefault(); save(() => api.createCoordinatorBranch({ ...branchForm, programs: branchForm.programs.split(',').map(x => x.trim()).filter(Boolean) }), 'Branch added.', () => setBranchForm({ name: '', code: '', programs: '' })); }}><div className="coord-section-heading"><div><span className="coord-eyebrow">ACADEMIC STRUCTURE</span><h2>Add a branch</h2></div></div><div className="coord-form-grid"><Field label="Branch name"><input required value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} placeholder="Computer Science & Engineering" /></Field><Field label="Branch code"><input value={branchForm.code} onChange={e => setBranchForm({ ...branchForm, code: e.target.value })} placeholder="CSE" /></Field><Field label="Programs offered"><input value={branchForm.programs} onChange={e => setBranchForm({ ...branchForm, programs: e.target.value })} placeholder="B.Tech, M.Tech (comma separated)" /></Field><button className="btn btn-primary" disabled={busy || !institution}><Plus size={16} /> Add branch</button></div>{!institution && <p className="coord-muted">Create an institution profile first.</p>}</form><BranchList branches={branches} /></>}
      {activeTab === 'coordinator-messages' && <CoordinatorMessages branches={branches} busy={busy} save={save} />}
      {activeTab === 'coordinator-courses' && <CoordinatorCourses courses={courses} branches={branches} batches={batches} sessions={sessions} institution={institution} busy={busy} save={save} />}
      {activeTab === 'coordinator-sessions' && <><form className="coord-panel coord-form" onSubmit={e => { e.preventDefault(); save(() => api.createCoordinatorSession(sessionForm), 'Academic session added.', () => setSessionForm({ name: '', startYear: '', endYear: '' })); }}><div className="coord-section-heading"><div><span className="coord-eyebrow">ACADEMIC CALENDAR</span><h2>Add an academic session</h2></div></div><div className="coord-form-grid"><Field label="Session name"><input required value={sessionForm.name} onChange={e => setSessionForm({ ...sessionForm, name: e.target.value })} placeholder="2026–2027" /></Field><Field label="Start year"><input type="number" min="1900" max="2200" value={sessionForm.startYear} onChange={e => setSessionForm({ ...sessionForm, startYear: e.target.value })} /></Field><Field label="End year"><input type="number" min="1900" max="2200" value={sessionForm.endYear} onChange={e => setSessionForm({ ...sessionForm, endYear: e.target.value })} /></Field><button className="btn btn-primary" disabled={busy || !institution}><Plus size={16} /> Add session</button></div></form><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">YOUR SESSIONS</span><h2>Academic sessions</h2></div></div>{sessions.length ? <div className="coord-program-list">{sessions.map(row => <article key={row._id || row.id}><CalendarDays size={18} /><div><strong>{row.name}</strong><small>{row.startYear && row.endYear ? `${row.startYear} – ${row.endYear}` : 'Active session'}</small></div><span className="coord-status">{row.status}</span></article>)}</div> : <p className="coord-muted">No academic sessions have been created.</p>}</section></>}
      {activeTab === 'coordinator-batches' && <><form className="coord-panel coord-form" onSubmit={e => { e.preventDefault(); save(() => api.createCoordinatorBatch(batchForm), 'Batch created.', () => setBatchForm({ name: '', branchId: '', sessionId: '', cohortYear: '', description: '' })); }}><div className="coord-section-heading"><div><span className="coord-eyebrow">COHORT MANAGEMENT</span><h2>Create a batch</h2></div></div><div className="coord-form-grid"><Field label="Batch name"><input required value={batchForm.name} onChange={e => setBatchForm({ ...batchForm, name: e.target.value })} placeholder="CSE 2026" /></Field><Field label="Branch"><select required value={batchForm.branchId} onChange={e => setBatchForm({ ...batchForm, branchId: e.target.value })}><option value="">Select branch</option>{branches.map(row => <option key={row._id || row.id} value={row._id || row.id}>{row.name}</option>)}</select></Field><Field label="Academic session"><select required value={batchForm.sessionId} onChange={e => setBatchForm({ ...batchForm, sessionId: e.target.value })}><option value="">Select session</option>{sessions.map(row => <option key={row._id || row.id} value={row._id || row.id}>{row.name}</option>)}</select></Field><Field label="Cohort year"><input type="number" min="1900" max="2200" value={batchForm.cohortYear} onChange={e => setBatchForm({ ...batchForm, cohortYear: e.target.value })} /></Field><Field label="Description"><input value={batchForm.description} onChange={e => setBatchForm({ ...batchForm, description: e.target.value })} /></Field><button className="btn btn-primary" disabled={busy || !institution || !branches.length || !sessions.length}><Plus size={16} /> Create batch</button></div>{(!branches.length || !sessions.length) && <p className="coord-muted">Add a branch and academic session before creating a batch.</p>}</form><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">SAVED COHORTS</span><h2>All batches <span className="coord-count">{batches.length}</span></h2></div><input className="coord-search" aria-label="Search batches" placeholder="Search batches" onChange={e => document.querySelectorAll('[data-batch]').forEach(item => { item.hidden = !item.dataset.batch.toLowerCase().includes(e.target.value.toLowerCase()); })} /></div>{batches.length ? <div className="coord-table-wrap"><table className="data-table"><thead><tr><th>Batch</th><th>Branch</th><th>Academic session</th><th>Students</th><th>Status</th><th>Details</th></tr></thead><tbody>{batches.map(row => <tr key={row._id || row.id} data-batch={`${row.name} ${row.branchName} ${row.sessionName}`}><td><strong>{row.name}</strong>{row.cohortYear && <small className="coord-cell-sub">Cohort {row.cohortYear}</small>}</td><td>{row.branchName}</td><td>{row.sessionName}</td><td>—</td><td><span className="coord-status">{row.status}</span></td><td><button className="btn btn-secondary btn-sm" onClick={() => { setSelectedBatch(row); window.dispatchEvent(new CustomEvent("projectflow:navigate", { detail: "coordinator-batch-details" })); }}>Open</button></td></tr>)}</tbody></table></div> : <p className="coord-muted">No batches yet. Add a branch and academic session, then create your first batch.</p>}</section></>}
      {activeTab === 'coordinator-batch-details' && selectedBatch && <BatchDetails batch={selectedBatch} courses={courses} assignments={assignments} onBack={() => window.dispatchEvent(new CustomEvent('projectflow:navigate', { detail: 'coordinator-batches' }))} />}
      {activeTab === 'coordinator-faculty' && <><PeopleList title="Faculty directory" people={overview?.faculty || []} empty="No faculty accounts are associated with this institution yet." />{institution && <section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">MEMBERSHIP REVIEW</span><h2>Faculty and student join requests <span className="coord-count">{membershipRequests.length}</span></h2></div></div>{membershipRequests.length ? <div className="coord-people-list">{membershipRequests.map(request => <article key={request.id}><div className="coord-avatar">{request.member.name?.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><div><strong>{request.member.name}</strong><small>{request.role} · {request.branchName} · Requested {new Date(request.requestedAt).toLocaleDateString()}</small></div><button className="btn btn-sm btn-emerald" disabled={busy} onClick={() => save(() => api.reviewCoordinatorMembership(request.id, 'approved'), `${request.role} branch membership approved.`)}>Approve</button><button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => save(() => api.reviewCoordinatorMembership(request.id, 'rejected'), 'Membership request declined.')}>Decline</button></article>)}</div> : <p className="coord-muted">There are no pending faculty or student join requests.</p>}</section>}</>}
      {activeTab === 'coordinator-assignments' && <CoordinatorAssignments assignments={assignments} courses={courses} faculty={overview?.faculty || []} busy={busy} save={save} />}
      {activeTab === 'coordinator-coordinators' && <PeopleList title="Coordinator directory" people={overview?.coordinators || []} empty="No coordinator accounts are associated with this institution yet." />}
      {activeTab === 'coordinator-activity' && <><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">COURSE COVERAGE</span><h2>Academic allocation overview</h2></div><Activity size={18} /></div><div className="coord-monitoring-stats"><div><strong>{courses.length}</strong><span>Courses configured</span></div><div><strong>{assignments.length}</strong><span>Active faculty assignments</span></div><div><strong>{Math.max(0, courses.length - assignments.length)}</strong><span>Courses without an assignment</span></div></div></section><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">RECENT ASSIGNMENTS</span><h2>Faculty allocation changes</h2></div></div>{assignments.length ? <div className="coord-program-list">{assignments.slice(0, 8).map(item => <article key={item._id || item.id}><span className="coord-batch-symbol"><Users size={18} /></span><div><strong>{item.facultyName} · {item.courseCode}</strong><small>{item.courseName} · {item.batchName} · {item.sessionName}</small></div><span className="coord-status">{item.status}</span></article>)}</div> : <p className="coord-muted">No faculty assignments have been recorded.</p>}</section><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">PROJECT MONITORING</span><h2>Reviews and submissions</h2></div></div><p className="coord-muted">Project and evaluation records are not linked to institution-scoped courses in the current data model, so this view shows course and faculty coverage only.</p></section></>}
      {activeTab === 'coordinator-institution' && institution && <section className="coord-panel coord-public-link-panel"><div><span className="coord-eyebrow">PUBLIC PROFILE</span><h2>Share your institution profile</h2><p>Visitors can see public academic information and coordinator names.</p></div><a className="btn btn-secondary" href={`/institutions/${institution.id || institution._id}`} target="_self"><Globe2 size={16} /> View public page</a></section>}
    </div>
  );
}

function CoordinatorMessages({ branches, busy, save }) {
  const [form, setForm] = useState({ branchId: '', audience: 'all', title: '', message: '' });
  const branch = branches.find(item => (item._id || item.id) === form.branchId);
  const submit = event => {
    event.preventDefault();
    save(() => api.sendCoordinatorBranchMessage(form), result => `Message sent to ${result.sent} ${result.sent === 1 ? 'person' : 'people'} in ${result.branchName}.`, () => setForm(current => ({ ...current, title: '', message: '' })));
  };
  return <><form className="coord-panel coord-form" onSubmit={submit}>
    <div className="coord-section-heading"><div><span className="coord-eyebrow">BRANCH ANNOUNCEMENT</span><h2>Send a message to your community</h2><p>Only active members of the selected branch receive this message. Students and faculty join through the institution profile and coordinator approval.</p></div></div>
    <div className="coord-form-grid">
      <Field label="Branch"><select required value={form.branchId} onChange={event => setForm({ ...form, branchId: event.target.value })}><option value="">Select a branch</option>{branches.map(item => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}</select></Field>
      <Field label="Send to"><select value={form.audience} onChange={event => setForm({ ...form, audience: event.target.value })}><option value="all">Faculty and students</option><option value="faculty">Faculty only</option><option value="students">Students only</option></select></Field>
      <Field label="Message title"><input required maxLength="120" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Important academic update" /></Field>
      <Field label="Message"><textarea required maxLength="2000" rows="5" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} placeholder="Write the announcement for this branch…" /></Field>
    </div>
    {branch && <p className="coord-muted">Recipients: active {form.audience === 'all' ? 'faculty and students' : form.audience} in {branch.name}.</p>}
    {!branches.length && <p className="coord-muted">Add a branch before sending an announcement.</p>}
    <div className="coord-form-footer"><span>Messages appear in each recipient’s ProjectFlow notifications.</span><button className="btn btn-primary" disabled={busy || !branches.length}><Users size={16} /> Send message</button></div>
  </form></>;
}

function InstitutionForm({ id, form, setForm, busy, onSubmit, submitLabel = 'Create institution' }) {
  const [uploadError, setUploadError] = useState('');
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const upload = async (event, kind, key) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setUploadError('');
    try {
      const data = await Promise.all(files.map(file => readMediaFile(file, kind)));
      const current = [
        ...(key === 'logoUrl' ? [] : [form.logoUrl]),
        ...(key === 'coverUrl' ? [] : [form.coverUrl]),
        ...(key === 'videoUrl' ? [] : [form.videoUrl]),
        ...(form.galleryUploads || [])
      ].filter(value => String(value || '').startsWith('data:'));
      const bytes = [...current, ...data].reduce((sum, value) => sum + dataUrlByteLength(value), 0);
      if (bytes > 6 * 1024 * 1024) throw new Error('All uploaded images and video together must be 6 MB or smaller.');
      if (key === 'galleryUploads') update(key, [...(form.galleryUploads || []), ...data].slice(0, 10));
      else update(key, data[0]);
    } catch (err) { setUploadError(err.message); }
  };
  return <form id={id} className="coord-panel coord-form" onSubmit={onSubmit}>
    <div className="coord-section-heading"><div><span className="coord-eyebrow">OFFICIAL PROFILE</span><h2>Institution details</h2><p>Public details can be updated later. Add direct uploads or use hosted media links.</p></div></div>
    <div className="coord-form-grid coord-form-grid-wide">
      <Field label="Official institution name"><input required maxLength="140" value={form.name || ''} onChange={e => update('name', e.target.value)} placeholder="Institution name" /></Field>
      <Field label="Institution type"><select value={form.type || 'college'} onChange={e => update('type', e.target.value)}><option value="college">College</option><option value="university">University</option><option value="school">School</option></select></Field>
      <Field label="City"><input value={form.city || ''} onChange={e => update('city', e.target.value)} /></Field>
      <Field label="State"><input value={form.state || ''} onChange={e => update('state', e.target.value)} /></Field>
      <Field label="Country"><input value={form.country || ''} onChange={e => update('country', e.target.value)} /></Field>
      <Field label="Address"><input value={form.address || ''} onChange={e => update('address', e.target.value)} /></Field>
      <Field label="Official website"><input type="url" value={form.website || ''} onChange={e => update('website', e.target.value)} placeholder="https://example.edu" /></Field>
      <Field label="Logo image URL"><input type="text" value={form.logoUrl || ''} onChange={e => update('logoUrl', e.target.value)} placeholder="https://…" /><input className="coord-file-input" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload institution logo" onChange={event => upload(event, 'image', 'logoUrl')} />{form.logoUrl && <img className="coord-media-thumb" src={form.logoUrl} alt="Logo preview" />}</Field>
      <Field label="Cover image URL"><input type="text" value={form.coverUrl || ''} onChange={e => update('coverUrl', e.target.value)} placeholder="https://…" /><input className="coord-file-input" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload cover image" onChange={event => upload(event, 'image', 'coverUrl')} />{form.coverUrl && <img className="coord-media-thumb coord-cover-thumb" src={form.coverUrl} alt="Cover preview" />}</Field>
      <Field label="Gallery image URLs (comma separated)"><input type="text" value={form.galleryUrls || ''} onChange={e => update('galleryUrls', e.target.value)} placeholder="https://…/campus.jpg, https://…/library.jpg" /><input className="coord-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="Upload campus gallery images" onChange={event => upload(event, 'image', 'galleryUploads')} />{form.galleryUploads?.length > 0 && <div className="coord-upload-gallery">{form.galleryUploads.map((url, index) => <div key={`${url.slice(0, 32)}-${index}`}><img src={url} alt={`Uploaded gallery preview ${index + 1}`} /><button type="button" aria-label={`Remove uploaded image ${index + 1}`} onClick={() => update('galleryUploads', form.galleryUploads.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div>}</Field>
      <Field label="Short video URL (MP4 or WebM)"><input type="text" value={form.videoUrl || ''} onChange={e => update('videoUrl', e.target.value)} placeholder="https://…/campus-tour.mp4" /><input className="coord-file-input" type="file" accept="video/mp4,video/webm" aria-label="Upload a short campus video" onChange={event => upload(event, 'video', 'videoUrl')} />{form.videoUrl && <video className="coord-media-thumb" src={form.videoUrl} controls playsInline preload="metadata" />}</Field>
      <Field label="Public description"><textarea rows="4" maxLength="1200" value={form.description || ''} onChange={e => update('description', e.target.value)} /></Field>
    </div>
    {uploadError && <div className="coord-alert coord-alert-error" role="alert">{uploadError}</div>}
    <p className="coord-muted">Direct upload supports PNG, JPEG and WebP images (2 MB each), and short MP4/WebM video (4 MB). Total uploaded media limit: 6 MB.</p>
    <div className="coord-form-footer"><span>Only publish media your institution is authorized to share.</span><button className="btn btn-primary" disabled={busy}><Plus size={16} /> {submitLabel}</button></div>
  </form>;
}

function InstitutionSummary({ institution }) {
  const cover = institution.coverUrl?.startsWith('data:') ? undefined : institution.coverUrl;
  return <section className="coord-institution-summary"><div className="coord-cover" style={cover ? { backgroundImage: `linear-gradient(90deg,rgba(9,13,22,.88),rgba(9,13,22,.2)),url("${cover}")` } : undefined}>{institution.coverUrl?.startsWith('data:') && <img className="coord-summary-cover-image" src={institution.coverUrl} alt="Institution cover" />}<div className="coord-summary-logo">{institution.logoUrl ? <img src={institution.logoUrl} alt="" /> : <Building2 />}</div><div><span className="coord-eyebrow">{institution.type} · {institution.city || 'Location pending'}</span><h2>{institution.name}</h2></div></div><div className="coord-summary-details"><p>{institution.description || 'Add an overview to introduce your institution to visitors.'}</p><div>{institution.website && <a href={institution.website} target="_blank" rel="noreferrer"><Globe2 size={16} /> {institution.website}</a>}<span><MapPin size={16} /> {[institution.city, institution.state, institution.country].filter(Boolean).join(', ') || 'Location not provided'}</span></div></div>{institution.videoUrl && <video className="coord-summary-video" src={institution.videoUrl} controls playsInline preload="metadata" />}</section>;
}

function BranchList({ branches }) {
  return <section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">YOUR STRUCTURE</span><h2>Branches <span className="coord-count">{branches.length}</span></h2></div></div>{branches.length ? <div className="coord-program-list">{branches.map(row => <article key={row._id || row.id}><School size={18} /><div><strong>{row.name}</strong><small>{row.code || 'No branch code'}{row.programs?.length ? ` · ${row.programs.join(', ')}` : ''}</small></div><span className="coord-status">{row.status}</span></article>)}</div> : <p className="coord-muted">No branches configured yet.</p>}</section>;
}

function PeopleList({ title, people, empty }) {
  return <section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">INSTITUTION MEMBERS</span><h2>{title} <span className="coord-count">{people.length}</span></h2></div></div>{people.length ? <div className="coord-people-list">{people.map(person => <article key={person.id}><div className="coord-avatar">{person.name?.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><div><strong>{person.name}</strong><small>{person.designation || person.department || 'Member'}</small></div><span className="coord-status">Active</span></article>)}</div> : <p className="coord-muted">{empty}</p>}</section>;
}

function CoordinatorCourses({ courses, branches, batches, sessions, institution, busy, save }) {
  const emptyForm = { name: '', code: '', branchId: '', batchId: '', sessionId: '', semester: '', description: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingCourse, setEditingCourse] = useState(null);
  const [search, setSearch] = useState('');
  const availableBatches = batches.filter(batch => (!form.branchId || batch.branchId === form.branchId) && (!form.sessionId || batch.sessionId === form.sessionId));
  const filteredCourses = courses.filter(course => `${course.code} ${course.name} ${course.branchName} ${course.batch}`.toLowerCase().includes(search.toLowerCase()));
  const reset = () => { setForm(emptyForm); setEditingCourse(null); };

  return <>
    <form className="coord-panel coord-form" onSubmit={event => {
      event.preventDefault();
      if (editingCourse) save(() => api.updateCoordinatorCourse(editingCourse.id, { name: form.name, semester: form.semester, description: form.description }), 'Course updated.', reset);
      else save(() => api.createCoordinatorCourse(form), 'Course created.', reset);
    }}>
      <div className="coord-section-heading"><div><span className="coord-eyebrow">COURSE CATALOG</span><h2>{editingCourse ? `Edit ${editingCourse.code}` : 'Add a course or subject'}</h2></div>{editingCourse && <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>Cancel edit</button>}</div>
      <div className="coord-form-grid">
        <Field label="Course name"><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Course code"><input required disabled={Boolean(editingCourse)} value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} /></Field>
        <Field label="Branch"><select required disabled={Boolean(editingCourse)} value={form.branchId} onChange={event => setForm({ ...form, branchId: event.target.value, batchId: '' })}><option value="">Select branch</option>{branches.map(row => <option key={row._id || row.id} value={row._id || row.id}>{row.name}</option>)}</select></Field>
        <Field label="Academic session"><select required disabled={Boolean(editingCourse)} value={form.sessionId} onChange={event => setForm({ ...form, sessionId: event.target.value, batchId: '' })}><option value="">Select session</option>{sessions.map(row => <option key={row._id || row.id} value={row._id || row.id}>{row.name}</option>)}</select></Field>
        <Field label="Batch"><select required disabled={Boolean(editingCourse)} value={form.batchId} onChange={event => setForm({ ...form, batchId: event.target.value })}><option value="">Select batch</option>{availableBatches.map(row => <option key={row._id || row.id} value={row._id || row.id}>{row.name}</option>)}</select></Field>
        <Field label="Semester or year"><input value={form.semester} onChange={event => setForm({ ...form, semester: event.target.value })} placeholder="Semester 3" /></Field>
        <Field label="Description"><input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></Field>
        <button className="btn btn-primary" disabled={busy || !institution}><Plus size={16} /> {editingCourse ? 'Save course' : 'Add course'}</button>
      </div>
      {!institution && <p className="coord-muted">Create an institution profile first.</p>}
    </form>
    <section className="coord-panel">
      <div className="coord-section-heading"><div><span className="coord-eyebrow">INSTITUTION OFFERINGS</span><h2>Courses & subjects <span className="coord-count">{courses.length}</span></h2></div><input className="coord-search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search courses" placeholder="Search courses" /></div>
      {filteredCourses.length ? <div className="coord-table-wrap"><table className="data-table"><thead><tr><th>Course</th><th>Branch</th><th>Batch</th><th>Session</th><th>Faculty</th><th>Actions</th></tr></thead><tbody>{filteredCourses.map(course => <tr key={course.id}><td><strong>{course.code}</strong><small className="coord-cell-sub">{course.name}</small></td><td>{course.branchName}</td><td>{course.batch}</td><td>{course.sessionName}</td><td>{course.facultyName || <span className="coord-muted">Unassigned</span>}</td><td><button className="btn btn-secondary btn-sm" onClick={() => { setEditingCourse(course); setForm({ name: course.name, code: course.code, branchId: course.branchId, batchId: course.batchId, sessionId: course.sessionId, semester: course.semester || '', description: course.description || '' }); }}>Edit</button></td></tr>)}</tbody></table></div> : <p className="coord-muted">No matching institution courses are configured.</p>}
    </section>
  </>;
}

function BatchDetails({ batch, courses, assignments, onBack }) {
  const batchId = String(batch._id || batch.id);
  const batchCourses = courses.filter(course => String(course.batchId) === batchId);
  const batchAssignments = assignments.filter(item => String(item.batchId) === batchId);
  return <><button className="btn btn-secondary coord-back-button" onClick={onBack}><ArrowLeft size={16} /> Back to batches</button><section className="coord-institution-summary"><div className="coord-cover coord-batch-cover"><div className="coord-summary-logo"><ClipboardList /></div><div><span className="coord-eyebrow">{batch.branchName} · {batch.sessionName}</span><h2>{batch.name}</h2></div></div><div className="coord-summary-details"><p>{batch.description || 'No batch description has been added.'}</p><div><span><BookOpen size={16} /> {batchCourses.length} courses</span><span><Users size={16} /> {batchAssignments.length} faculty assignments</span><span><CalendarDays size={16} /> {batch.cohortYear ? `Cohort ${batch.cohortYear}` : batch.sessionName}</span></div></div></section><div className="coord-content-grid"><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">SUBJECTS & COURSES</span><h2>Courses in this batch</h2></div></div>{batchCourses.length ? <div className="coord-program-list">{batchCourses.map(course => <article key={course.id}><span className="coord-batch-symbol"><BookOpen size={18} /></span><div><strong>{course.code} · {course.name}</strong><small>{course.semester || 'Semester not specified'} · {course.facultyName || 'Faculty unassigned'}</small></div><span className="coord-status">{course.facultyName ? 'Assigned' : 'Needs faculty'}</span></article>)}</div> : <p className="coord-muted">No institution courses have been associated with this batch.</p>}</section><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">FACULTY ALLOCATION</span><h2>Assigned faculty</h2></div></div>{batchAssignments.length ? <div className="coord-people-list">{batchAssignments.map(item => <article key={item._id || item.id}><div className="coord-avatar">{item.facultyName?.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><div><strong>{item.facultyName}</strong><small>{item.courseCode} · {item.courseName}</small></div></article>)}</div> : <p className="coord-muted">No faculty assignments have been saved for this batch.</p>}</section></div><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">STUDENT ROSTER & ACADEMIC ACTIVITY</span><h2>Batch activity</h2></div></div><p className="coord-muted">The current student records are not joined to institution batches. Student counts, private rosters, project updates and evaluations will show when those records are linked to this institution and batch.</p></section></>;
}

function CoordinatorAssignments({ assignments, courses, faculty, busy, save }) {
  const [form, setForm] = useState({ courseId: '', facultyId: '' });
  const currentAssignment = assignments.find(item => item.courseId === form.courseId);
  return <><form className="coord-panel coord-form" onSubmit={event => { event.preventDefault(); const action = currentAssignment ? api.updateCoordinatorAssignment(currentAssignment._id || currentAssignment.id, { facultyId: form.facultyId }) : api.createCoordinatorAssignment(form); save(() => action, currentAssignment ? 'Faculty assignment updated.' : 'Faculty assigned to the course.', () => setForm({ courseId: '', facultyId: '' })); }}><div className="coord-section-heading"><div><span className="coord-eyebrow">TEACHING ALLOCATION</span><h2>Assign faculty to a course and batch</h2></div></div><div className="coord-form-grid"><Field label="Course and batch"><select required value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })}><option value="">Select a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.name} · {course.batch}</option>)}</select></Field><Field label="Faculty member"><select required value={form.facultyId} onChange={e => setForm({ ...form, facultyId: e.target.value })}><option value="">Select faculty</option>{faculty.map(person => <option key={person.id} value={person.id}>{person.name} · {person.department || 'Faculty'}</option>)}</select></Field><button className="btn btn-primary" disabled={busy || !courses.length || !faculty.length}>{currentAssignment ? 'Reassign faculty' : 'Save assignment'}</button></div>{!faculty.length && <p className="coord-muted">Faculty must first select this institution's public profile and have their membership approved.</p>}</form><section className="coord-panel"><div className="coord-section-heading"><div><span className="coord-eyebrow">CURRENT ALLOCATION</span><h2>Faculty assignments <span className="coord-count">{assignments.length}</span></h2></div></div>{assignments.length ? <div className="coord-table-wrap"><table className="data-table"><thead><tr><th>Faculty</th><th>Course</th><th>Branch</th><th>Batch</th><th>Session</th></tr></thead><tbody>{assignments.map(row => <tr key={row._id || row.id}><td>{row.facultyName}</td><td><strong>{row.courseCode}</strong><small className="coord-cell-sub">{row.courseName}</small></td><td>{row.branchName}</td><td>{row.batchName}</td><td>{row.sessionName}</td></tr>)}</tbody></table></div> : <p className="coord-muted">No faculty assignments have been created.</p>}</section></>;
}
