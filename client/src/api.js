import { mockService } from './mockData';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || '/api';

export function getToken() {
  return localStorage.getItem('projectflow_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('projectflow_token', token);
  } else {
    localStorage.removeItem('projectflow_token');
  }
}

export function getUser() {
  const data = localStorage.getItem('projectflow_user');
  return data ? JSON.parse(data) : null;
}

export function setUser(user) {
  if (user) {
    localStorage.setItem('projectflow_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('projectflow_user');
  }
}

async function request(endpoint, options = {}, fallbackFn = null) {
  try {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const contentType = response.headers.get('content-type') || '';

    // If Netlify redirected the API request to index.html (SPA catch-all), or received non-JSON
    if (contentType.includes('text/html')) {
      if (fallbackFn) return await fallbackFn();
      throw new Error(`Endpoint returned HTML (backend not available at ${BASE_URL})`);
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.error || `HTTP error ${response.status}`);
      err.status = response.status;
      err.isServerError = true;
      throw err;
    }

    return await response.json();
  } catch (err) {
    // If the server explicitly rejected with 401, 403, 400, 409 etc, throw immediately
    if (err.isServerError || (err.status >= 400 && err.status < 500)) {
      throw err;
    }

    // Only fallback if the network request completely failed (e.g. backend offline or Netlify static build)
    if (fallbackFn) {
      console.info(`[ProjectFlow Offline Fallback] Used for ${endpoint}:`, err.message);
      return await fallbackFn();
    }
    throw err;
  }
}

