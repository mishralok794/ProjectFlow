import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { NotificationDrawer } from './components/NotificationDrawer';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { CoursePage } from './pages/student/CoursePage';
import { MyProject } from './pages/student/MyProject';
import { TeamPage } from './pages/student/TeamPage';
import { RequirementsPage } from './pages/student/RequirementsPage';
import { TasksPage } from './pages/student/TasksPage';
import { GitHubPage } from './pages/student/GitHubPage';
import { MilestonesPage } from './pages/student/MilestonesPage';
import { DocumentsPage } from './pages/student/DocumentsPage';
import { AccountProfile } from './pages/AccountProfile';

// Faculty Pages
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { ProjectDetails } from './pages/faculty/ProjectDetails';
import { GitHubEvidencePage } from './pages/faculty/GitHubEvidencePage';
import { EvaluationPage } from './pages/faculty/EvaluationPage';
import { FacultyWorkspace } from './pages/faculty/FacultyWorkspace';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UsersManagement } from './pages/admin/UsersManagement';
import { AssignmentsPage } from './pages/admin/AssignmentsPage';
import { CriteriaPage } from './pages/admin/CriteriaPage';
import { CoordinatorPortal, InstitutionDirectoryPage, PublicInstitutionPage } from './pages/coordinator/CoordinatorPortal';

export function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('courses');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Unauthenticated view: 'homepage' | 'auth'
  const [publicView, setPublicView] = useState('homepage');
  // Which auth tab to open: 'login' | 'register'
  const [authInitialTab, setAuthInitialTab] = useState('login');

  useEffect(() => {
    const handleNavigate = (event) => setActiveTab(event.detail);
    window.addEventListener('projectflow:navigate', handleNavigate);
    return () => window.removeEventListener('projectflow:navigate', handleNavigate);
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090d16',
        color: '#38bdf8',
        fontWeight: 600
      }}>
        Initializing ProjectFlow Environment...
      </div>
    );
  }

  const institutionMatch = window.location.pathname.match(/^\/institutions\/([^/]+)\/?$/);
  if (institutionMatch) return <PublicInstitutionPage institutionId={decodeURIComponent(institutionMatch[1])} />;
  if (window.location.pathname === '/institutions' || window.location.pathname === '/institutions/') return <InstitutionDirectoryPage />;

  // --- Unauthenticated: Show Homepage or Auth Page ---
  if (!user) {
    if (publicView === 'auth') {
      return (
        <AuthPage
          initialTab={authInitialTab}
          onBackToHome={() => setPublicView('homepage')}
        />
      );
    }
    return (
      <HomePage
        onNavigateToAuth={(tab) => {
          setAuthInitialTab(tab || 'login');
          setPublicView('auth');
        }}
      />
    );
  }

  // --- Authenticated: Dashboard Shell ---
  const role = (user.role || '').toLowerCase();

  // Reset tab default if role changes
  const effectiveTab = () => {
    // Faculty should land on the assigned-subject workspace, where their class,
    // team, GitHub, messaging, and timed-lab cards live.
    if (role === 'faculty' && (activeTab === 'dashboard' || activeTab === 'courses')) return 'faculty-teaching';
    if (role === 'admin' && (activeTab === 'dashboard' || activeTab === 'courses')) return 'admin-dashboard';
    if (role === 'coordinator' && (activeTab === 'dashboard' || activeTab === 'courses')) return 'coordinator-overview';
    if (role === 'student' && (activeTab.startsWith('faculty-') || activeTab.startsWith('admin-'))) return 'courses';
    if (role === 'student' && activeTab === 'dashboard') return 'courses';
    return activeTab;
  };

  const currentTab = effectiveTab();

  const handleFacultySelectProject = (projId, viewType) => {
    setSelectedProjectId(projId);
    if (viewType === 'details') setActiveTab('faculty-projects');
    if (viewType === 'evaluation') setActiveTab('faculty-evaluations');
  };

  return (
    <div className="app-layout">
      {/* Role-Specific Sidebar Shell */}
      <Sidebar
        activeTab={currentTab}
        setActiveTab={setActiveTab}
        onOpenNotifications={() => setIsNotifOpen(true)}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <TopNavbar
          activeTab={currentTab}
          onOpenNotifications={() => setIsNotifOpen(true)}
        />

        <main className="app-content">
          {/* STUDENT SHELL VIEWS - Course Based Architecture (Google Classroom Model) */}
          {role === 'student' && (
            <>
              {(currentTab === 'courses' || currentTab === 'dashboard') && (
                <StudentDashboard
                  onSelectCourse={(course) => {
                    const identifier = course.code || course.id;
                    setSelectedCourseId(identifier);
                    setActiveTab('course-details');
                  }}
                />
              )}

              {currentTab === 'course-details' && (
                <CoursePage
                  courseId={selectedCourseId}
                  onBack={() => {
                    setSelectedCourseId(null);
                    setActiveTab('courses');
                  }}
                />
              )}

              {currentTab === 'profile' && <AccountProfile />}
            </>
          )}

          {/* FACULTY SHELL VIEWS */}
          {role === 'faculty' && (
            <>
              {currentTab === 'faculty-dashboard' && (
                <FacultyDashboard onSelectProject={handleFacultySelectProject} />
              )}
              {currentTab === 'faculty-teaching' && <FacultyWorkspace />}
              {currentTab === 'faculty-projects' && (
                <ProjectDetails
                  projectId={selectedProjectId}
                  onBack={() => setActiveTab('faculty-dashboard')}
                  onNavigateToEvaluation={() => setActiveTab('faculty-evaluations')}
                />
              )}
              {currentTab === 'faculty-criteria' && (
                <CriteriaPage onNavigateToEvaluation={() => setActiveTab('faculty-evaluations')} />
              )}
              {currentTab === 'faculty-evidence' && (
                <GitHubEvidencePage selectedProjectId={selectedProjectId} />
              )}
              {currentTab === 'faculty-evaluations' && (
                <EvaluationPage selectedProjectId={selectedProjectId} onNavigateToCriteria={() => setActiveTab('faculty-criteria')} />
              )}
              {currentTab === 'faculty-feedback' && (
                <EvaluationPage selectedProjectId={selectedProjectId} onNavigateToCriteria={() => setActiveTab('faculty-criteria')} />
              )}
            </>
          )}

          {/* ADMIN SHELL VIEWS */}
          {role === 'admin' && (
            <>
              {currentTab === 'admin-dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
              {currentTab === 'admin-users' && <UsersManagement />}
              {currentTab === 'admin-faculty' && <UsersManagement />}
              {currentTab === 'admin-projects' && <AssignmentsPage />}
              {currentTab === 'admin-assignments' && <AssignmentsPage />}
            </>
          )}

          {role === 'coordinator' && (currentTab === 'coordinator-teaching' ? <FacultyWorkspace /> : <CoordinatorPortal activeTab={currentTab} user={user} />)}
        </main>
      </div>

      {/* Global Event Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
    </div>
  );
}
export default App;
