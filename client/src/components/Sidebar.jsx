import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderGit2,
  Users,
  ListTodo,
  CheckSquare,
  Award,
  Github,
  FileText,
  Bell,
  Settings,
  LogOut,
  GraduationCap,
  School,
  ShieldCheck,
  Sliders,
  UserCheck,
  FileSearch,
  MessageSquare,
  BookOpen,
  User,
  Building2,
  CalendarDays,
  ClipboardList,
  UserRoundCog,
  Activity,
  Send
} from 'lucide-react';

export function Sidebar({ activeTab, setActiveTab, onOpenNotifications }) {
  const { user, logout } = useAuth();
  const role = (user?.role || '').toLowerCase();

  // Distinct nav configurations per role - Google Classroom Course Pattern for Students
  const studentNav = [
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: 3 },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  const facultyNav = [
    { id: 'faculty-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'faculty-projects', label: 'Assigned Projects', icon: FolderGit2 },
    { id: 'faculty-criteria', label: 'Milestone Criteria Rules', icon: Sliders },
    { id: 'faculty-evidence', label: 'GitHub Evidence', icon: Github },
    { id: 'faculty-evaluations', label: 'Project Evaluation', icon: Award },
    { id: 'faculty-feedback', label: 'Feedback & Notes', icon: MessageSquare }
  ];

  const adminNav = [
    { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin-users', label: 'User Directory', icon: Users },
    { id: 'admin-faculty', label: 'Faculty Roster', icon: School },
    { id: 'admin-projects', label: 'All Projects', icon: FolderGit2 },
    { id: 'admin-assignments', label: 'Faculty Assignments', icon: UserCheck }
  ];

  const coordinatorNav = [
    { id: 'coordinator-overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'coordinator-institution', label: 'Institution Profile', icon: Building2 },
    { id: 'coordinator-branches', label: 'Branches & Programs', icon: School },
    { id: 'coordinator-courses', label: 'Courses & Subjects', icon: BookOpen },
    { id: 'coordinator-sessions', label: 'Academic Sessions', icon: CalendarDays },
    { id: 'coordinator-batches', label: 'Batches', icon: ClipboardList },
    { id: 'coordinator-faculty', label: 'Faculty Directory', icon: Users },
    { id: 'coordinator-messages', label: 'Branch Messages', icon: Send },
    { id: 'coordinator-assignments', label: 'Faculty Assignments', icon: UserCheck },
    { id: 'coordinator-coordinators', label: 'Coordinators', icon: UserRoundCog },
    { id: 'coordinator-activity', label: 'Activity & Monitoring', icon: Activity },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  let items = studentNav;
  let roleTitle = 'Student Portal';
  let roleIcon = GraduationCap;
  let roleColor = '#34d399';

  if (role === 'faculty') {
    items = facultyNav;
    roleTitle = 'Faculty Supervision';
    roleIcon = School;
    roleColor = '#38bdf8';
  } else if (role === 'admin') {
    items = adminNav;
    roleTitle = 'Admin Console';
    roleIcon = ShieldCheck;
    roleColor = '#fb7185';
  } else if (role === 'coordinator') {
    items = coordinatorNav;
    roleTitle = 'Coordinator Portal';
    roleIcon = Building2;
    roleColor = '#a78bfa';
  }

  const RoleIconComponent = roleIcon;

  return (
    <aside className="app-sidebar">
      {/* Brand & Logo */}
      <div style={{
        padding: '24px 24px 20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
        }}>
          <FolderGit2 size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            Project<span style={{ color: '#38bdf8' }}>Flow</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <RoleIconComponent size={12} style={{ color: roleColor }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {roleTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation items */}
      <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '8px 12px 12px 12px'
        }}>
          Navigation
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.map((item) => {
            const Icon = item.icon;
            const isCoursesTab = item.id === 'courses' && (activeTab === 'courses' || activeTab === 'dashboard' || activeTab === 'course-details');
            const isBatchDetailsTab = item.id === 'coordinator-batches' && activeTab === 'coordinator-batch-details';
            const isActive = isCoursesTab || isBatchDetailsTab || activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'notifications') {
                    onOpenNotifications();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid transparent',
                  background: isActive ? 'linear-gradient(90deg, rgba(56, 189, 248, 0.15) 0%, rgba(56, 189, 248, 0.05) 100%)' : 'transparent',
                  borderColor: isActive ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} style={{ color: isActive ? '#38bdf8' : 'inherit' }} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    lineHeight: 1
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer controls & User Profile Avatar */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* Student Avatar Card matching Google Classroom mockup */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.82rem',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
          }}>
            {user?.name
              ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              : 'ST'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Student User'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              {user?.role || 'Student'}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: '#f87171',
            cursor: 'pointer',
            fontSize: '0.8rem',
            width: '100%',
            textAlign: 'left'
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