export const api = {
  // Auth
  login: (credentials) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }, () => mockService.login(credentials)),

  register: (userData) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }, () => mockService.register(userData)),

  getMe: () =>
    request('/auth/me', {}, () => mockService.getMe(getToken())),

  getUsers: () =>
    request('/auth/users', {}, () => mockService.getUsers()),

  getFaculty: () =>
    request('/auth/faculty', {}, () => mockService.getFaculty()),

  createUser: (userData) =>
    request('/auth/users', { method: 'POST', body: JSON.stringify(userData) }, userData.role === 'Coordinator' ? null : () => mockService.createUser(userData)),

  updateUser: (id, data) =>
    request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }, () => mockService.updateUser(id, data)),

  getInstitutions: (search = '') => request(`/institutions${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getInstitution: (id) => request(`/institutions/${id}`),
  createInstitution: (data) => request('/institutions', { method: 'POST', body: JSON.stringify(data) }),
  updateCoordinatorInstitution: (id, data) => request(`/coordinator/institutions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getInstitutionMembership: (id) => request(`/institutions/${id}/membership`),
  requestInstitutionMembership: (id, branchId) => request(`/institutions/${id}/membership`, { method: 'POST', body: JSON.stringify({ branchId }) }),
  getCoordinatorOverview: () => request('/coordinator/overview'),
  getCoordinatorCourses: () => request('/coordinator/courses'),
  createCoordinatorCourse: (data) => request('/coordinator/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCoordinatorCourse: (id, data) => request(`/coordinator/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCoordinatorAssignments: () => request('/coordinator/assignments'),
  createCoordinatorAssignment: (data) => request('/coordinator/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateCoordinatorAssignment: (id, data) => request(`/coordinator/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCoordinatorBranches: () => request('/coordinator/branches'),
  getCoordinatorMemberships: () => request('/coordinator/memberships'),
  reviewCoordinatorMembership: (id, status) => request(`/coordinator/memberships/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  createCoordinatorBranch: (data) => request('/coordinator/branches', { method: 'POST', body: JSON.stringify(data) }),
  getCoordinatorSessions: () => request('/coordinator/sessions'),
  createCoordinatorSession: (data) => request('/coordinator/sessions', { method: 'POST', body: JSON.stringify(data) }),
  getCoordinatorBatches: () => request('/coordinator/batches'),
  createCoordinatorBatch: (data) => request('/coordinator/batches', { method: 'POST', body: JSON.stringify(data) }),

  // Academic Courses (Google Classroom Model)
  getCourses: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/courses${qs ? '?' + qs : ''}`, {}, () => mockService.getCourses(params));
  },

  getCourse: (idOrCode) =>
    request(`/courses/${idOrCode}`, {}, () => mockService.getCourse(idOrCode)),

  getCourseBroadcasts: () =>
    request('/courses/broadcasts', {}, () => mockService.getCourseBroadcasts()),

  getCourseAnnouncements: (courseId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/courses/${courseId}/announcements${qs ? '?' + qs : ''}`, {}, () => mockService.getCourseAnnouncements(courseId, params));
  },

  getCourseAnnouncement: (courseId, announcementId) =>
    request(`/courses/${courseId}/announcements/${announcementId}`, {}, () => mockService.getCourseAnnouncement(courseId, announcementId)),

  createCourseAnnouncement: (courseId, data) =>
    request(`/courses/${courseId}/announcements`, { method: 'POST', body: JSON.stringify(data) }, () => mockService.createCourseAnnouncement(courseId, data)),

  updateCourseAnnouncement: (courseId, announcementId, data) =>
    request(`/courses/${courseId}/announcements/${announcementId}`, { method: 'PUT', body: JSON.stringify(data) }, () => mockService.updateCourseAnnouncement(courseId, announcementId, data)),

  deleteCourseAnnouncement: (courseId, announcementId) =>
    request(`/courses/${courseId}/announcements/${announcementId}`, { method: 'DELETE' }, () => mockService.deleteCourseAnnouncement(courseId, announcementId)),

  markAnnouncementRead: (courseId, announcementId, unread = false) =>
    request(`/courses/${courseId}/announcements/${announcementId}/read`, { method: 'PUT', body: JSON.stringify({ unread }) }, () => mockService.markAnnouncementRead(courseId, announcementId, unread)),

  getCourseTeams: (courseId) =>
    request(`/courses/${courseId}/teams`, {}, () => mockService.getCourseTeams(courseId)),

  getMyCourseTeam: (courseId) =>
    request(`/courses/${courseId}/my-team`, {}, () => mockService.getMyCourseTeam(courseId)),

  createCourseTeam: (courseId, data) =>
    request(`/courses/${courseId}/teams`, { method: 'POST', body: JSON.stringify(data) }, () =>
      mockService.createCourseTeam(courseId, data)
    ),

  joinCourseTeam: (courseId, teamId) =>
    request(`/courses/${courseId}/teams/${teamId}/join`, { method: 'POST' }, () =>
      mockService.joinCourseTeam(courseId, teamId)
    ),

  leaveCourseTeam: (courseId, teamId) =>
    request(`/courses/${courseId}/teams/${teamId}/leave`, { method: 'POST' }, () =>
      mockService.leaveCourseTeam(courseId, teamId)
    ),

  downloadCourseAttachment: async (courseId, filename) => {
    const token = getToken();
    const url = `${BASE_URL}/courses/${courseId}/attachments/${encodeURIComponent(filename)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to download file (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    return true;
  },

  // Projects
  getProjects: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/projects${qs ? '?' + qs : ''}`, {}, () => mockService.getProjects());
  },

  getProject: (id) =>
    request(`/projects/${id}`, {}, () => mockService.getProject(id)),

  createProject: (data) =>
    request('/projects', { method: 'POST', body: JSON.stringify(data) }, () => mockService.createProject(data)),

  updateProject: (id, data) =>
    request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }, () => mockService.updateProject(id, data)),

  deleteProject: (id) =>
    request(`/projects/${id}`, { method: 'DELETE' }, () => mockService.deleteProject(id)),

  getProjectOverview: (id) =>
    request(`/projects/${id}/overview`, {}, () => mockService.getProjectOverview(id)),

  // Team
  getTeam: (projectId) =>
    request(`/projects/${projectId}/team`, {}, () => mockService.getTeam(projectId)),

  addTeamMember: (projectId, memberData) =>
    request(`/projects/${projectId}/team/members`, { method: 'POST', body: JSON.stringify(memberData) }, () =>
      mockService.addTeamMember(projectId, memberData)
    ),

  removeTeamMember: (projectId, memberId) =>
    request(`/projects/${projectId}/team/members/${memberId}`, { method: 'DELETE' }, () =>
      mockService.removeTeamMember(projectId, memberId)
    ),

  // Requirements (manually entered by students per SRS)
  getRequirements: (projectId) =>
    request(`/projects/${projectId}/requirements`, {}, () => mockService.getRequirements(projectId)),

  createRequirement: (projectId, data) =>
    request(`/projects/${projectId}/requirements`, { method: 'POST', body: JSON.stringify(data) }, () =>
      mockService.createRequirement(projectId, data)
    ),

  updateRequirement: (projectId, reqId, data) =>
    request(`/projects/${projectId}/requirements/${reqId}`, { method: 'PUT', body: JSON.stringify(data) }, () =>
      mockService.updateRequirement(projectId, reqId, data)
    ),

  deleteRequirement: (projectId, reqId) =>
    request(`/projects/${projectId}/requirements/${reqId}`, { method: 'DELETE' }, () =>
      mockService.deleteRequirement(projectId, reqId)
    ),

  // Milestones & Criteria
  getMilestones: (projectId) =>
    request(`/projects/${projectId}/milestones`, {}, () => mockService.getMilestones(projectId)),

  recalculateMilestones: (projectId) =>
    request(`/projects/${projectId}/milestones/recalculate`, { method: 'POST' }, () =>
      mockService.recalculateMilestones(projectId)
    ),

  getCriteria: () =>
    request('/criteria', {}, () => mockService.getCriteria()),

  createCriteria: (data) =>
    request('/criteria', { method: 'POST', body: JSON.stringify(data) }, () => mockService.createCriteria(data)),

  updateCriteria: (id, data) =>
    request(`/criteria/${id}`, { method: 'PUT', body: JSON.stringify(data) }, () => mockService.updateCriteria(id, data)),

  deleteCriteria: (id) =>
    request(`/criteria/${id}`, { method: 'DELETE' }, () => mockService.deleteCriteria(id)),

  // Documents
  getDocuments: (projectId) =>
    request(`/projects/${projectId}/documents`, {}, () => mockService.getDocuments(projectId)),

  uploadDocument: (projectId, data) =>
    request(`/projects/${projectId}/documents`, { method: 'POST', body: JSON.stringify(data) }, () =>
      mockService.uploadDocument(projectId, data)
    ),

  deleteDocument: (projectId, docId) =>
    request(`/projects/${projectId}/documents/${docId}`, { method: 'DELETE' }, () =>
      mockService.deleteDocument(projectId, docId)
    ),

  // Tasks
  getTasks: (projectId, filter = {}) => {
    const qs = new URLSearchParams(filter).toString();
    return request(`/tasks/projects/${projectId}/tasks${qs ? '?' + qs : ''}`, {}, () =>
      mockService.getTasks(projectId, filter)
    );
  },

  createTask: (data) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }, () => mockService.createTask(data)),

  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }, () => mockService.updateTask(id, data)),

  deleteTask: (id) =>
    request(`/tasks/${id}`, { method: 'DELETE' }, () => mockService.deleteTask(id)),

  // GitHub Integration
  connectGitHub: (data) =>
    request('/github/connect', { method: 'POST', body: JSON.stringify(data) }, () => mockService.connectGitHub(data)),

  syncGitHub: (projectId) =>
    request(`/github/${projectId}/sync`, { method: 'POST' }, () => mockService.syncGitHub(projectId)),

  getGitHubStatus: (projectId) =>
    request(`/github/${projectId}/status`, {}, () => mockService.getGitHubStatus(projectId)),

  getGitHubActivity: (projectId) =>
    request(`/github/${projectId}/activity`, {}, () => mockService.getGitHubActivity(projectId)),

  getGitHubEvidence: (projectId) =>
    request(`/github/${projectId}/evidence`, {}, () => mockService.getGitHubEvidence(projectId)),

  // Evaluation
  getEvaluations: (projectId) =>
    request(`/evaluations/${projectId}`, {}, () => mockService.getEvaluations(projectId)),

  createEvaluation: (data) =>
    request('/evaluations', { method: 'POST', body: JSON.stringify(data) }, () => mockService.createEvaluation(data)),

  updateEvaluation: (id, data) =>
    request(`/evaluations/${id}`, { method: 'PUT', body: JSON.stringify(data) }, () => mockService.updateEvaluation(id, data)),

  getRubricTemplate: () =>
    request('/evaluations/rubric-template', {}, () => mockService.getRubricTemplate()),

  // Notifications
  getNotifications: () =>
    request('/notifications', {}, () => mockService.getNotifications()),

  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, { method: 'PUT' }, () => mockService.markNotificationRead(id)),

  markAllNotificationsRead: () =>
    request('/notifications/read-all', { method: 'PUT' }, () => mockService.markAllNotificationsRead()),

  sendCoordinatorBranchMessage: (data) =>
    request('/notifications/coordinator/branch', { method: 'POST', body: JSON.stringify(data) })
};
