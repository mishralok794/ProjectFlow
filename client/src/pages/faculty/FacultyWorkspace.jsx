import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Users, Send, Save, RefreshCw, Github, ExternalLink, UserRound, Search, CheckCircle2 } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const card = { background: 'rgba(17,24,39,.78)', border: '1px solid rgba(148,163,184,.18)', borderRadius: 16, padding: 20 };
const input = { width: '100%', background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 9, padding: '10px 12px', marginTop: 6 };
const statuses = ['Not started', 'In progress', 'Submitted', 'Under review', 'Completed'];

function Avatar({ person, size = 42 }) {
  return person?.avatarUrl ? <img src={person.avatarUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#0369a1,#4f46e5)', color: 'white', fontWeight: 700 }}>{(person?.name || '?').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>;
}

export function FacultyWorkspace({ initialView = 'courses' }) {
  const { user, updateProfile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [rules, setRules] = useState({ minMembers: 4, maxMembers: 5, minFemaleMembers: 0, projectBrief: '', projectDeadline: '' });
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [repoUrls, setRepoUrls] = useState({});
  const [message, setMessage] = useState({ audience: 'course', teamId: '', title: '', message: '' });
  const [profile, setProfile] = useState({ name: user?.name || '', designation: user?.designation || '', department: user?.department || '', bio: user?.bio || '', avatarUrl: user?.avatarUrl || '' });

  const refreshCourses = async () => {
    setBusy(true); setError('');
    try {
      const rows = await api.getFacultyCourses();
      setCourses(rows);
      if (selectedId && rows.some(row => row.id === selectedId)) await loadDetail(selectedId);
      else if (rows.length) { setSelectedId(rows[0].id); await loadDetail(rows[0].id); }
      else { setSelectedId(''); setDetail(null); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const loadDetail = async id => {
    if (!id) return;
    try {
      const data = await api.getFacultyCourse(id);
      data.projects = await Promise.all((data.projects || []).map(async project => {
        try { return { ...project, evidence: await api.getGitHubEvidence(project.id) }; }
        catch { return { ...project, evidence: null }; }
      }));
      data.teams = await Promise.all((data.teams || []).map(async team => {
        try { return { ...team, evidence: await api.getGitHubEvidence(team.id) }; }
        catch { return { ...team, evidence: null }; }
      }));
      setRepoUrls(Object.fromEntries(data.teams.map(team => [team.id, team.githubUrl || team.evidence?.repoUrl || ''])));
      setDetail(data);
      setRules({ minMembers: data.course.teamRules?.minMembers ?? 4, maxMembers: data.course.teamRules?.maxMembers ?? 5, minFemaleMembers: data.course.teamRules?.minFemaleMembers ?? 0, projectBrief: data.course.projectBrief || '', projectDeadline: data.course.projectDeadline ? data.course.projectDeadline.slice(0, 10) : '' });
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { refreshCourses(); }, []);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);
  const selectedCourse = detail?.course;
  const visibleStudents = useMemo(() => (detail?.students || []).filter(person => `${person.name} ${person.rollNumber} ${person.email}`.toLowerCase().includes(query.toLowerCase())), [detail, query]);

  const run = async action => { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const saveRules = () => run(async () => { await api.updateFacultyCourseRules(selectedId, { teamRules: { minMembers: Number(rules.minMembers), maxMembers: Number(rules.maxMembers), minFemaleMembers: Number(rules.minFemaleMembers) }, projectBrief: rules.projectBrief, projectDeadline: rules.projectDeadline || null }); await loadDetail(selectedId); setNotice('Project brief and team rules saved.'); });
  const enroll = () => run(async () => { const result = await api.enrollFacultyCourseStudents(selectedId, selectedStudents); setSelectedStudents([]); await loadDetail(selectedId); setNotice(`${result.enrolled} student(s) enrolled in this course.`); });
  const updateTeam = (team, projectStatus, progressPercentage) => run(async () => { await api.updateFacultyTeamStatus(selectedId, team.id, { projectStatus, progressPercentage: Number(progressPercentage) }); await loadDetail(selectedId); setNotice(`${team.name} progress updated.`); });
  const connectTeamRepository = team => run(async () => {
    const githubUrl = String(repoUrls[team.id] || '').trim();
    if (!githubUrl) throw new Error('Enter the GitHub repository URL first.');
    await api.updateFacultyTeamRepository(selectedId, team.id, githubUrl);
    await api.connectGitHub({ projectId: team.id, repoUrl: githubUrl, useDemoMode: false });
    await loadDetail(selectedId);
    setNotice(`GitHub connected for ${team.name}.`);
  });
  const sendMessage = () => run(async () => { const result = await api.sendFacultyCourseMessage({ courseId: selectedId, ...message }); setNotice(`Message sent to ${result.sent} ${result.sent === 1 ? 'recipient' : 'recipients'}.`); setMessage(current => ({ ...current, title: '', message: '' })); });
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

  return <section style={{ padding: '12px 4px 40px', color: '#e2e8f0' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div><div style={{ color: '#38bdf8', fontSize: 12, letterSpacing: 2, fontWeight: 800 }}>FACULTY WORKSPACE</div><h1 style={{ color: 'white', fontSize: 30, margin: '8px 0' }}>{view === 'profile' ? 'Your teaching profile' : view === 'messages' ? 'Course messages' : selectedCourse?.name || 'Your assigned courses'}</h1><div style={{ color: '#94a3b8' }}>{selectedCourse ? `${selectedCourse.code} · ${selectedCourse.branchName || selectedCourse.department || 'Institution course'} · ${selectedCourse.batch || 'Batch not set'}` : 'Courses assigned by your coordinator appear here.'}</div></div>
      <button className="btn btn-secondary" onClick={() => refreshCourses()} disabled={busy}><RefreshCw size={16} /> Refresh</button>
    </header>
    {error && <div role="alert" style={{ ...card, borderColor: '#be123c', color: '#fda4af', marginBottom: 16 }}>{error}</div>}
    {notice && <div role="status" style={{ ...card, borderColor: '#059669', color: '#6ee7b7', marginBottom: 16 }}>{notice}</div>}
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {[['courses', 'Courses', BookOpen], ['messages', 'Messages', Send], ['profile', 'My profile', UserRound]].map(([key, label, Icon]) => <button key={key} className={view === key ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView(key)}><Icon size={16} />{label}</button>)}
    </nav>
    {view === 'profile' ? <div style={{ ...card, maxWidth: 760 }}><h2 style={{ marginTop: 0 }}>Faculty details</h2><p style={{ color: '#94a3b8' }}>Keep your teaching profile current so students and your institution can identify you.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>{[['name','Full name'],['designation','Designation'],['department','Department / branch'],['avatarUrl','Profile picture URL']].map(([key,label]) => <label key={key}>{label}<input style={input} value={profile[key]} onChange={e => setProfile({ ...profile, [key]: e.target.value })} /></label>)}<label>Or upload profile picture<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={input} onChange={handleFacultyPhoto} /><small style={{ color: '#94a3b8' }}>Image up to 5 MB</small></label></div><label style={{ display: 'block', marginTop: 14 }}>About / areas of expertise<textarea style={{ ...input, minHeight: 100 }} value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} /></label><div style={{ marginTop: 16, color: '#94a3b8' }}>Institution ID: <strong style={{ color: '#e2e8f0' }}>{user?.institutionId || 'Not linked yet'}</strong> · <a href="/institutions" style={{ color: '#38bdf8' }}>Find your institution</a></div><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveProfile} disabled={busy}><Save size={16} /> Save profile</button></div> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(235px, .75fr) minmax(0,2fr)', gap: 18, alignItems: 'start' }}>
      <aside style={{ ...card, padding: 12 }}><div style={{ padding: '8px 8px 14px', color: '#94a3b8', fontWeight: 700 }}>ASSIGNED COURSES · {courses.length}</div>{courses.length === 0 && <p style={{ color: '#94a3b8', padding: 8 }}>No assigned courses found. Ask your coordinator to assign a course to your faculty account.</p>}{courses.map(course => <button key={course.id} onClick={() => setSelectedId(course.id)} style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 12, padding: 14, marginBottom: 8, background: course.id === selectedId ? 'rgba(14,165,233,.15)' : 'transparent', border: course.id === selectedId ? '1px solid #0284c7' : '1px solid transparent', color: 'white', cursor: 'pointer' }}><strong>{course.name}</strong><div style={{ color: '#94a3b8', marginTop: 5, fontSize: 13 }}>{course.code} · {course.batch || course.branchName || 'Course'}</div></button>)}</aside>
      <div style={{ display: 'grid', gap: 18 }}>
        {view === 'messages' ? <div style={card}><h2 style={{ marginTop: 0 }}>Send a course message</h2><p style={{ color: '#94a3b8' }}>Send an announcement to everyone enrolled in a course or privately target one project team.</p><label>Course<select style={input} value={selectedId} onChange={e => setSelectedId(e.target.value)}>{courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></label><label style={{ display: 'block', marginTop: 12 }}>Audience<select style={input} value={message.audience} onChange={e => setMessage({ ...message, audience: e.target.value, teamId: '' })}><option value="course">All enrolled students</option><option value="team">A specific project team</option></select></label>{message.audience === 'team' && <label style={{ display: 'block', marginTop: 12 }}>Project team<select style={input} value={message.teamId} onChange={e => setMessage({ ...message, teamId: e.target.value })}><option value="">Choose a team</option>{(detail?.teams || []).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}<label style={{ display: 'block', marginTop: 12 }}>Title<input style={input} maxLength={120} value={message.title} onChange={e => setMessage({ ...message, title: e.target.value })} /></label><label style={{ display: 'block', marginTop: 12 }}>Message<textarea style={{ ...input, minHeight: 120 }} maxLength={2000} value={message.message} onChange={e => setMessage({ ...message, message: e.target.value })} /></label><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={sendMessage} disabled={busy || !selectedId}><Send size={16} /> Send message</button></div> : <>
          {!selectedCourse ? <div style={card}><BookOpen size={26} /><h2>No assigned courses yet</h2><p style={{ color: '#94a3b8' }}>When your coordinator assigns you a course, students, project teams, notices and progress will appear here.</p></div> : <>
            <div style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}><div><div style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedCourse.sessionName || 'Academic session'}{selectedCourse.semester ? ` · Semester ${selectedCourse.semester}` : ''}</div><h2 style={{ margin: '8px 0' }}>{selectedCourse.name}</h2><p style={{ color: '#94a3b8', margin: 0 }}>{selectedCourse.description || selectedCourse.projectBrief || 'Course details are ready. Set the project brief and team rules below.'}</p></div><div style={{ display: 'flex', gap: 18 }}><div><strong style={{ fontSize: 24 }}>{detail?.students?.length || 0}</strong><div style={{ color: '#94a3b8' }}>students</div></div><div><strong style={{ fontSize: 24 }}>{detail?.teams?.length || 0}</strong><div style={{ color: '#94a3b8' }}>teams</div></div></div></div>
            <div style={{ ...card }}><h2 style={{ marginTop: 0 }}>Project brief & team rules</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 12 }}>{[['minMembers','Minimum team size'],['maxMembers','Maximum team size'],['minFemaleMembers','Minimum women members']].map(([key,label]) => <label key={key}>{label}<input type="number" min="0" max="10" style={input} value={rules[key]} onChange={e => setRules({ ...rules, [key]: e.target.value })} /></label>)}<label>Project deadline<input type="date" style={input} value={rules.projectDeadline} onChange={e => setRules({ ...rules, projectDeadline: e.target.value })} /></label></div><label style={{ display: 'block', marginTop: 12 }}>Project instructions<textarea style={{ ...input, minHeight: 110 }} maxLength={5000} value={rules.projectBrief} onChange={e => setRules({ ...rules, projectBrief: e.target.value })} placeholder="What should teams build? Include deliverables and review expectations." /></label><button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveRules} disabled={busy}><Save size={16} /> Save project rules</button></div>
            <div style={card}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div><h2 style={{ margin: 0 }}>Student roster</h2><p style={{ color: '#94a3b8', marginBottom: 0 }}>Name, roll number and student profile picture</p></div><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Search size={16} /><input style={{ ...input, width: 220, margin: 0 }} placeholder="Search name or roll no." value={query} onChange={e => setQuery(e.target.value)} /></label></div>{(detail?.students || []).length === 0 && <p style={{ color: '#94a3b8' }}>No students are enrolled. Add eligible branch students below.</p>}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10, marginTop: 16 }}>{visibleStudents.map(student => <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(255,255,255,.035)', borderRadius: 12, padding: 12 }}><Avatar person={student} /><div style={{ minWidth: 0 }}><strong style={{ display: 'block' }}>{student.name}</strong><span style={{ color: '#94a3b8', fontSize: 13 }}>{student.rollNumber || 'Roll no. not added'}</span></div></div>)}</div>{(detail?.eligibleStudents || []).length > 0 && <details style={{ marginTop: 18 }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Enroll students from {selectedCourse.branchName || 'this branch'} ({detail.eligibleStudents.length} available)</summary><div style={{ maxHeight: 250, overflowY: 'auto', margin: '12px 0' }}>{detail.eligibleStudents.map(student => <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8 }}><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={e => setSelectedStudents(e.target.checked ? [...selectedStudents, student.id] : selectedStudents.filter(id => id !== student.id))} /><Avatar person={student} size={32} /><span>{student.name} · {student.rollNumber || student.email}</span></label>)}</div><button className="btn btn-secondary" onClick={enroll} disabled={busy || !selectedStudents.length}><CheckCircle2 size={16} /> Enroll selected</button></details>}</div>
            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Project teams & progress</h2>
              {(detail?.teams || []).length === 0 && <p style={{ color: '#94a3b8' }}>Teams will appear here as students form them in this course.</p>}
              {(detail?.teams || []).map(team => <div key={team.id} style={{ borderTop: '1px solid rgba(148,163,184,.15)', padding: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div><strong>{team.name}</strong><div style={{ color: '#94a3b8', marginTop: 5 }}>{team.members.length} members · {team.members.map(member => member.name || member.email).join(', ')}</div></div>
                  {team.githubUrl && <a href={team.githubUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}><Github size={15} /> Repository <ExternalLink size={13} /></a>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1fr) minmax(110px,.55fr) auto', gap: 10, alignItems: 'end', marginTop: 12 }}>
                  <label>Project status<select data-status style={input} defaultValue={team.projectStatus} id={`status-${team.id}`}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
                  <label>Progress %<input data-progress type="number" min="0" max="100" style={input} defaultValue={team.progressPercentage} id={`progress-${team.id}`} /></label>
                  <button className="btn btn-secondary" onClick={() => updateTeam(team, document.getElementById(`status-${team.id}`).value, document.getElementById(`progress-${team.id}`).value)} disabled={busy}><Save size={15} /> Update</button>
                </div>
                <div style={{ height: 6, background: '#1e293b', borderRadius: 9, marginTop: 10 }}><div style={{ height: 6, width: `${Math.max(0, Math.min(100, team.progressPercentage))}%`, background: '#22c55e', borderRadius: 9 }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) auto', gap: 10, alignItems: 'end', marginTop: 14 }}>
                  <label>GitHub repository URL<input style={input} value={repoUrls[team.id] || ''} onChange={event => setRepoUrls(current => ({ ...current, [team.id]: event.target.value }))} placeholder="https://github.com/owner/repository" /></label>
                  <button className="btn btn-secondary" onClick={() => connectTeamRepository(team)} disabled={busy}><Github size={15} /> Connect & sync</button>
                </div>
                {team.evidence?.connected && <div style={{ color: '#94a3b8', marginTop: 10 }}>{team.evidence.totalCommits || 0} commits · {team.evidence.totalPRs || 0} pull requests · {team.evidence.totalContributors || 0} contributors {team.evidence.dataSource === 'live' ? '· Live GitHub data' : '· Demo data'}</div>}
              </div>)}
            </div>
            {(detail?.projects || []).length > 0 && <div style={card}><h2 style={{ marginTop: 0 }}>Repository activity</h2>{detail.projects.map(project => <div key={project.id} style={{ borderTop: '1px solid rgba(148,163,184,.15)', padding: '14px 0', display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}><div><strong>{project.name}</strong><div style={{ color: '#94a3b8', marginTop: 4 }}>{project.status || 'Status not set'} · {project.evidence ? `${project.evidence.totalCommits || 0} commits · ${project.evidence.totalPRs || 0} pull requests` : 'GitHub evidence not connected'}</div></div>{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}><Github size={15} /> Open repository <ExternalLink size={13} /></a>}</div>)}</div>}
          </>}
        </>}
      </div>
    </div>}
  </section>;
}
