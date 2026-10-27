import React, { useState, useEffect, useMemo } from 'react';
import { api, getUser } from '../../api';
import {
  ChevronRight,
  ArrowLeft,
  BookOpen,
  Globe,
  Cpu,
  Database,
  Layers,
  FileText,
  Download,
  Users,
  Megaphone,
  FolderArchive,
  Info,
  Calendar,
  User,
  AlertCircle,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Pin,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  Paperclip,
  Clock,
  ShieldCheck,
  Check,
  X,
  Send,
  Trash2,
  Mail,
  LogOut
} from 'lucide-react';

export function CoursePage({ courseId, onBack }) {
  const [course, setCourse] = useState(null);
  const minTeamMembers = Number(course?.teamRules?.minMembers) || 4;
  const maxTeamMembers = Number(course?.teamRules?.maxMembers) || 5;
  const minFemaleMembers = Number(course?.teamRules?.minFemaleMembers) || 0;
  const [announcements, setAnnouncements] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Announcement filter & search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread' | 'pinned'
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [readActionLoading, setReadActionLoading] = useState({});
  const [downloadingFile, setDownloadingFile] = useState(null);

  // Faculty announcement publishing modal (if Faculty or Admin)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    content: '',
    isPinned: false,
    isImportant: false,
    attachmentsText: ''
  });
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [createError, setCreateError] = useState(null);

  // My Team & Team Creation states
  const [myTeam, setMyTeam] = useState(null);
  const [myTeamLoading, setMyTeamLoading] = useState(false);
  const [showCreateTeamDrawer, setShowCreateTeamDrawer] = useState(false);
  const [createTeamLoading, setCreateTeamLoading] = useState(false);
  const [createTeamError, setCreateTeamError] = useState(null);
  const [createTeamSuccess, setCreateTeamSuccess] = useState(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all'); // 'all' | 'available' | 'full'
  const [viewingTeam, setViewingTeam] = useState(null);
  const [joiningTeamId, setJoiningTeamId] = useState(null);
  const [leavingTeamId, setLeavingTeamId] = useState(null);
  const [teamActionMsg, setTeamActionMsg] = useState(null);

  const currentUser = getUser();
  const isFacultyOrAdmin = currentUser && ['faculty', 'admin'].includes((currentUser.role || '').toLowerCase());

  const [createTeamForm, setCreateTeamForm] = useState({
    name: '',
    description: '',
    members: [
      { rollNumber: currentUser?.rollNumber || '20251651013', email: currentUser?.email || 'alka123@iitv.ac.in' },
      { rollNumber: '', email: '' },
      { rollNumber: '', email: '' },
      { rollNumber: '', email: '' }
    ]
  });

  // Load course details
  useEffect(() => {
    async function loadCourse() {
      if (!courseId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await api.getCourse(courseId);
        setCourse(data);
      } catch (err) {
        console.error('Failed to load course details:', err);
        setError(err.message || 'Failed to retrieve course details.');
      } finally {
        setLoading(false);
      }
    }
    loadCourse();
  }, [courseId]);

  // Load announcements whenever courseId or activeTab is announcements/overview
  const fetchAnnouncements = async () => {
    if (!courseId) return;
    try {
      setAnnouncementsLoading(true);
      const data = await api.getCourseAnnouncements(courseId);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load course announcements:', err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  // Load teams
  const fetchTeams = async () => {
    if (!courseId) return;
    try {
      setTeamsLoading(true);
      const data = await api.getCourseTeams(courseId);
      setTeams(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load course teams:', err);
    } finally {
      setTeamsLoading(false);
    }
  };

  // Load My Team
  const fetchMyTeam = async () => {
    if (!courseId) return;
    try {
      setMyTeamLoading(true);
      const data = await api.getMyCourseTeam(courseId);
      setMyTeam(data?.team || null);
    } catch (err) {
      console.warn('Failed to load my course team:', err);
    } finally {
      setMyTeamLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchAnnouncements();
      fetchTeams();
      fetchMyTeam();
    }
  }, [courseId]);

  // Toggle expand/collapse for long announcement message body
  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Mark announcement as read / unread
  const handleToggleRead = async (announcementId, currentIsRead) => {
    try {
      setReadActionLoading(prev => ({ ...prev, [announcementId]: true }));
      const newStatus = !currentIsRead;
      await api.markAnnouncementRead(courseId, announcementId, !newStatus);
      setAnnouncements(prev => prev.map(a => {
        if (a.id === announcementId || a._id === announcementId) {
          return { ...a, isRead: newStatus };
        }
        return a;
      }));
    } catch (err) {
      console.error('Failed to toggle announcement read state:', err);
      alert('Could not update read status: ' + err.message);
    } finally {
      setReadActionLoading(prev => ({ ...prev, [announcementId]: false }));
    }
  };

  // Download attachment
  const handleDownloadAttachment = async (filename) => {
    try {
      setDownloadingFile(filename);
      await api.downloadCourseAttachment(course?.code || courseId, filename);
    } catch (err) {
      console.error('Download error:', err);
      alert('Attachment download failed: ' + err.message);
    } finally {
      setDownloadingFile(null);
    }
  };

  // Create Announcement (Faculty/Admin only)
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.content.trim()) {
      setCreateError('Title and message content are required.');
      return;
    }

    try {
      setSubmittingAnnouncement(true);
      setCreateError(null);

      // Parse comma-separated filenames into attachment objects
      const attachments = createForm.attachmentsText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((name, idx) => ({
          id: `att_${Date.now()}_${idx}`,
          name,
          size: '1.5 MB',
          type: name.endsWith('.pdf') ? 'pdf' : name.endsWith('.docx') ? 'doc' : 'file',
          downloadUrl: `/api/courses/${course?.code || courseId}/attachments/${encodeURIComponent(name)}`
        }));

      await api.createCourseAnnouncement(courseId, {
        title: createForm.title.trim(),
        content: createForm.content.trim(),
        isPinned: createForm.isPinned,
        isImportant: createForm.isImportant,
        attachments
      });

      setShowCreateModal(false);
      setCreateForm({
        title: '',
        content: '',
        isPinned: false,
        isImportant: false,
        attachmentsText: ''
      });
      await fetchAnnouncements();
    } catch (err) {
      console.error('Failed to publish announcement:', err);
      setCreateError(err.message || 'Failed to publish announcement.');
    } finally {
      setSubmittingAnnouncement(false);
    }
  };

  // Filtered and searched announcements
  const filteredAnnouncements = useMemo(() => {
    let result = [...announcements];

    // Filter by tab/filter chips
    if (filterType === 'unread') {
      result = result.filter(a => !a.isRead);
    } else if (filterType === 'pinned') {
      result = result.filter(a => a.isPinned);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.content && a.content.toLowerCase().includes(q)) ||
        (a.facultyName && a.facultyName.toLowerCase().includes(q))
      );
    }

    // Sort: pinned first, then by published date descending
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const dateA = new Date(a.publishedAt || a.date || 0);
      const dateB = new Date(b.publishedAt || b.date || 0);
      return dateB - dateA;
    });

    return result;
  }, [announcements, filterType, searchQuery]);

  const unreadCount = announcements.filter(a => !a.isRead).length;
  const pinnedAnnouncements = announcements.filter(a => a.isPinned);

  // Filtered Course Teams list
  const filteredCourseTeams = useMemo(() => {
    let list = [...teams];

    if (teamStatusFilter === 'available') {
      list = list.filter(t => t.status === 'Available');
    } else if (teamStatusFilter === 'full') {
      list = list.filter(t => t.status === 'Full');
    }

    if (teamSearchQuery.trim()) {
      const q = teamSearchQuery.toLowerCase().trim();
      list = list.filter(t =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.teamLead && t.teamLead.toLowerCase().includes(q)) ||
        (t.members && t.members.some(m =>
          (m.name && m.name.toLowerCase().includes(q)) ||
          (m.rollNumber && m.rollNumber.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q))
        ))
      );
    }

    return list;
  }, [teams, teamStatusFilter, teamSearchQuery]);

  const handleAddMemberRow = () => {
    if (createTeamForm.members.length >= maxTeamMembers) return;
    setCreateTeamForm(prev => ({
      ...prev,
      members: [...prev.members, { rollNumber: '', email: '' }]
    }));
  };

  const handleRemoveMemberRow = (index) => {
    if (createTeamForm.members.length <= minTeamMembers) return;
    if (index === 0) return; // Cannot delete caller / lead
    setCreateTeamForm(prev => ({
      ...prev,
      members: prev.members.filter((_, idx) => idx !== index)
    }));
  };

  const handleMemberChange = (index, field, value) => {
    setCreateTeamForm(prev => {
      const updated = [...prev.members];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, members: updated };
    });
  };

  const handleCreateTeamSubmit = async (e) => {
    e.preventDefault();
    setCreateTeamError(null);
    setCreateTeamSuccess(null);

    if (!createTeamForm.name.trim()) {
      setCreateTeamError('Team name is required.');
      return;
    }

    if (createTeamForm.members.length < minTeamMembers || createTeamForm.members.length > maxTeamMembers) {
      setCreateTeamError(`Team size must be between ${minTeamMembers} and ${maxTeamMembers} members.`);
      return;
    }

    for (let i = 0; i < createTeamForm.members.length; i++) {
      const m = createTeamForm.members[i];
      if (!m.rollNumber.trim() || !m.email.trim()) {
        setCreateTeamError(`Member ${i + 1} roll number and institutional email are required.`);
        return;
      }
    }

    try {
      setCreateTeamLoading(true);
      const payload = {
        name: createTeamForm.name.trim(),
        description: createTeamForm.description.trim(),
        members: createTeamForm.members.map(m => ({
          rollNumber: m.rollNumber.trim(),
          email: m.email.trim()
        }))
      };

      const res = await api.createCourseTeam(courseId, payload);
      setCreateTeamSuccess(res.message || 'Team created successfully!');

      await fetchTeams();
      await fetchMyTeam();

      setTimeout(() => {
        setShowCreateTeamDrawer(false);
        setCreateTeamSuccess(null);
        setCreateTeamForm({
          name: '',
          description: '',
          members: [
            { rollNumber: currentUser?.rollNumber || '20251651013', email: currentUser?.email || 'alka123@iitv.ac.in' },
            { rollNumber: '', email: '' },
            { rollNumber: '', email: '' },
            { rollNumber: '', email: '' }
          ]
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to create team:', err);
      setCreateTeamError(err.message || 'Failed to create team.');
    } finally {
      setCreateTeamLoading(false);
    }
  };

  const handleJoinTeam = async (teamId) => {
    try {
      setJoiningTeamId(teamId);
      setTeamActionMsg(null);
      const res = await api.joinCourseTeam(courseId, teamId);
      setTeamActionMsg({ type: 'success', text: res.message || 'Successfully joined team!' });
      await fetchTeams();
      await fetchMyTeam();
      if (viewingTeam) {
        setViewingTeam(null);
      }
    } catch (err) {
      console.error('Failed to join team:', err);
      setTeamActionMsg({ type: 'error', text: err.message || 'Failed to join team.' });
    } finally {
      setJoiningTeamId(null);
    }
  };

  const handleLeaveTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to leave this team?')) return;
    try {
      setLeavingTeamId(teamId);
      setTeamActionMsg(null);
      const res = await api.leaveCourseTeam(courseId, teamId);
      setTeamActionMsg({ type: 'success', text: res.message || 'Successfully left team.' });
      await fetchTeams();
      await fetchMyTeam();
      if (viewingTeam) {
        setViewingTeam(null);
      }
    } catch (err) {
      console.error('Failed to leave team:', err);
      setTeamActionMsg({ type: 'error', text: err.message || 'Failed to leave team.' });
    } finally {
      setLeavingTeamId(null);
    }
  };

  const getTeamVisual = (teamName = '', index = 0) => {
    const name = (teamName || '').toLowerCase();
    if (name.includes('alpha')) {
      return {
        bg: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
        border: 'rgba(2, 132, 199, 0.4)',
        accent: '#38bdf8'
      };
    }
    if (name.includes('innovator')) {
      return {
        bg: 'linear-gradient(135deg, #064e3b, #0d9488)',
        border: 'rgba(13, 148, 136, 0.4)',
        accent: '#2dd4bf'
      };
    }
    if (name.includes('codecraft')) {
      return {
        bg: 'linear-gradient(135deg, #7c2d12, #d97706)',
        border: 'rgba(217, 119, 6, 0.4)',
        accent: '#fbbf24'
      };
    }
    if (name.includes('nextgen')) {
      return {
        bg: 'linear-gradient(135deg, #831843, #e11d48)',
        border: 'rgba(225, 29, 72, 0.4)',
        accent: '#fb7185'
      };
    }
    const palettes = [
      { bg: 'linear-gradient(135deg, #312e81, #6366f1)', border: 'rgba(99, 102, 241, 0.4)', accent: '#818cf8' },
      { bg: 'linear-gradient(135deg, #581c87, #9333ea)', border: 'rgba(147, 51, 234, 0.4)', accent: '#c084fc' },
      { bg: 'linear-gradient(135deg, #134e4a, #059669)', border: 'rgba(5, 150, 105, 0.4)', accent: '#34d399' }
    ];
    return palettes[index % palettes.length];
  };

  const getInitials = (name = '') => {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '??';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getCourseIcon = (iconName, color) => {
    const props = { size: 28, style: { color: color || '#38bdf8' } };
    switch ((iconName || '').toLowerCase()) {
      case 'globe':
      case 'server':
        return <Globe {...props} />;
      case 'cpu':
      case 'algo':
        return <Cpu {...props} />;
      case 'database':
        return <Database {...props} />;
      case 'layers':
      case 'workflow':
        return <Layers {...props} />;
      default:
        return <BookOpen {...props} />;
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw size={36} className="spinning" style={{ margin: '0 auto 16px auto', color: '#38bdf8' }} />
        <p style={{ fontSize: '1rem', fontWeight: 500 }}>Loading course details and announcements...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{ maxWidth: '780px', margin: '40px auto', padding: '36px', textAlign: 'center' }} className="glass-panel">
        <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
          Unable to Access Course
        </h2>
        <p style={{ color: '#94a3b8', margin: '10px auto 24px auto', maxWidth: '480px', fontSize: '0.95rem', lineHeight: 1.6 }}>
          {error || `Course identifier "${courseId}" could not be resolved or you are not enrolled.`}
        </p>
        <button onClick={onBack} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  const themeColor = course.color || '#0284c7';
  const instructorMsg = course.instructorMessage;

  return (
    <div className="course-detail-view" style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '70px' }}>
      {/* 1. BREADCRUMBS NAVIGATION */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.85rem',
        color: '#94a3b8',
        marginBottom: '20px'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#38bdf8',
            cursor: 'pointer',
            padding: 0,
            fontSize: 'inherit',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
        >
          <ArrowLeft size={14} />
          <span>Student Courses</span>
        </button>
        <ChevronRight size={14} style={{ color: '#64748b' }} />
        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
          {course.code} - {course.name}
        </span>
      </nav>

      {/* 2. COURSE HEADER BANNER (Google Classroom Style Header) */}
      <div style={{
        borderRadius: '20px',
        padding: '30px',
        background: 'rgba(18, 24, 38, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '28px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)'
      }}>
        {/* Color Gradient Top Strip */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '5px',
          background: `linear-gradient(90deg, ${themeColor} 0%, #6366f1 50%, ${themeColor}88 100%)`
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '18px',
              background: `${themeColor}22`,
              border: `1.5px solid ${themeColor}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 24px ${themeColor}25`
            }}>
              {getCourseIcon(course.icon, themeColor)}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: `${themeColor}22`,
                  color: themeColor,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase'
                }}>
                  {course.code}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '3px 10px',
                  borderRadius: '6px'
                }}>
                  {course.semester || '3rd Semester'}
                </span>
                {course.batch && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#94a3b8',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '3px 10px',
                    borderRadius: '6px'
                  }}>
                    Batch {course.batch}
                  </span>
                )}
              </div>

              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', margin: '2px 0 8px 0' }}>
                {course.code} — {course.name}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', fontSize: '0.875rem', color: '#94a3b8' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} style={{ color: '#38bdf8' }} />
                  Faculty: <strong style={{ color: '#f1f5f9' }}>{course.facultyName}</strong>
                </span>
                {course.department && (
                  <>
                    <span style={{ color: '#475569' }}>•</span>
                    <span style={{ color: '#cbd5e1' }}>{course.department}</span>
                  </>
                )}
                {course.facultyEmail && (
                  <>
                    <span style={{ color: '#475569' }}>•</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{course.facultyEmail}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isFacultyOrAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                <Plus size={16} />
                <span>Post Announcement</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. COURSE NAVIGATION TABS */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '28px',
        gap: '6px',
        overflowX: 'auto'
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: BookOpen },
          {
            id: 'announcements',
            label: 'Announcements',
            icon: Megaphone,
            badge: announcements.length > 0 ? announcements.length : null,
            unreadBadge: unreadCount > 0 ? unreadCount : null
          },
          {
            id: 'teams',
            label: 'Teams',
            icon: Users,
            badge: teams.length > 0 ? teams.length : null
          },
          {
            id: 'resources',
            label: 'Resources',
            icon: FolderArchive,
            badge: course.resources?.length || null
          }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '9px',
                padding: '13px 20px',
                border: 'none',
                background: 'transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#94a3b8';
              }}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
              {tab.unreadBadge ? (
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '999px',
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  marginLeft: '2px'
                }}>
                  {tab.unreadBadge} new
                </span>
              ) : tab.badge ? (
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '999px',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 4. TAB PANELS */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Pinned Announcements Alert Highlight (if any) */}
          {pinnedAnnouncements.length > 0 && (
            <div style={{
              borderRadius: '16px',
              padding: '20px 24px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(2, 132, 199, 0.08) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Pin size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.05em' }}>
                    Pinned Course Announcement
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>• {pinnedAnnouncements[0].date}</span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                  {pinnedAnnouncements[0].title}
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {pinnedAnnouncements[0].content}
                </p>
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={() => setActiveTab('announcements')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0
                    }}
                  >
                    <span>View full announcement and attachments in Announcements</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Instructor Message Card (Panel 4 Reference) */}
          {instructorMsg && (
            <div style={{
              borderRadius: '16px',
              padding: '26px',
              background: 'rgba(18, 24, 38, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  {course.facultyName ? course.facultyName.replace('Dr. ', '').slice(0, 2).toUpperCase() : 'FC'}
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                    {instructorMsg.title || 'Message from Course Instructor'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                    {instructorMsg.author || course.facultyName} • {instructorMsg.date || 'Recent'}
                  </div>
                </div>
              </div>

              <div style={{
                color: '#cbd5e1',
                fontSize: '0.92rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-line',
                padding: '18px 22px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.28)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                marginBottom: '20px'
              }}>
                {instructorMsg.content}
              </div>

              {instructorMsg.attachments && instructorMsg.attachments.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    Attached Guidelines & Templates
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {instructorMsg.attachments.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 16px',
                          borderRadius: '10px',
                          background: 'rgba(2, 132, 199, 0.08)',
                          border: '1px solid rgba(2, 132, 199, 0.25)',
                          color: '#f8fafc',
                          fontSize: '0.85rem'
                        }}
                      >
                        <FileText size={18} style={{ color: '#38bdf8' }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{file.name}</div>
                          {file.size && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{file.size}</div>}
                        </div>
                        <button
                          onClick={() => handleDownloadAttachment(file.name)}
                          disabled={downloadingFile === file.name}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            marginLeft: '8px',
                            padding: '4px'
                          }}
                          title="Download document"
                        >
                          {downloadingFile === file.name ? (
                            <RefreshCw size={15} className="spinning" />
                          ) : (
                            <Download size={16} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* About Course Card */}
          <div style={{
            borderRadius: '16px',
            padding: '26px',
            background: 'rgba(18, 24, 38, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
              About This Course
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.65, marginBottom: '20px' }}>
              {course.description}
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 20px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: '0.875rem',
              color: '#cbd5e1'
            }}>
              <Info size={19} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <div>
                <strong>Next Step:</strong> You will form or join a student team in the <strong>Teams</strong> tab.
                You can access all announcements and materials without being part of a team.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FACULTY BROADCAST ANNOUNCEMENTS (Google Classroom Style Feed) */}
      {activeTab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls Bar: Search & Filter Chips */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            padding: '16px 20px',
            borderRadius: '16px',
            background: 'rgba(18, 24, 38, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {/* Search Input */}
            <div style={{
              position: 'relative',
              flex: 1,
              minWidth: '240px',
              maxWidth: '420px'
            }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search announcements, faculty, guidelines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {[
                { id: 'all', label: 'All', count: announcements.length },
                { id: 'unread', label: 'Unread', count: unreadCount },
                { id: 'pinned', label: 'Pinned', count: pinnedAnnouncements.length }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: filterType === f.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: filterType === f.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: filterType === f.id ? '#38bdf8' : '#94a3b8',
                    fontWeight: filterType === f.id ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{f.label}</span>
                  {f.count > 0 && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: filterType === f.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                      color: filterType === f.id ? '#000' : '#cbd5e1'
                    }}>
                      {f.count}
                    </span>
                  )}
                </button>
              ))}

              {isFacultyOrAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}
                >
                  <Plus size={15} />
                  <span>New Announcement</span>
                </button>
              )}
            </div>
          </div>

          {/* Announcements List */}
          {announcementsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 12px auto', color: '#38bdf8' }} />
              <p>Refreshing announcements...</p>
            </div>
          ) : filteredAnnouncements.length > 0 ? (
            filteredAnnouncements.map((ann) => {
              const isExpanded = expandedIds.has(ann.id || ann._id);
              const isLongMessage = ann.content && ann.content.length > 220;
              const displayContent = isLongMessage && !isExpanded
                ? ann.content.slice(0, 220) + '...'
                : ann.content;

              return (
                <div
                  key={ann.id || ann._id}
                  style={{
                    borderRadius: '16px',
                    padding: '24px',
                    background: ann.isPinned
                      ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, rgba(18, 24, 38, 0.75) 100%)'
                      : 'rgba(18, 24, 38, 0.75)',
                    border: ann.isPinned
                      ? '1px solid rgba(245, 158, 11, 0.35)'
                      : ann.isRead
                        ? '1px solid rgba(255, 255, 255, 0.06)'
                        : '1px solid rgba(56, 189, 248, 0.28)',
                    boxShadow: ann.isPinned
                      ? '0 8px 30px rgba(245, 158, 11, 0.08)'
                      : '0 8px 24px rgba(0, 0, 0, 0.25)',
                    position: 'relative',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  {/* Top Bar: Pinned / Important Badges & Date */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {ann.isPinned && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(245, 158, 11, 0.2)',
                          color: '#f59e0b',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase'
                        }}>
                          <Pin size={12} />
                          <span>Pinned</span>
                        </span>
                      )}

                      {ann.isImportant && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          color: '#ef4444',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase'
                        }}>
                          <AlertCircle size={12} />
                          <span>Important</span>
                        </span>
                      )}

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        backgroundColor: ann.isRead ? 'rgba(255, 255, 255, 0.05)' : 'rgba(56, 189, 248, 0.15)',
                        color: ann.isRead ? '#94a3b8' : '#38bdf8'
                      }}>
                        {ann.isRead ? 'Read' : 'Unread'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: '#94a3b8' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={13} style={{ color: '#64748b' }} />
                        {ann.date || 'Recent'}
                      </span>

                      {/* Read / Unread Toggle Button */}
                      <button
                        onClick={() => handleToggleRead(ann.id || ann._id, ann.isRead)}
                        disabled={readActionLoading[ann.id || ann._id]}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: ann.isRead ? '#94a3b8' : '#38bdf8',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.78rem',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          transition: 'background 0.15s ease'
                        }}
                        title={ann.isRead ? 'Mark as unread' : 'Mark as read'}
                      >
                        {ann.isRead ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{ann.isRead ? 'Mark Unread' : 'Mark Read'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Faculty Author Profile */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      flexShrink: 0
                    }}>
                      {ann.facultyName ? ann.facultyName.replace('Dr. ', '').slice(0, 2).toUpperCase() : 'FC'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.18rem', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.015em' }}>
                        {ann.title}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                        Published by <strong style={{ color: '#f1f5f9' }}>{ann.facultyName || course.facultyName}</strong>
                        {ann.facultyEmail && <span> ({ann.facultyEmail})</span>}
                      </div>
                    </div>
                  </div>

                  {/* Message Body with Clean Formatting */}
                  <div style={{
                    color: '#cbd5e1',
                    fontSize: '0.92rem',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    marginBottom: '16px'
                  }}>
                    {displayContent}
                  </div>

                  {/* Expand / Collapse Button if message is long */}
                  {isLongMessage && (
                    <div style={{ marginBottom: '16px' }}>
                      <button
                        onClick={() => toggleExpand(ann.id || ann._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38bdf8',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          padding: 0
                        }}
                      >
                        {isExpanded ? (
                          <>
                            <span>Show less</span>
                            <ChevronUp size={14} />
                          </>
                        ) : (
                          <>
                            <span>Read full announcement</span>
                            <ChevronDown size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Optional Attachments Area */}
                  {ann.attachments && ann.attachments.length > 0 && (
                    <div style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingTop: '14px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '10px'
                      }}>
                        <Paperclip size={14} />
                        <span>Attachments ({ann.attachments.length})</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {ann.attachments.map((file, idx) => (
                          <div
                            key={file.id || idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 16px',
                              borderRadius: '10px',
                              background: 'rgba(2, 132, 199, 0.08)',
                              border: '1px solid rgba(2, 132, 199, 0.25)',
                              color: '#f8fafc',
                              fontSize: '0.85rem'
                            }}
                          >
                            <FileText size={18} style={{ color: '#38bdf8' }} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{file.name}</div>
                              {file.size && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{file.size}</div>}
                            </div>
                            <button
                              onClick={() => handleDownloadAttachment(file.name)}
                              disabled={downloadingFile === file.name}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: '8px',
                                padding: '4px'
                              }}
                              title={`Download ${file.name}`}
                            >
                              {downloadingFile === file.name ? (
                                <RefreshCw size={15} className="spinning" />
                              ) : (
                                <Download size={16} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              borderRadius: '16px',
              background: 'rgba(18, 24, 38, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <Megaphone size={40} style={{ color: '#64748b', margin: '0 auto 14px auto' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                No Announcements Found
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '6px auto 0 auto', maxWidth: '420px' }}>
                {searchQuery
                  ? `No announcements matched "${searchQuery}". Try clearing search filters.`
                  : filterType !== 'all'
                    ? `No ${filterType} announcements for this course.`
                    : 'There are no broadcast announcements for this course yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEAMS TAB (My Team + Teams in this Course) */}
      {activeTab === 'teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Action Feedback Notification */}
          {teamActionMsg && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: teamActionMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${teamActionMsg.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
              color: teamActionMsg.type === 'success' ? '#34d399' : '#f87171',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {teamActionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{teamActionMsg.text}</span>
              </div>
              <button
                onClick={() => setTeamActionMsg(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* 1. MY TEAM SECTION */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8'
              }}>
                <Users size={18} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                My Team
              </h2>
            </div>

            {myTeamLoading ? (
              <div style={{
                padding: '36px',
                textAlign: 'center',
                borderRadius: '16px',
                background: '#0c1527',
                border: '1px solid rgba(56, 189, 248, 0.2)'
              }}>
                <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 10px auto', color: '#38bdf8' }} />
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>Checking team membership...</p>
              </div>
            ) : !myTeam ? (
              /* EMPTY STATE: "You're not in a team yet" matching Reference UI */
              <div style={{
                borderRadius: '16px',
                padding: '36px 32px',
                background: '#0c1527',
                border: '1.5px dashed rgba(56, 189, 248, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '36px',
                flexWrap: 'wrap'
              }}>
                {/* 3-Avatar Graphic with Cyan Plus Icon */}
                <div style={{
                  position: 'relative',
                  width: '130px',
                  height: '84px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {/* Left Avatar */}
                  <div style={{
                    position: 'absolute',
                    left: '6px',
                    top: '16px',
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#1e293b',
                    border: '2.5px solid #0c1527',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}>
                    <User size={22} />
                  </div>
                  {/* Right Avatar */}
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '16px',
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#1e293b',
                    border: '2.5px solid #0c1527',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}>
                    <User size={22} />
                  </div>
                  {/* Center Front Avatar */}
                  <div style={{
                    position: 'absolute',
                    left: '38px',
                    top: '4px',
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                    border: '3px solid #0c1527',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#bfdbfe',
                    zIndex: 2
                  }}>
                    <User size={28} />
                  </div>
                  {/* Cyan Plus Badge */}
                  <div style={{
                    position: 'absolute',
                    right: '6px',
                    bottom: '4px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#0284c7',
                    border: '2.5px solid #0c1527',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    zIndex: 3
                  }}>
                    <Plus size={15} strokeWidth={3} />
                  </div>
                </div>

                {/* Text + Action Buttons */}
                <div style={{ flex: '1 1 360px', maxWidth: '580px' }}>
                  <h3 style={{ fontSize: '1.28rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                    You're not in a team yet
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '20px' }}>
                    Create a team as team lead or check the available teams below to join an existing one.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setCreateTeamError(null);
                        setCreateTeamSuccess(null);
                        setShowCreateTeamDrawer(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 22px',
                        borderRadius: '8px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '0.92rem',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0ea5e9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0284c7'}
                    >
                      <Plus size={17} strokeWidth={2.5} />
                      <span>Create Team</span>
                    </button>

                    <button
                      onClick={() => {
                        setTeamStatusFilter('available');
                        const el = document.getElementById('course-teams-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        fontWeight: 600,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                        e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.7)';
                      }}
                    >
                      <Search size={16} />
                      <span>Find a Team</span>
                      <ChevronDown size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* JOINED STATE: My Team Details Card */
              <div style={{
                borderRadius: '16px',
                padding: '24px 28px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(2, 132, 199, 0.06) 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '1rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}>
                      <Users size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                          {myTeam.name}
                        </h3>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: 'rgba(16, 185, 129, 0.18)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.35)'
                        }}>
                          Joined
                        </span>
                        {myTeam.isLeader && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(245, 158, 11, 0.18)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.35)'
                          }}>
                            Team Lead
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                        Lead: <strong style={{ color: '#f1f5f9' }}>{myTeam.teamLead}</strong> • Capacity: <strong style={{ color: '#38bdf8' }}>{myTeam.memberCount} / {myTeam.maxMembers || 5} Members</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => setViewingTeam(myTeam)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#0284c7',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Eye size={15} />
                      <span>View My Team</span>
                    </button>
                    <button
                      onClick={() => handleLeaveTeam(myTeam.id || myTeam._id)}
                      disabled={leavingTeamId === (myTeam.id || myTeam._id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                      title="Leave this team"
                    >
                      {leavingTeamId === (myTeam.id || myTeam._id) ? (
                        <RefreshCw size={14} className="spinning" />
                      ) : (
                        <LogOut size={14} />
                      )}
                      <span>Leave Team</span>
                    </button>
                  </div>
                </div>

                {myTeam.description && (
                  <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '16px' }}>
                    {myTeam.description}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Enrolled Members ({myTeam.members?.length || 0}):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {(myTeam.members || []).map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: m.isLeader ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          border: m.isLeader ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#f1f5f9',
                          fontSize: '0.8rem'
                        }}
                        title={`${m.name} (${m.rollNumber || m.email})`}
                      >
                        <span style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#38bdf8',
                          color: '#000',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.68rem',
                          fontWeight: 800
                        }}>
                          {getInitials(m.name)}
                        </span>
                        <span>{m.name}</span>
                        {m.isLeader && <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>(Lead)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. TEAMS IN THIS COURSE SECTION */}
          <div id="course-teams-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8'
                }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Teams in this course
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                    Explore existing teams or create a new one. Click on a team to view members and details.
                  </p>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Search teams..."
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Filter buttons */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  {['all', 'available', 'full'].map((statusKey) => (
                    <button
                      key={statusKey}
                      onClick={() => setTeamStatusFilter(statusKey)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: teamStatusFilter === statusKey ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: teamStatusFilter === statusKey ? '#38bdf8' : '#94a3b8',
                        fontWeight: teamStatusFilter === statusKey ? 700 : 500,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {statusKey === 'all' ? 'All Teams' : statusKey}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Teams 2-Column Grid */}
            {teamsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 12px auto', color: '#38bdf8' }} />
                <p>Loading course teams...</p>
              </div>
            ) : filteredCourseTeams.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                gap: '18px'
              }}>
                {filteredCourseTeams.map((t, idx) => {
                  const isJoined = t.status === 'Joined' || t.isUserMember;
                  const isFull = t.status === 'Full' || t.memberCount >= (t.maxMembers || 5);
                  const visual = getTeamVisual(t.name, idx);

                  return (
                    <div
                      key={t.id || t._id}
                      style={{
                        borderRadius: '16px',
                        padding: '20px 22px',
                        background: 'rgba(18, 24, 38, 0.85)',
                        border: isJoined
                          ? '1.5px solid rgba(16, 185, 129, 0.45)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px'
                      }}
                    >
                      <div>
                        {/* Header Row: Icon + Title/Lead/Count + Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '12px',
                              background: visual.bg,
                              border: `1px solid ${visual.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              flexShrink: 0
                            }}>
                              <Users size={22} />
                            </div>
                            <div>
                              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                                {t.name}
                              </h4>
                              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                                Lead: <strong style={{ color: '#cbd5e1' }}>{t.teamLead}</strong>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                {t.memberCount}/{t.maxMembers || 5} Members
                              </div>
                            </div>
                          </div>

                          {/* Status Pill Badge */}
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            backgroundColor: isJoined
                              ? 'rgba(16, 185, 129, 0.2)'
                              : isFull
                                ? 'rgba(244, 63, 94, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                            color: isJoined
                              ? '#10b981'
                              : isFull
                                ? '#f43f5e'
                                : '#10b981',
                            border: isJoined
                              ? '1px solid rgba(16, 185, 129, 0.4)'
                              : isFull
                                ? '1px solid rgba(244, 63, 94, 0.3)'
                                : '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            {isJoined ? 'Joined' : isFull ? 'Full' : 'Available'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Member Initials Chips + Action Button */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                      }}>
                        {/* Member Initials Chips */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginRight: '4px' }}>
                            Members:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {(t.members || []).slice(0, 4).map((m, mIdx) => (
                              <div
                                key={mIdx}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #1e293b, #334155)',
                                  border: '1.5px solid #0f172a',
                                  color: '#e2e8f0',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                                }}
                                title={`${m.name} (${m.rollNumber || m.email})`}
                              >
                                {getInitials(m.name)}
                              </div>
                            ))}
                            {(t.members || []).length > 4 ? (
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  border: '1.5px solid rgba(56, 189, 248, 0.3)',
                                  color: '#38bdf8',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                +{t.members.length - 4}
                              </div>
                            ) : (
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                                  color: '#64748b',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                +0
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Button */}
                        <div>
                          {isJoined ? (
                            <button
                              onClick={() => setViewingTeam(t)}
                              style={{
                                padding: '7px 15px',
                                borderRadius: '8px',
                                backgroundColor: '#0284c7',
                                color: '#fff',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              View Team
                            </button>
                          ) : isFull ? (
                            <button
                              onClick={() => setViewingTeam(t)}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#cbd5e1',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              View Members
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                onClick={() => setViewingTeam(t)}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: '#0284c7',
                                  color: '#fff',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                View Team
                              </button>
                              {!myTeam && (
                                <button
                                  onClick={() => handleJoinTeam(t.id || t._id)}
                                  disabled={joiningTeamId === (t.id || t._id)}
                                  style={{
                                    padding: '7px 14px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                    color: '#10b981',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {joiningTeamId === (t.id || t._id) ? (
                                    <RefreshCw size={13} className="spinning" />
                                  ) : (
                                    <Plus size={13} />
                                  )}
                                  <span>Join</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                borderRadius: '16px',
                background: 'rgba(18, 24, 38, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <Users size={36} style={{ color: '#64748b', margin: '0 auto 12px auto' }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                  No Teams Found
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px auto 0 auto', maxWidth: '380px' }}>
                  {teamSearchQuery
                    ? `No teams matched "${teamSearchQuery}". Try adjusting your search.`
                    : teamStatusFilter !== 'all'
                      ? `No ${teamStatusFilter} teams in this course.`
                      : 'No teams created for this course yet. Be the first to create one!'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RESOURCES TAB */}
      {activeTab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {(course.resources || []).length > 0 ? (
            course.resources.map((res, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 24px',
                  borderRadius: '14px',
                  background: 'rgba(18, 24, 38, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: `${themeColor}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileText size={20} style={{ color: themeColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
                      {res.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '2px' }}>
                      {res.type} • {res.size}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadAttachment(res.name)}
                  disabled={downloadingFile === res.name}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {downloadingFile === res.name ? (
                    <RefreshCw size={14} className="spinning" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>Download</span>
                </button>
              </div>
            ))
          ) : (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
              No downloadable resources attached yet.
            </div>
          )}
        </div>
      )}

      {/* 5. FACULTY ANNOUNCEMENT PUBLISH MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '600px',
            borderRadius: '20px',
            padding: '28px',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Publish Course Announcement
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Broadcasting to all students enrolled in <strong>{course.code} - {course.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Announcement Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project Team Formation Guidelines"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Announcement Message Body *
                </label>
                <textarea
                  rows={6}
                  placeholder="Write instructions, project milestones, team guidelines..."
                  value={createForm.content}
                  onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    lineHeight: 1.6,
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Attachment Filenames (One per line)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project_Guidelines.pdf, Project_Proposal_Format.docx"
                  value={createForm.attachmentsText}
                  onChange={(e) => setCreateForm({ ...createForm, attachmentsText: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={createForm.isPinned}
                    onChange={(e) => setCreateForm({ ...createForm, isPinned: e.target.checked })}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  <span>Pin to top of course feed</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={createForm.isImportant}
                    onChange={(e) => setCreateForm({ ...createForm, isImportant: e.target.checked })}
                    style={{ accentColor: '#ef4444' }}
                  />
                  <span>Mark as Urgent / Important</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  disabled={submittingAnnouncement}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingAnnouncement}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {submittingAnnouncement ? (
                    <>
                      <RefreshCw size={16} className="spinning" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Publish Announcement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. CREATE A TEAM DRAWER (Matches Reference Screenshot) */}
      {showCreateTeamDrawer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            width: '500px',
            maxWidth: '100vw',
            height: '100vh',
            background: '#0b1220',
            borderLeft: '1px solid rgba(56, 189, 248, 0.25)',
            boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              background: '#0e172a'
            }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Create a Team
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                  Create a new team for {course.code} - {course.name}
                </p>
              </div>
              <button
                onClick={() => setShowCreateTeamDrawer(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Form Body (Scrollable) */}
            <form
              onSubmit={handleCreateTeamSubmit}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >
              {/* Error Alert */}
              {createTeamError && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>{createTeamError}</div>
                </div>
              )}

              {/* Success Alert */}
              {createTeamSuccess && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <div>{createTeamSuccess}</div>
                </div>
              )}

              {/* Team Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' }}>
                  Team Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter a unique team name (e.g., Team Alpha)"
                  value={createTeamForm.name}
                  onChange={(e) => setCreateTeamForm({ ...createTeamForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: '#090e1a',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Project Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' }}>
                  Project Description
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Write a short description about your project (e.g., project topic, goals, etc.)"
                  value={createTeamForm.description}
                  onChange={(e) => setCreateTeamForm({ ...createTeamForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: '#090e1a',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    lineHeight: 1.5,
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                  {createTeamForm.description.length}/500
                </div>
              </div>

              {/* Add Team Members Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Users size={16} style={{ color: '#38bdf8' }} />
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>
                    Add Team Members <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.45, marginBottom: '14px' }}>
                  Enter roll number and institutional email of each member. Both must be valid, unique and must belong to the same student.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {createTeamForm.members.map((member, index) => (
                    <div key={index}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                        Member {index + 1} {index === 0 ? '(Team Lead - You)' : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Roll number box */}
                        <div style={{
                          position: 'relative',
                          flex: '1 1 40%',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <User size={15} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
                          <input
                            type="text"
                            placeholder="Roll number"
                            value={member.rollNumber}
                            onChange={(e) => handleMemberChange(index, 'rollNumber', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px 10px 34px',
                              borderRadius: '8px',
                              background: '#090e1a',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              color: '#fff',
                              fontSize: '0.85rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            required
                          />
                        </div>

                        {/* Email box */}
                        <div style={{
                          position: 'relative',
                          flex: '1 1 50%',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <Mail size={15} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
                          <input
                            type="email"
                            placeholder="student@iitv.ac.in"
                            value={member.email}
                            onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px 10px 34px',
                              borderRadius: '8px',
                              background: '#090e1a',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              color: '#fff',
                              fontSize: '0.85rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            required
                          />
                        </div>

                        {/* Trash delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberRow(index)}
                          disabled={createTeamForm.members.length <= minTeamMembers || index === 0}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: (createTeamForm.members.length <= minTeamMembers || index === 0) ? '#334155' : '#ef4444',
                            cursor: (createTeamForm.members.length <= minTeamMembers || index === 0) ? 'not-allowed' : 'pointer',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px'
                          }}
                          title={index === 0 ? "Cannot remove team lead" : createTeamForm.members.length <= minTeamMembers ? `Minimum ${minTeamMembers} members required` : "Remove member"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Member Button */}
                {createTeamForm.members.length < maxTeamMembers && (
                  <button
                    type="button"
                    onClick={handleAddMemberRow}
                    style={{
                      marginTop: '14px',
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px dashed rgba(56, 189, 248, 0.45)',
                      background: 'rgba(56, 189, 248, 0.05)',
                      color: '#38bdf8',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)'}
                  >
                    <Plus size={16} />
                    <span>Add Member</span>
                  </button>
                )}
              </div>

              {/* Blue Info Box */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'rgba(2, 132, 199, 0.1)',
                border: '1px solid rgba(2, 132, 199, 0.28)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#0284c7',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <Info size={15} />
                </div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    <li>Each student can be part of only one team in this course.</li>
                    <li>Roll number and email must belong to the same student.</li>
                    <li>All members must be from the same batch ({course.batch || '2026-2028'}).</li>
                    <li>Team size must be between {minTeamMembers} and {maxTeamMembers} members.</li>
                    {minFemaleMembers > 0 && <li>At least {minFemaleMembers} women member(s) are required per team.</li>}
                  </ul>
                </div>
              </div>

              {/* Footer Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: 'auto',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCreateTeamDrawer(false)}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                  disabled={createTeamLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTeamLoading}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: createTeamLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                  }}
                >
                  {createTeamLoading ? (
                    <>
                      <RefreshCw size={15} className="spinning" />
                      <span>Creating Team...</span>
                    </>
                  ) : (
                    <span>Create Team</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. VIEW TEAM / VIEW MEMBERS MODAL */}
      {viewingTeam && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '580px',
            maxWidth: '100%',
            borderRadius: '16px',
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    {viewingTeam.name}
                  </h3>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    backgroundColor: viewingTeam.status === 'Joined'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : viewingTeam.status === 'Full'
                        ? 'rgba(244, 63, 94, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    color: viewingTeam.status === 'Joined'
                      ? '#10b981'
                      : viewingTeam.status === 'Full'
                        ? '#f43f5e'
                        : '#10b981',
                    border: viewingTeam.status === 'Full' ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    {viewingTeam.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '4px' }}>
                  Course: <strong style={{ color: '#38bdf8' }}>{viewingTeam.courseCode || course.code}</strong> • Lead: <strong style={{ color: '#f1f5f9' }}>{viewingTeam.teamLead}</strong>
                </div>
              </div>
              <button
                onClick={() => setViewingTeam(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {viewingTeam.description && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                fontSize: '0.86rem',
                lineHeight: 1.6
              }}>
                {viewingTeam.description}
              </div>
            )}

            {/* Member Roster List */}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                Team Members ({viewingTeam.members?.length || 0} / {viewingTeam.maxMembers || 5})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(viewingTeam.members || []).map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: m.isLeader ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: m.isLeader ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: m.isLeader ? '#f59e0b' : '#0284c7',
                        color: '#000',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {getInitials(m.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>
                          {m.name} {m.isLeader && <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700 }}>(Lead)</span>}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                          {m.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
                      {m.rollNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                onClick={() => setViewingTeam(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              {!myTeam && viewingTeam.status === 'Available' && (
                <button
                  onClick={() => handleJoinTeam(viewingTeam.id || viewingTeam._id)}
                  disabled={joiningTeamId === (viewingTeam.id || viewingTeam._id)}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#0284c7',
                    color: '#fff',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {joiningTeamId === (viewingTeam.id || viewingTeam._id) ? (
                    <>
                      <RefreshCw size={15} className="spinning" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Join Team</span>
                    </>
                  )}
                </button>
              )}

              {myTeam && (myTeam.id === viewingTeam.id || myTeam._id === viewingTeam._id || myTeam.name === viewingTeam.name) && (
                <button
                  onClick={() => handleLeaveTeam(viewingTeam.id || viewingTeam._id)}
                  disabled={leavingTeamId === (viewingTeam.id || viewingTeam._id)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <LogOut size={15} />
                  <span>Leave Team</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
