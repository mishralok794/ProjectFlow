import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Users, Send, Save, RefreshCw, Github, ExternalLink, UserRound, Search, CheckCircle2, ClipboardCheck, Clock3, LayoutDashboard } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import './FacultyWorkspace.css';

const card = { background: '#ffffff', border: '1px solid #e5eaf2', borderRadius: 16, padding: 20, boxShadow: '0 6px 18px rgba(31,55,91,.06)' };
const input = { width: '100%', background: '#f8fafc', color: '#1e293b', border: '1px solid #dbe4ef', borderRadius: 9, padding: '10px 12px', marginTop: 6 };
const statuses = ['Not started', 'In progress', 'Submitted', 'Under review', 'Completed'];

function Avatar({ person, size = 42 }) {
  return person?.avatarUrl ? <img src={person.avatarUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#0369a1,#4f46e5)', color: 'white', fontWeight: 700 }}>{(person?.name || '?').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>;
}

function githubLogin(profileUrl) {
  try {
    const parsed = new URL(profileUrl);
    return parsed.hostname.toLowerCase() === 'github.com' ? parsed.pathname.split('/').filter(Boolean)[0]?.toLowerCase() || '' : '';
  } catch { return ''; }
}

export function FacultyWorkspace({ initialView = 'dashboard', onNavigate }) {
  const { user, updateProfile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [detail, setDetail] = useState(null);
  const [view, setView] = useState(initialView);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [rules, setRules] = useState({ minMembers: 4, maxMembers: 5, minFemaleMembers: 0, projectBrief: '', projectDeadline: '' });
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [repoUrls, setRepoUrls] = useState({});
  const [labs, setLabs] = useState([]);
  const [labForm, setLabForm] = useState({ title: '', instructions: '', durationMinutes: 60 });
  const [message, setMessage] = useState({ audience: 'course', teamId: '', title: '', message: '' });
  const [profile, setProfile] = useState({ name: user?.name || '', designation: user?.designation || '', department: user?.department || '', bio: user?.bio || '', avatarUrl: user?.avatarUrl || '' });

  const refreshCourses = async () => {
    setBusy(true); setLoadingCourses(true); setError('');
    try {
      const rows = await api.getFacultyCourses();
      setCourses(rows);
      if (selectedId && rows.some(row => String(row.id) === String(selectedId))) await loadDetail(selectedId);
      else { setSelectedId(''); setDetail(null); setSelectedTeamId(''); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); setLoadingCourses(false); }
  };
  const loadDetail = async id => {
    if (!id) return;
    try {
      const data = await api.getFacultyCourse(id);
      data.projects = await Promise.all((data.projects || []).map(async project => {
        try { const evidence = await api.getGitHubEvidence(project.id); return { ...project, evidence: evidence?.dataSource === 'live' ? evidence : null }; }
        catch { return { ...project, evidence: null }; }
      }));
      data.teams = await Promise.all((data.teams || []).map(async team => {
        try { const evidence = await api.getGitHubEvidence(team.id); return { ...team, evidence: evidence?.dataSource === 'live' ? evidence : null }; }
        catch { return { ...team, evidence: null }; }
      }));
      const courseLabs = await api.getFacultyLabs(id);
      setRepoUrls(Object.fromEntries(data.teams.map(team => [team.id, team.githubUrl || team.evidence?.repoUrl || ''])));
      setLabs(courseLabs);
      setDetail(data);
      setRules({ minMembers: data.course.teamRules?.minMembers ?? 4, maxMembers: data.course.teamRules?.maxMembers ?? 5, minFemaleMembers: data.course.teamRules?.minFemaleMembers ?? 0, projectBrief: data.course.projectBrief || '', projectDeadline: data.course.projectDeadline ? data.course.projectDeadline.slice(0, 10) : '' });
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { refreshCourses(); }, []);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);
  useEffect(() => {
    setView(initialView);
    if (['dashboard', 'subjects'].includes(initialView)) { setSelectedId(''); setDetail(null); setSelectedTeamId(''); }
  }, [initialView]);
  const selectedCourse = detail?.course;
  const visibleStudents = useMemo(() => (detail?.students || []).filter(person => `${person.name} ${person.rollNumber} ${person.email}`.toLowerCase().includes(query.toLowerCase())), [detail, query]);
  const summary = useMemo(() => ({
    subjects: courses.length,
    teams: courses.reduce((total, course) => total + (Number(course.teamCount) || 0), 0),
    pendingReviews: courses.reduce((total, course) => total + (Number(course.pendingReviewCount) || 0), 0),
    activeLabs: courses.reduce((total, course) => total + (Number(course.activeLabCount) || 0), 0)
  }), [courses]);
  const goToMessages = team => {
    if (team) setMessage(current => ({ ...current, audience: 'team', teamId: team.id, title: '', message: '' }));
    onNavigate?.('faculty-messages');
    setView('messages');
  };
  const submissionsForTeam = teamId => labs.flatMap(lab => (lab.submissions || []).filter(submission => String(submission.teamId) === String(teamId)).map(submission => ({ ...submission, labTitle: lab.title })));
  const contributorRows = team => (team.evidence?.contributors || []).map(contributor => ({
    ...contributor,
    student: team.members.find(member => githubLogin(member.githubUrl) && githubLogin(member.githubUrl) === String(contributor.login || '').toLowerCase()) || null
  }));

  const run = async action => { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const saveRules = () => run(async () => { await api.updateFacultyCourseRules(selectedId, { teamRules: { minMembers: Number(rules.minMembers), maxMembers: Number(rules.maxMembers), minFemaleMembers: Number(rules.minFemaleMembers) }, projectBrief: rules.projectBrief, projectDeadline: rules.projectDeadline || null }); await loadDetail(selectedId); setNotice('Project brief and team rules saved.'); });
  const enroll = () => run(async () => { const result = await api.enrollFacultyCourseStudents(selectedId, selectedStudents); setSelectedStudents([]); await loadDetail(selectedId); setNotice(`${result.enrolled} student(s) enrolled in this course.`); });
  const updateTeam = (team, projectStatus, progressPercentage) => run(async () => { if (!projectStatus) throw new Error('Choose a project status first.'); const parsedProgress = String(progressPercentage ?? '').trim() === '' ? null : Number(progressPercentage); await api.updateFacultyTeamStatus(selectedId, team.id, { projectStatus, progressPercentage: Number.isFinite(parsedProgress) ? parsedProgress : null }); await loadDetail(selectedId); setNotice(`${team.name} project status saved.`); });
  const connectTeamRepository = team => run(async () => {
    const githubUrl = String(repoUrls[team.id] || '').trim();
    if (!githubUrl) throw new Error('Enter the GitHub repository URL first.');
    await api.updateFacultyTeamRepository(selectedId, team.id, githubUrl);
    await api.connectGitHub({ projectId: team.id, repoUrl: githubUrl, useDemoMode: false });
    await loadDetail(selectedId);
    setNotice(`GitHub connected for ${team.name}.`);
  });
  const sendMessage = () => run(async () => { const result = await api.sendFacultyCourseMessage({ courseId: selectedId, ...message }); setNotice(`Message sent to ${result.sent} ${result.sent === 1 ? 'recipient' : 'recipients'}.`); setMessage(current => ({ ...current, title: '', message: '' })); });
  const sendAllClassesMessage = () => run(async () => { const result = await api.sendFacultyCourseMessage({ ...message, audience: 'allCourses' }); setNotice(`Message sent to ${result.sent} students across ${result.courseNames?.length || 0} of your classes.`); setMessage(current => ({ ...current, title: '', message: '' })); });
  const createLab = () => run(async () => { await api.createFacultyLab(selectedId, labForm); await refreshCourses(); setLabForm({ title: '', instructions: '', durationMinutes: 60 }); setNotice('Timed lab task is live for this class.'); });
  const reviewLab = (lab, submission, status) => {
    const feedback = window.prompt('Feedback for this team (optional):', submission.feedback || '');
    if (feedback === null) return;
    run(async () => { await api.reviewFacultyLabSubmission(selectedId, lab.id || lab._id, submission.id || submission._id, { status, feedback }); await refreshCourses(); setNotice(`Review saved for ${submission.teamName}.`); });
  };
  const saveProfile = () => run(async () => { const updated = await api.updateMyProfile(profile); updateProfile?.(updated); setNotice('Faculty profile saved.'); });
  const handleFacultyPhoto = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a PNG, JPEG, WebP or GIF image up to 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setProfile(current => ({ ...current, avatarUrl: String(reader.result || '') }));
    reader.onerror = () => setError('Could not read that image. Try another file.');
    reader.readAsDataURL(file);
  };
  const openCourse = id => { setDetail(null); setSelectedTeamId(''); setSelectedId(id); };

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const pageTitles = { dashboard: `${greeting}${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`, subjects: 'My Subjects', teams: selectedCourse ? `${selectedCourse.name} teams` : 'My Teams', labs: selectedCourse ? `${selectedCourse.name} lab tasks` : 'Lab Tasks', messages: 'Messages', profile: 'My teaching profile' };
  const showSubjectCards = ['dashboard', 'subjects', 'teams', 'labs'].includes(view) && !selectedCourse;

  return <section className="faculty-workspace" style={{ padding: '12px 4px 40px', color: '#1e293b' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div><div style={{ color: '#2563eb', fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>FACULTY WORKSPACE</div><h1 style={{ color: '#172033', fontSize: 30, margin: '8px 0' }}>{pageTitles[view] || 'Teaching overview'}</h1><div style={{ color: '#64748b' }}>{view === 'dashboard' ? 'Your teaching overview at a glance.' : selectedCourse ? `${selectedCourse.code} · ${selectedCourse.program || ''} ${selectedCourse.branchName || selectedCourse.department || ''} · ${selectedCourse.batch || 'Batch not set'}` : 'Your assigned classes, teams, submissions, and messages.'}</div></div>
      <button className="btn btn-secondary" onClick={() => refreshCourses()} disabled={busy}><RefreshCw size={16} /> Refresh</button>
    </header>
    {error && <div role="alert" style={{ ...card, borderColor: '#fecaca', color: '#b91c1c', marginBottom: 16 }}>{error}</div>}
    {notice && <div role="status" style={{ ...card, borderColor: '#a7f3d0', color: '#047857', marginBottom: 16 }}>{notice}</div>}
    {view === 'dashboard' && <div className="faculty-summary-grid" aria-label="Teaching summary">
      {[[BookOpen, summary.subjects, 'My Subjects', '#2563eb'], [Users, summary.teams, 'Project Teams', '#7c3aed'], [ClipboardCheck, summary.pendingReviews, 'Pending Reviews', '#d97706'], [Clock3, summary.activeLabs, 'Active Lab Tasks', '#0891b2']].map(([Icon, count, label, tone]) => <article className="faculty-summary-card" key={label}><span className="faculty-summary-icon" style={{ color: tone, background: `${tone}12` }}><Icon size={20} /></span><div><strong>{loadingCourses ? '—' : count}</strong><span>{label}</span></div></article>)}
    </div>}
    {view === 'profile' ? <div style={{ ...card, maxWidth: 760 }}><h2 style={{ marginTop: 0, color: '#172033' }}>Faculty details</h2><p style={{ color: '#64748b' }}>Keep your teaching profile current so students and your institution can identify you.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>{[['name','Full name'],['designation','Designation'],['department','Department / branch'],['avatarUrl','Profile picture URL']].map(([key,label]) => <label key={key}>{label}<input style={input} value={profile[key]} onChange={e => setProfile({ ...profile, [key]: e.target.value })} /></label>)}<label>Or upload profile picture<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={input} onChange={handleFacultyPhoto} /><small style={{ color: '#64748b' }}>Image up to 5 MB</small></label></div><label style={{ display: 'block', marginTop: 14 }}>About / areas of expertise<textarea style={{ ...input, minHeight: 100 }} value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} /></label><div style={{ marginTop: 16, color: '#64748b' }}>Institution ID: <strong style={{ color: '#1e293b' }}>{user?.institutionId || 'Not linked yet'}</strong> · <a href="/institutions" style={{ color: '#2563eb' }}>Find your institution</a></div><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveProfile} disabled={busy}><Save size={16} /> Save profile</button></div> : <div style={{ display: 'grid', gridTemplateColumns: showSubjectCards ? '1fr' : 'minmax(235px, .75fr) minmax(0,2fr)', gap: 18, alignItems: 'start' }}>
      {!showSubjectCards && <aside style={{ ...card, padding: 12 }}><div style={{ padding: '8px 8px 14px', color: '#64748b', fontWeight: 700 }}>ASSIGNED SUBJECTS · {courses.length}</div>{courses.length === 0 && <p style={{ color: '#64748b', padding: 8 }}>No assigned subjects yet. Ask your coordinator to assign a course to your faculty account.</p>}{courses.map(course => <button key={course.id} onClick={() => openCourse(course.id)} style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 12, padding: 14, marginBottom: 8, background: course.id === selectedId ? '#eff6ff' : 'transparent', border: course.id === selectedId ? '1px solid #93c5fd' : '1px solid transparent', color: '#1e293b', cursor: 'pointer' }}><strong>{course.name}</strong><div style={{ color: '#64748b', marginTop: 5, fontSize: 13 }}>{course.code} · {course.batch || course.branchName || 'Course'}</div></button>)}</aside>}
      <div style={{ display: 'grid', gap: 18 }}>
        {view === 'messages' ? <div style={{ ...card, maxWidth: 800 }}><h2 style={{ marginTop: 0, color: '#172033' }}>Send students a message</h2><p>Choose one class, a specific project team, or all students across every class assigned to you.</p><label>Message audience<select style={input} value={message.audience} onChange={event => setMessage({ ...message, audience: event.target.value, teamId: '' })}><option value="course">All students in one class</option><option value="team">One project team</option><option value="allCourses">All my assigned classes</option></select></label>{message.audience !== 'allCourses' && <label style={{ display: 'block', marginTop: 12 }}>Class / subject<select style={input} value={selectedId} onChange={event => openCourse(event.target.value)}><option value="">Choose a subject</option>{courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.name} · {course.batch}</option>)}</select></label>}{message.audience === 'team' && <label style={{ display: 'block', marginTop: 12 }}>Project team<select style={input} value={message.teamId} onChange={event => setMessage({ ...message, teamId: event.target.value })}><option value="">Choose a team</option>{(detail?.teams || []).map(team => <option key={team.id} value={team.id}>{team.teamNumber ? `Roll code ${team.teamNumber} · ` : ''}{team.name}</option>)}</select></label>}<label style={{ display: 'block', marginTop: 12 }}>Title<input style={input} maxLength={120} value={message.title} onChange={event => setMessage({ ...message, title: event.target.value })} /></label><label style={{ display: 'block', marginTop: 12 }}>Message<textarea style={{ ...input, minHeight: 120 }} maxLength={2000} value={message.message} onChange={event => setMessage({ ...message, message: event.target.value })} /></label><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={message.audience === 'allCourses' ? sendAllClassesMessage : sendMessage} disabled={busy || (message.audience !== 'allCourses' && !selectedId) || (message.audience === 'team' && !message.teamId) || !message.title.trim() || !message.message.trim()}><Send size={16} /> {message.audience === 'allCourses' ? 'Send to all assigned classes' : 'Send message'}</button></div> : <>
          {showSubjectCards ? <div className="faculty-subject-grid">
            {loadingCourses ? <div className="faculty-empty-state" role="status">Loading your assigned subjects…</div> : courses.length === 0 ? <div className="faculty-empty-state"><BookOpen size={26} /><h2>No assigned subjects yet</h2><p>Your coordinator’s assigned courses will appear here.</p></div> : courses.map(course => <button className="faculty-subject-card" key={course.id} onClick={() => openCourse(course.id)} style={{ ...card, textAlign: 'left', cursor: 'pointer' }}><div className="faculty-course-code"><span>{course.code}</span><BookOpen size={18} /></div><h2>{course.name}</h2><p className="faculty-course-program">{[course.program, course.branchName].filter(Boolean).join(' · ') || 'Program / branch not set'}</p><div className="faculty-course-meta">{[course.semester, course.batch].filter(Boolean).join(' · ') || 'Class details not set'}</div><div className="faculty-course-coordinator">{course.assignedByName ? `Assigned by ${course.assignedByName}` : 'Coordinator not recorded'}</div><div className="faculty-course-counts"><span>{course.teamCount ?? '—'} teams</span><span>{course.pendingReviewCount ?? '—'} pending reviews</span></div><div className="faculty-course-action">{view === 'teams' ? 'View Teams' : view === 'labs' ? 'View Lab Tasks' : 'View Class'} <ArrowLeft size={15} style={{ transform: 'rotate(180deg)' }} /></div></button>)}
          </div> : <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><button className="btn btn-secondary" onClick={() => { setSelectedId(''); setDetail(null); setSelectedTeamId(''); }}><ArrowLeft size={16} /> All subjects</button>{selectedCourse && <span style={{ color: '#64748b' }}>{selectedCourse.assignedByName ? `Assigned by ${selectedCourse.assignedByName}` : 'Coordinator not recorded'}</span>}</div>
            <div style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}><div><div style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedCourse.program || 'Program not set'} · {selectedCourse.branchName || 'Branch not set'} · {selectedCourse.sessionName || 'Academic session'}{selectedCourse.semester ? ` · ${selectedCourse.semester}` : ''}</div><h2 style={{ margin: '8px 0' }}>{selectedCourse.name}</h2><p style={{ color: '#94a3b8', margin: 0 }}>{selectedCourse.description || selectedCourse.projectBrief || 'Course details are ready. Set the project brief and team rules below.'}</p></div><div style={{ display: 'flex', gap: 18 }}><div><strong style={{ fontSize: 24 }}>{detail?.students?.length || 0}</strong><div style={{ color: '#94a3b8' }}>students</div></div><div><strong style={{ fontSize: 24 }}>{detail?.teams?.length || 0}</strong><div style={{ color: '#94a3b8' }}>teams</div></div></div></div>
            {view !== 'teams' && view !== 'labs' && <><div style={{ ...card }}><h2 style={{ marginTop: 0 }}>Project brief & team rules</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 12 }}>{[['minMembers','Minimum team size'],['maxMembers','Maximum team size'],['minFemaleMembers','Minimum women members']].map(([key,label]) => <label key={key}>{label}<input type="number" min="0" max="10" style={input} value={rules[key]} onChange={e => setRules({ ...rules, [key]: e.target.value })} /></label>)}<label>Project deadline<input type="date" style={input} value={rules.projectDeadline} onChange={e => setRules({ ...rules, projectDeadline: e.target.value })} /></label></div><label style={{ display: 'block', marginTop: 12 }}>Project instructions<textarea style={{ ...input, minHeight: 110 }} maxLength={5000} value={rules.projectBrief} onChange={e => setRules({ ...rules, projectBrief: e.target.value })} placeholder="What should teams build? Include deliverables and review expectations." /></label><button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveRules} disabled={busy}><Save size={16} /> Save project rules</button></div>
            <div style={card}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div><h2 style={{ margin: 0 }}>Student roster</h2><p style={{ color: '#94a3b8', marginBottom: 0 }}>Name, roll number and student profile picture</p></div><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Search size={16} /><input style={{ ...input, width: 220, margin: 0 }} placeholder="Search name or roll no." value={query} onChange={e => setQuery(e.target.value)} /></label></div>{(detail?.students || []).length === 0 && <p style={{ color: '#94a3b8' }}>No students are enrolled. Add eligible branch students below.</p>}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10, marginTop: 16 }}>{visibleStudents.map(student => <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(255,255,255,.035)', borderRadius: 12, padding: 12 }}><Avatar person={student} /><div style={{ minWidth: 0 }}><strong style={{ display: 'block' }}>{student.name}</strong><span style={{ color: '#94a3b8', fontSize: 13 }}>{student.rollNumber || 'Roll no. not added'}</span></div></div>)}</div>{(detail?.eligibleStudents || []).length > 0 && <details style={{ marginTop: 18 }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Enroll students from {selectedCourse.branchName || 'this branch'} ({detail.eligibleStudents.length} available)</summary><div style={{ maxHeight: 250, overflowY: 'auto', margin: '12px 0' }}>{detail.eligibleStudents.map(student => <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8 }}><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={e => setSelectedStudents(e.target.checked ? [...selectedStudents, student.id] : selectedStudents.filter(id => id !== student.id))} /><Avatar person={student} size={32} /><span>{student.name} · {student.rollNumber || student.email}</span></label>)}</div><button className="btn btn-secondary" onClick={enroll} disabled={busy || !selectedStudents.length}><CheckCircle2 size={16} /> Enroll selected</button></details>}</div></>}
            {view !== 'labs' && <div style={card}>
              <h2 style={{ marginTop: 0 }}>Class activity & project teams</h2>
              <p style={{ color: '#94a3b8', marginTop: 0 }}>Select a team to inspect its project, members, repository activity and lab submissions.</p>
              {(detail?.teams || []).length === 0 && <p style={{ color: '#94a3b8' }}>Teams will appear here as students form them in this class.</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                {(detail?.teams || []).map(team => <button className="faculty-team-card" key={team.id} onClick={() => setSelectedTeamId(team.id)} style={{ ...card, textAlign: 'left', cursor: 'pointer', padding: 14, borderColor: selectedTeamId === team.id ? '#93c5fd' : '#e5eaf2' }}><span className="faculty-roll-code">ROLL CODE · {team.teamNumber || 'Not set'}</span><strong style={{ display: 'block', margin: '7px 0' }}>{team.name}</strong><span className="faculty-permanent-id">Team ID · {team.teamId || team.id}</span><span className="faculty-team-meta">{team.members.length} members{team.projectStatus ? ` · ${team.projectStatus}` : ''}{team.progressPercentage !== null && team.progressPercentage !== undefined ? ` · ${team.progressPercentage}% progress` : ''}</span>{submissionsForTeam(team.id).length > 0 && <span className="faculty-team-meta">Latest submission · {submissionsForTeam(team.id).at(-1).status}</span>}<span className="faculty-team-action">View Project →</span></button>)}
              </div>
              {selectedTeamId && (() => {
                const team = detail?.teams?.find(row => String(row.id) === String(selectedTeamId));
                if (!team) return null;
                return <div style={{ borderTop: '1px solid rgba(148,163,184,.18)', marginTop: 18, paddingTop: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div><div className="faculty-roll-code">ROLL CODE · {team.teamNumber || 'Not set'}</div><h3 style={{ margin: '5px 0' }}>{team.name}</h3><div className="faculty-permanent-id">Permanent Team ID · {team.teamId || team.id}</div></div><div style={{ display: 'flex', gap: 8 }}><button className="btn btn-secondary" onClick={() => goToMessages(team)}><Send size={15} /> Message team</button><button className="btn btn-secondary" onClick={() => setSelectedTeamId('')}>Close details</button></div></div>
                  <div style={{ ...card, marginTop: 12 }}><h4 style={{ margin: '0 0 8px' }}>Project overview</h4><p style={{ whiteSpace: 'pre-wrap' }}>{team.description || 'Project overview has not been added.'}</p><div className="faculty-status-editor" style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1fr) minmax(110px,.55fr) auto', gap: 10, alignItems: 'end' }}><label>Project status<select data-status style={input} defaultValue={team.projectStatus || ''} id={`status-${team.id}`}><option value="">Set status</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label><label>Progress %<input data-progress type="number" min="0" max="100" style={input} defaultValue={team.progressPercentage ?? ''} id={`progress-${team.id}`} /></label><button className="btn btn-secondary" onClick={() => updateTeam(team, document.getElementById(`status-${team.id}`).value, document.getElementById(`progress-${team.id}`).value)} disabled={busy}><Save size={15} /> Save status</button></div>{team.progressPercentage !== null && team.progressPercentage !== undefined && <div className="faculty-progress-track" aria-label={`Project progress ${team.progressPercentage}%`}><div style={{ width: `${Math.max(0, Math.min(100, team.progressPercentage))}%` }} /></div>}</div>
                  <div style={{ ...card, marginTop: 12 }}><h4 style={{ margin: '0 0 12px' }}>Team members</h4><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 9 }}>{team.members.map(member => <div key={member.email} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.035)', borderRadius: 10, padding: 10 }}><Avatar person={member} size={36} /><div><strong>{member.name}</strong><div style={{ color: '#94a3b8', fontSize: 12 }}>{member.rollNumber || 'Roll no. missing'}{member.isLeader ? ' · Team lead' : ''}</div>{member.githubUrl && <a href={member.githubUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontSize: 12 }}>Student GitHub ↗</a>}</div></div>)}</div></div>
                  <div style={{ ...card, marginTop: 12 }}><h4 style={{ margin: '0 0 8px' }}>GitHub repository & activity</h4>{team.githubUrl && <a href={team.githubUrl} target="_blank" rel="noreferrer"><Github size={15} /> {team.githubUrl} <ExternalLink size={13} /></a>}<div className="faculty-github-summary">{team.evidence?.connected ? `${team.evidence.totalCommits || 0} commits · ${team.evidence.totalPRs || 0} pull requests · ${team.evidence.totalContributors || 0} contributors (live sync)` : team.githubUrl ? 'Repository is linked; live contribution data has not synced.' : 'No repository is connected yet.'}</div>{contributorRows(team).length > 0 && <><h5>Contributor identities</h5><div className="faculty-contributor-grid">{contributorRows(team).map(person => <div key={person.login} className="faculty-contributor-card">{person.avatar && <img src={person.avatar} alt="" />}{person.student ? <div><strong>{person.student.name}</strong><small>@{person.login} · {person.commits || 0} commits</small></div> : <div><strong>Unmatched GitHub account</strong><small>@{person.login} · {person.commits || 0} commits · not attributed to a student</small></div>}</div>)}</div></>}<div className="faculty-repository-editor" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) auto', gap: 10, alignItems: 'end', marginTop: 10 }}><label>Team GitHub repository<input style={input} value={repoUrls[team.id] || ''} onChange={event => setRepoUrls(current => ({ ...current, [team.id]: event.target.value }))} placeholder="https://github.com/owner/repository" /></label><button className="btn btn-secondary" onClick={() => connectTeamRepository(team)} disabled={busy}><Github size={15} /> Connect / sync</button></div></div>
                  <div style={{ ...card, marginTop: 12 }}><h4 style={{ margin: '0 0 12px' }}>Lab submissions & feedback</h4>{submissionsForTeam(team.id).length === 0 ? <p>No lab work has been submitted by this team yet.</p> : submissionsForTeam(team.id).map(submission => <article key={submission.id || submission._id} className="faculty-submission-card"><strong>{submission.labTitle}</strong><div className="faculty-permanent-id">{submission.status} · {new Date(submission.submittedAt).toLocaleString()}</div>{submission.content && <pre>{submission.content}</pre>}{submission.fileData && <a href={submission.fileData} download={submission.fileName || 'team-work'}>Open / download {submission.fileName || 'team file'}</a>}{submission.feedback && <p>Faculty feedback: {submission.feedback}</p>}</article>)}</div>
                </div>;
              })()}
            </div>}
            {view !== 'teams' && <div style={card}><h2 style={{ marginTop: 0 }}>Timed lab tasks & submissions</h2><p style={{ color: '#94a3b8' }}>Set a 1-hour or 2-hour class task, then open uploaded work here for review.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}><label>Task title<input style={input} value={labForm.title} onChange={event => setLabForm({ ...labForm, title: event.target.value })} placeholder="e.g. Build a REST endpoint" /></label><label>Time limit<select style={input} value={labForm.durationMinutes} onChange={event => setLabForm({ ...labForm, durationMinutes: Number(event.target.value) })}><option value={60}>1 hour</option><option value={120}>2 hours</option></select></label></div><label style={{ display: 'block', marginTop: 10 }}>Instructions<textarea style={{ ...input, minHeight: 80 }} value={labForm.instructions} onChange={event => setLabForm({ ...labForm, instructions: event.target.value })} placeholder="Describe exactly what teams should complete." /></label><button className="btn btn-primary" style={{ marginTop: 12 }} onClick={createLab} disabled={busy || !labForm.title.trim() || !labForm.instructions.trim()}><Save size={15} /> Start timed lab</button>{labs.map(lab => <div key={lab.id || lab._id} style={{ borderTop: '1px solid rgba(148,163,184,.18)', marginTop: 16, paddingTop: 14 }}><strong>{lab.title}</strong><div style={{ color: '#94a3b8', margin: '5px 0 10px' }}>{lab.durationMinutes / 60} hour · due {new Date(lab.dueAt).toLocaleTimeString()} · {lab.submissions.length} submissions</div><p style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>{lab.instructions}</p>{lab.submissions.map(submission => <div key={submission.id || submission._id} style={{ background: 'rgba(255,255,255,.035)', borderRadius: 10, padding: 12, marginTop: 8 }}><strong>Roll code {submission.teamNumber} · {submission.teamName}</strong><div className="faculty-permanent-id">Team ID · {submission.teamId || 'Not recorded'}</div><div style={{ color: '#94a3b8', fontSize: 12 }}>Submitted {new Date(submission.submittedAt).toLocaleString()} · {submission.status}</div>{submission.content && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', color: '#cbd5e1' }}>{submission.content}</pre>}{submission.fileData && <a href={submission.fileData} download={submission.fileName || 'lab-submission'} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Open / download {submission.fileName}</a>}<div style={{ display: 'flex', gap: 8, marginTop: 9 }}><button className="btn btn-secondary" onClick={() => reviewLab(lab, submission, 'Reviewed')}>Mark reviewed</button><button className="btn btn-secondary" onClick={() => reviewLab(lab, submission, 'Needs revision')}>Request revision</button></div>{submission.feedback && <p style={{ color: '#fbbf24' }}>Feedback: {submission.feedback}</p>}</div>)}</div>)}</div>}
            {(detail?.projects || []).length > 0 && <div style={card}><h2 style={{ marginTop: 0 }}>Repository activity</h2>{detail.projects.map(project => <div key={project.id} style={{ borderTop: '1px solid rgba(148,163,184,.15)', padding: '14px 0', display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}><div><strong>{project.name}</strong><div style={{ color: '#94a3b8', marginTop: 4 }}>{project.status || 'Status not set'} · {project.evidence ? `${project.evidence.totalCommits || 0} commits · ${project.evidence.totalPRs || 0} pull requests` : 'GitHub evidence not connected'}</div></div>{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}><Github size={15} /> Open repository <ExternalLink size={13} /></a>}</div>)}</div>}
          </>}
        </>}
      </div>
    </div>}
  </section>;
}
