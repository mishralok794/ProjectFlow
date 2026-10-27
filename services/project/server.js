const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createDatabase, generateId } = require('../../shared/db');
const { createEventBus } = require('../../shared/eventBus');
const { authenticate, authorizeRoles } = require('../../shared/authMiddleware');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PROJECT_PORT || 5002;
const INTEGRATION_SERVICE_URL = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:5005';

let db;
let projectsCollection;
let teamMembersCollection;
let requirementsCollection;
let criteriaCollection;
let projectMilestonesCollection;
let documentsCollection;
let coursesCollection;
let announcementsCollection;
let courseTeamsCollection;
let branchesCollection;
let batchesCollection;
let sessionsCollection;
let facultyAssignmentsCollection;
let usersCollection;
let eventBus;

// Default Criteria Rule Sets (Configurable by Admin)
const DEFAULT_CRITERIA = [
  {
    code: 'M1',
    name: 'Milestone 1: Project Genesis & Scaffolding',
    description: 'Initial repository setup, architectural scaffolding, initial commits, and Requirements Document (SRS).',
    minCommits: 5,
    minPRs: 1,
    minMergedPRs: 1,
    minClosedIssues: 1,
    requiredDocType: 'SRS',
    order: 1
  },
  {
    code: 'M2',
    name: 'Milestone 2: Core Development & Architecture',
    description: 'Full microservice development, team collaboration PRs, closed feature issues, and Architecture Documentation.',
    minCommits: 10,
    minPRs: 3,
    minMergedPRs: 2,
    minClosedIssues: 3,
    requiredDocType: 'Architecture Design',
    order: 2
  },
  {
    code: 'M3',
    name: 'Milestone 3: Evaluation, Testing & Final Report',
    description: 'Comprehensive test coverage, final pull requests merged, resolved issues, and Final Capstone Report.',
    minCommits: 15,
    minPRs: 4,
    minMergedPRs: 3,
    minClosedIssues: 5,
    requiredDocType: 'Final Report',
    order: 3
  }
];

async function seedCriteriaIfEmpty() {
  const count = await criteriaCollection.countDocuments({});
  if (count === 0) {
    console.log('[ProjectService] Seeding default milestone evaluation criteria...');
    for (const crit of DEFAULT_CRITERIA) {
      await criteriaCollection.insertOne(crit);
    }
  }
}

// Default Academic Courses (Google Classroom style)
const DEFAULT_COURSES = [
  {
    code: 'CS543',
    name: 'Web Services',
    facultyName: 'Dr. R. Sharma',
    facultyEmail: 'dr.sharma@projectflow.edu',
    batch: '2026-2028',
    semester: '3rd Semester',
    department: 'Computer Science & Engineering',
    color: '#0284c7',
    icon: 'globe',
    description: 'Advanced distributed web services, RESTful architectural design, microservices communication, and cloud API integration.',
    enrolledEmails: [
      'alka123@iitv.ac.in',
      'alkaj29@gmail.com',
      'aarav.sharma@student.edu',
      'alex.chen@student.edu',
      'priya.patel@student.edu',
      'marcus.vance@student.edu',
      'elena.rostova@student.edu',
      'rohan.verma@student.edu',
      'rohit.kumar@student.edu',
      'neha.verma@student.edu',
      'amit.raj@student.edu',
      'suresh.sen@student.edu',
      'kavita.roy@student.edu',
      'priya.singh@student.edu',
      'karan.dave@student.edu',
      'simran.kaur@student.edu',
      'deepak.joshi@student.edu',
      'vikram.mehta@student.edu',
      'ananya.roy@student.edu',
      'rohan.gupta@student.edu',
      'divya.nair@student.edu',
      'harsh.vardhan@student.edu',
      'rahul50@iitv.ac.in',
      'sneha51@iitv.ac.in',
      'aman52@iitv.ac.in',
      'pooja53@iitv.ac.in'
    ],
    instructorMessage: {
      author: 'Dr. R. Sharma',
      date: '20 Oct 2026',
      title: 'Message from Course Instructor',
      content: `Dear Students,\nPlease read the following before forming your team:\n• Team Size: 4-5 members\n• Each member must be from the same batch.\n• Use your Roll Number and Institute Email ID.\n• Each student can be part of only one team.\n• Topics: Choose from the list provided in 'Resources'.\n• Submit team by 25 Oct 2026.\n• Project proposal format is attached.`,
      attachments: [
        { name: 'Project_Guidelines.pdf', size: '2.4 MB', type: 'pdf' }
      ]
    },
    announcements: [
      {
        id: 'ann_cs543_1',
        title: 'General Guidelines for Project Teams',
        courseCode: 'CS543',
        courseName: 'Web Services',
        facultyName: 'Dr. R. Sharma',
        date: '22 Oct 2026',
        content: 'Please ensure team members are finalized and topics are selected before the deadline. Project proposal templates must be submitted via the portal.'
      }
    ],
    resources: [
      { name: 'Course Syllabus & Lab Manual', type: 'pdf', size: '1.4 MB' },
      { name: 'Approved Capstone Project Topics 2026', type: 'pdf', size: '820 KB' }
    ]
  },
  {
    code: 'CS541',
    name: 'Design and Analysis of Algorithms',
    facultyName: 'Dr. P. Singh',
    facultyEmail: 'dr.singh@projectflow.edu',
    batch: '2026-2028',
    semester: '3rd Semester',
    department: 'Computer Science & Engineering',
    color: '#8b5cf6',
    icon: 'cpu',
    description: 'Algorithm design paradigms, graph theory algorithms, dynamic programming, NP-completeness, and performance analysis.',
    enrolledEmails: [
      'alex.chen@student.edu',
      'alkaj29@gmail.com',
      'alka123@iitv.ac.in',
      'priya.patel@student.edu',
      'elena.rostova@student.edu'
    ],
    instructorMessage: {
      author: 'Dr. P. Singh',
      date: '19 Oct 2026',
      title: 'Algorithm Lab Project Guidelines',
      content: `Dear Students,\nFor the Algorithm Analysis capstone project:\n• Choose from dynamic programming, network flow, or approximation algorithms.\n• Implement in C++ or Python with empirical benchmark plots.\n• Group submissions must adhere to reproducible evaluation metrics.`,
      attachments: [
        { name: 'Algorithm_Project_Syllabus.pdf', size: '1.8 MB', type: 'pdf' }
      ]
    },
    announcements: [
      {
        id: 'ann_cs541_1',
        title: 'Team Formation Deadline Extended',
        courseCode: 'CS541',
        courseName: 'Design and Analysis of Algorithms',
        facultyName: 'Dr. P. Singh',
        date: '20 Oct 2026',
        content: 'Team formation deadline for Algorithms capstone projects has been extended to 28 Oct 2026.'
      }
    ],
    resources: [
      { name: 'Algorithm Benchmark Datasets', type: 'zip', size: '14.2 MB' },
      { name: 'Complexity Analysis Cheat Sheet', type: 'pdf', size: '650 KB' }
    ]
  },
  {
    code: 'CS542',
    name: 'Database Systems',
    facultyName: 'Dr. M. Verma',
    facultyEmail: 'dr.verma@projectflow.edu',
    batch: '2026-2028',
    semester: '3rd Semester',
    department: 'Computer Science & Engineering',
    color: '#f97316',
    icon: 'database',
    description: 'Database engine internals, query execution plans, transactions and isolation, indexing strategies, and distributed NoSQL storage.',
    enrolledEmails: [
      'alex.chen@student.edu',
      'alkaj29@gmail.com',
      'alka123@iitv.ac.in',
      'priya.patel@student.edu',
      'marcus.vance@student.edu'
    ],
    instructorMessage: {
      author: 'Dr. M. Verma',
      date: '18 Oct 2026',
      title: 'Database System Design Project Specifications',
      content: `Welcome to CS542.\nYour semester project involves designing a fully normalized schema with replication, fault tolerance, and query indexing benchmarks.\nReview the proposal format in the resources tab.`,
      attachments: [
        { name: 'DB_Project_Proposal_Format.docx', size: '950 KB', type: 'doc' }
      ]
    },
    announcements: [
      {
        id: 'ann_cs542_1',
        title: 'Submit Project Proposal Format',
        courseCode: 'CS542',
        courseName: 'Database Systems',
        facultyName: 'Dr. M. Verma',
        date: '18 Oct 2026',
        content: 'Use the approved institute proposal format attached in course resources before submitting your proposal.'
      }
    ],
    resources: [
      { name: 'Relational Database Schema Design Rubric', type: 'pdf', size: '1.1 MB' }
    ]
  },
  {
    code: 'CS544',
    name: 'Software Engineering',
    facultyName: 'Dr. S. Nair',
    facultyEmail: 'dr.nair@projectflow.edu',
    batch: '2026-2028',
    semester: '3rd Semester',
    department: 'Computer Science & Engineering',
    color: '#10b981',
    icon: 'layers',
    description: 'Software development lifecycle, Agile methodologies, CI/CD automated testing, clean code architecture, and capstone milestones.',
    enrolledEmails: [
      'alex.chen@student.edu',
      'alkaj29@gmail.com',
      'alka123@iitv.ac.in',
      'priya.patel@student.edu',
      'elena.rostova@student.edu'
    ],
    instructorMessage: {
      author: 'Dr. S. Nair',
      date: '17 Oct 2026',
      title: 'Software Engineering Project Milestones',
      content: `Welcome to CS544 Software Engineering.\nAll groups are required to use GitHub issues and pull requests to track development.\nMilestone audits will occur bi-weekly with automated criteria evaluation.`,
      attachments: [
        { name: 'SE_Milestone_Rubric.pdf', size: '1.2 MB', type: 'pdf' }
      ]
    },
    announcements: [
      {
        id: 'ann_cs544_1',
        title: 'Sprint Planning Session Schedule',
        courseCode: 'CS544',
        courseName: 'Software Engineering',
        facultyName: 'Dr. S. Nair',
        date: '16 Oct 2026',
        content: 'Sprint 1 planning sessions will be scheduled during the lab hours next week. Review Agile guidelines.'
      }
    ],
    resources: [
      { name: 'Agile Sprint Template', type: 'pdf', size: '780 KB' }
    ]
  }
];

async function seedCoursesIfEmpty() {
  const count = await coursesCollection.countDocuments({});
  if (count === 0) {
    console.log('[ProjectService] Seeding default academic courses...');
    for (const course of DEFAULT_COURSES) {
      await coursesCollection.insertOne(course);
    }
  }
}

// Default Broadcast Announcements (Google Classroom style)
const DEFAULT_ANNOUNCEMENTS = [
  {
    _id: 'ann_cs543_team_guidelines',
    courseId: 'course_cs543',
    courseCode: 'CS543',
    courseName: 'Web Services',
    title: 'Project Team Formation Guidelines',
    content: `Dear Students,\n\nPlease read and strictly follow the team formation guidelines before submitting your project groups:\n\n• Each team must contain 4–5 students.\n• All members must belong to the same academic batch (2026-2028).\n• Every member must have a unique roll number and institutional email.\n• Each student can belong to only one team in the course.\n• Students must select a topic from the faculty-approved list in Resources.\n• Project proposals must be submitted before the faculty-defined deadline (25 Oct 2026).\n\nProject proposal format and evaluation criteria are attached below. Contact the course instructor during office hours for topic approvals.`,
    facultyId: 'user_fac_sharma',
    facultyName: 'Dr. R. Sharma',
    facultyEmail: 'dr.sharma@projectflow.edu',
    isPinned: true,
    isImportant: true,
    publishedAt: '2026-10-20T10:00:00.000Z',
    date: '20 Oct 2026, 10:00 AM',
    attachments: [
      {
        id: 'att_guidelines_pdf',
        name: 'Project_Guidelines.pdf',
        size: '2.4 MB',
        type: 'pdf',
        downloadUrl: '/api/courses/CS543/attachments/Project_Guidelines.pdf'
      },
      {
        id: 'att_proposal_doc',
        name: 'Project_Proposal_Format.docx',
        size: '850 KB',
        type: 'doc',
        downloadUrl: '/api/courses/CS543/attachments/Project_Proposal_Format.docx'
      }
    ],
    readBy: [
      'alex.chen@student.edu'
    ]
  },
  {
    _id: 'ann_cs543_api_specs',
    courseId: 'course_cs543',
    courseCode: 'CS543',
    courseName: 'Web Services',
    title: 'Updated REST & GraphQL API Specification Standards',
    content: 'All teams developing web service microservices must use OpenAPI 3.0 / YAML specifications for API contracts. Docker-compose configuration for service discovery must be committed to your team repository by Milestone 1.',
    facultyId: 'user_fac_sharma',
    facultyName: 'Dr. R. Sharma',
    facultyEmail: 'dr.sharma@projectflow.edu',
    isPinned: false,
    isImportant: false,
    publishedAt: '2026-10-22T14:30:00.000Z',
    date: '22 Oct 2026, 02:30 PM',
    attachments: [
      {
        id: 'att_api_std_pdf',
        name: 'API_Specification_Standards_v2.pdf',
        size: '1.1 MB',
        type: 'pdf',
        downloadUrl: '/api/courses/CS543/attachments/API_Specification_Standards_v2.pdf'
      }
    ],
    readBy: []
  },
  {
    _id: 'ann_cs541_deadline',
    courseId: 'course_cs541',
    courseCode: 'CS541',
    courseName: 'Design and Analysis of Algorithms',
    title: 'Team Formation Deadline Extended',
    content: 'The deadline for algorithm capstone project groups has been extended to 28 Oct 2026. Review benchmark dataset resources in the course page.',
    facultyId: 'user_fac_singh',
    facultyName: 'Dr. P. Singh',
    facultyEmail: 'dr.singh@projectflow.edu',
    isPinned: true,
    isImportant: false,
    publishedAt: '2026-10-20T11:00:00.000Z',
    date: '20 Oct 2026, 11:00 AM',
    attachments: [],
    readBy: []
  },
  {
    _id: 'ann_cs542_proposal',
    courseId: 'course_cs542',
    courseCode: 'CS542',
    courseName: 'Database Systems',
    title: 'Submit Project Proposal Format',
    content: 'Submit your database schema proposals using the approved institute format before the upcoming laboratory session.',
    facultyId: 'user_fac_verma',
    facultyName: 'Dr. M. Verma',
    facultyEmail: 'dr.verma@projectflow.edu',
    isPinned: false,
    isImportant: true,
    publishedAt: '2026-10-18T09:00:00.000Z',
    date: '18 Oct 2026, 09:00 AM',
    attachments: [],
    readBy: []
  },
  {
    _id: 'ann_cs544_sprint',
    courseId: 'course_cs544',
    courseCode: 'CS544',
    courseName: 'Software Engineering',
    title: 'Sprint Planning Session Schedule',
    content: 'Sprint 1 planning sessions will be scheduled during the lab hours next week. Review Agile guidelines.',
    facultyId: 'user_fac_nair',
    facultyName: 'Dr. S. Nair',
    facultyEmail: 'dr.nair@projectflow.edu',
    isPinned: false,
    isImportant: false,
    publishedAt: '2026-10-16T15:00:00.000Z',
    date: '16 Oct 2026, 03:00 PM',
    attachments: [],
    readBy: []
  }
];

const DEFAULT_COURSE_TEAMS = [
  {
    _id: 'team_alpha',
    courseId: 'course_cs543',
    courseCode: 'CS543',
    name: 'Team Alpha',
    description: 'Cloud microservices orchestration platform with automated CI/CD and monitoring telemetry.',
    teamLead: 'Aarav Sharma',
    teamLeadEmail: 'aarav.sharma@student.edu',
    memberCount: 4,
    maxMembers: 5,
    status: 'Available',
    members: [
      { name: 'Aarav Sharma', email: 'aarav.sharma@student.edu', rollNumber: '20251651010', isLeader: true },
      { name: 'Alex Chen', email: 'alex.chen@student.edu', rollNumber: '20251651001', isLeader: false },
      { name: 'Priya Patel', email: 'priya.patel@student.edu', rollNumber: '20251651002', isLeader: false },
      { name: 'Marcus Vance', email: 'marcus.vance@student.edu', rollNumber: '20251651003', isLeader: false }
    ],
    createdAt: '2026-10-15T10:00:00.000Z'
  },
  {
    _id: 'team_innovators',
    courseId: 'course_cs543',
    courseCode: 'CS543',
    name: 'Team Innovators',
    teamLead: 'Rohit Kumar',
    teamLeadEmail: 'rohit.kumar@student.edu',
    memberCount: 5,
    maxMembers: 5,
    status: 'Full',
    members: [
      { name: 'Rohit Kumar', email: 'rohit.kumar@student.edu', rollNumber: '20251651020', isLeader: true },
      { name: 'Neha Verma', email: 'neha.verma@student.edu', rollNumber: '20251651021', isLeader: false },
      { name: 'Amit Raj', email: 'amit.raj@student.edu', rollNumber: '20251651022', isLeader: false },
      { name: 'Suresh Sen', email: 'suresh.sen@student.edu', rollNumber: '20251651023', isLeader: false },
      { name: 'Kavita Roy', email: 'kavita.roy@student.edu', rollNumber: '20251651024', isLeader: false }
    ],
    createdAt: '2026-10-16T11:00:00.000Z'
  },
  {
    _id: 'team_codecraft',
    courseId: 'course_cs543',
    courseCode: 'CS543',
    name: 'Team CodeCraft',
    teamLead: 'Priya Singh',
    teamLeadEmail: 'priya.singh@student.edu',
    memberCount: 4,
    maxMembers: 5,
    status: 'Open',
    members: [
      { name: 'Priya Singh', email: 'priya.singh@student.edu', rollNumber: '20251651030', isLeader: true },
      { name: 'Karan Dave', email: 'karan.dave@student.edu', rollNumber: '20251651031', isLeader: false },
      { name: 'Simran Kaur', email: 'simran.kaur@student.edu', rollNumber: '20251651032', isLeader: false },
      { name: 'Deepak Joshi', email: 'deepak.joshi@student.edu', rollNumber: '20251651033', isLeader: false }
    ],
    createdAt: '2026-10-17T09:30:00.000Z'
  },
  {
    _id: 'team_nextgen',
    courseId: 'course_cs543',
    courseCode: 'CS543',
    name: 'Team NextGen',
    teamLead: 'Vikram Mehta',
    teamLeadEmail: 'vikram.mehta@student.edu',
    memberCount: 5,
    maxMembers: 5,
    status: 'Full',
    members: [
      { name: 'Vikram Mehta', email: 'vikram.mehta@student.edu', rollNumber: '20251651040', isLeader: true },
      { name: 'Ananya Roy', email: 'ananya.roy@student.edu', rollNumber: '20251651041', isLeader: false },
      { name: 'Rohan Gupta', email: 'rohan.gupta@student.edu', rollNumber: '20251651042', isLeader: false },
      { name: 'Divya Nair', email: 'divya.nair@student.edu', rollNumber: '20251651043', isLeader: false },
      { name: 'Harsh Vardhan', email: 'harsh.vardhan@student.edu', rollNumber: '20251651044', isLeader: false }
    ],
    createdAt: '2026-10-18T14:15:00.000Z'
  }
];

async function seedAnnouncementsIfEmpty() {
  const count = await announcementsCollection.countDocuments({});
  if (count === 0) {
    console.log('[ProjectService] Seeding default course announcements...');
    for (const ann of DEFAULT_ANNOUNCEMENTS) {
      await announcementsCollection.insertOne(ann);
    }
  }
}

async function seedCourseTeamsIfEmpty() {
  const count = await courseTeamsCollection.countDocuments({});
  if (count === 0) {
    console.log('[ProjectService] Seeding default course teams...');
    for (const team of DEFAULT_COURSE_TEAMS) {
      await courseTeamsCollection.insertOne(team);
    }
  }
}

async function getAuthorizedCourse(courseIdOrCode, user) {
  if (!courseIdOrCode) return null;
  const normalizedId = String(courseIdOrCode).trim();
  let course = await coursesCollection.findOne({ _id: normalizedId });
  if (!course) {
    course = await coursesCollection.findOne({ code: normalizedId.toUpperCase() });
  }
  if (!course) return null;

  const userRole = (user?.role || '').toLowerCase();
  const userEmail = (user?.email || '').toLowerCase();
  const userId = user?.id || user?._id;

  if (userRole === 'admin') {
    return course;
  }

  if (userRole === 'student') {
    const emails = (course.enrolledEmails || []).map(e => e.toLowerCase());
    const ids = course.enrolledStudentIds || [];
    if (!emails.includes(userEmail) && !ids.includes(userId)) {
      const err = new Error(`Access denied. You are not enrolled in ${course.code} - ${course.name}.`);
      err.statusCode = 403;
      throw err;
    }
    return course;
  }

  if (userRole === 'faculty') {
    const fEmail = (course.facultyEmail || '').toLowerCase();
    if (fEmail !== userEmail && course.facultyId !== userId) {
      const err = new Error(`Access denied. You are not the assigned faculty for ${course.code}.`);
      err.statusCode = 403;
      throw err;
    }
    return course;
  }

  return course;
}

async function requireInstitutionCoordinator(req, res, next) {
  try {
    const user = await usersCollection.findOne({ _id: req.user?.id });
    if (!user || !['Coordinator', 'Admin'].includes(user.role) || user.status === 'suspended') {
      return res.status(403).json({ error: 'Coordinator access is required' });
    }
    req.user.role = user.role;
    req.user.institutionId = user.institutionId || null;
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function requireFacultyWorkspaceAccess(req, res, next) {
  try {
    const user = await usersCollection.findOne({ _id: req.user?.id });
    if (!user || !['Faculty', 'Coordinator', 'Admin'].includes(user.role) || user.status === 'suspended') {
      return res.status(403).json({ error: 'Faculty or coordinator access is required' });
    }
    req.user.role = user.role;
    req.user.institutionId = user.institutionId || null;
    req.user.email = user.email;
    req.user.name = user.name;
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
}

function facultyWorkspaceCourseFilter(user) {
  if (user.role === 'Admin') return {};
  if (user.role === 'Coordinator') return { institutionId: user.institutionId };
  return { institutionId: user.institutionId, facultyId: String(user.id) };
}

function canManageFacultyCourse(user, course) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Coordinator') return String(user.institutionId) === String(course.institutionId);
  return String(user.institutionId) === String(course.institutionId) && String(course.facultyId) === String(user.id);
}

function coordinatorCourseScope(user) {
  return user.role === 'Admin' ? {} : { institutionId: user.institutionId };
}

// Milestone Evaluation Rule Engine
// Evaluates GitHub evidence + manual documents against defined criteria rules
async function evaluateMilestonesForProject(projectId) {
  try {
    const project = await projectsCollection.findOne({ _id: projectId });
    if (!project) return;

    // 1. Fetch GitHub evidence from Integration Service
    let evidence = {
      connected: false,
      totalCommits: 0,
      totalPRs: 0,
      mergedPRs: 0,
      closedIssues: 0,
      totalContributors: 0
    };

    try {
      const resp = await axios.get(`${INTEGRATION_SERVICE_URL}/github/${projectId}/evidence`, { timeout: 4000 });
      if (resp.data) evidence = resp.data;
    } catch (e) {
      console.warn(`[ProjectService] Could not retrieve GitHub evidence for project ${projectId}:`, e.message);
    }

    // 2. Fetch project documents
    const docs = await documentsCollection.find({ projectId }).toArray();
    const uploadedDocTypes = new Set(docs.map(d => (d.type || '').toLowerCase()));

    // 3. Fetch active criteria
    const criteriaList = await criteriaCollection.find({}).sort({ order: 1 }).toArray();

    // 4. Evaluate each milestone
    for (const crit of criteriaList) {
      const evidenceList = [];
      let totalWeight = 0;
      let achievedWeight = 0;

      // Rule: Repo connection (Weight: 10)
      totalWeight += 10;
      if (evidence.connected) {
        achievedWeight += 10;
        evidenceList.push(`✓ GitHub repository connected (${evidence.repoFullName || 'Active'})`);
      } else {
        evidenceList.push(`✗ GitHub repository not connected`);
      }

      // Rule: Commits (Weight: 25)
      totalWeight += 25;
      const commitCount = evidence.totalCommits || 0;
      const commitScore = Math.min(1, commitCount / Math.max(1, crit.minCommits));
      achievedWeight += commitScore * 25;
      if (commitCount >= crit.minCommits) {
        evidenceList.push(`✓ Commits: ${commitCount}/${crit.minCommits} commits detected`);
      } else {
        evidenceList.push(`⏳ Commits: ${commitCount}/${crit.minCommits} commits (${crit.minCommits - commitCount} remaining)`);
      }

      // Rule: Pull Requests / Merges (Weight: 25)
      totalWeight += 25;
      const mergedCount = evidence.mergedPRs || 0;
      const prScore = Math.min(1, mergedCount / Math.max(1, crit.minMergedPRs));
      achievedWeight += prScore * 25;
      if (mergedCount >= crit.minMergedPRs) {
        evidenceList.push(`✓ Merged PRs: ${mergedCount}/${crit.minMergedPRs} merged pull requests`);
      } else {
        evidenceList.push(`⏳ Merged PRs: ${mergedCount}/${crit.minMergedPRs} merged (${crit.minMergedPRs - mergedCount} remaining)`);
      }

      // Rule: Issues closed (Weight: 20)
      totalWeight += 20;
      const issueCount = evidence.closedIssues || 0;
      const issueScore = Math.min(1, issueCount / Math.max(1, crit.minClosedIssues));
      achievedWeight += issueScore * 20;
      if (issueCount >= crit.minClosedIssues) {
        evidenceList.push(`✓ Issues Closed: ${issueCount}/${crit.minClosedIssues} completed issues`);
      } else {
        evidenceList.push(`⏳ Issues Closed: ${issueCount}/${crit.minClosedIssues} closed`);
      }

      // Rule: Required Document Artifact (Weight: 20) - manual upload verification
      if (crit.requiredDocType) {
        totalWeight += 20;
        const hasDoc = uploadedDocTypes.has(crit.requiredDocType.toLowerCase());
        if (hasDoc) {
          achievedWeight += 20;
          evidenceList.push(`✓ Document Artifact: ${crit.requiredDocType} verified in Documents`);
        } else {
          evidenceList.push(`⏳ Document Artifact: ${crit.requiredDocType} required (upload in Documents)`);
        }
      }

      const calculatedPercentage = Math.round((achievedWeight / totalWeight) * 100);
      const isCompleted = calculatedPercentage >= 100;
      const status = isCompleted ? 'Completed' : (calculatedPercentage > 0 ? 'In Progress' : 'Not Started');

      // Check previous milestone state
      const existing = await projectMilestonesCollection.findOne({ projectId, criteriaCode: crit.code });
      const wasCompleted = existing && existing.status === 'Completed';

      await projectMilestonesCollection.updateOne(
        { projectId, criteriaCode: crit.code },
        {
          $set: {
            projectId,
            criteriaCode: crit.code,
            name: crit.name,
            description: crit.description,
            percentage: calculatedPercentage,
            status,
            evidenceList,
            lastCheckedAt: new Date().toISOString()
          }
        },
        { upsert: true }
      );

      // Trigger RabbitMQ events when milestone status progresses
      if (isCompleted && !wasCompleted) {
        console.log(`[ProjectService] Milestone ${crit.code} REACHED 100% for project ${projectId}!`);
        await eventBus.publish('MilestoneCompleted', {
          projectId,
          projectName: project.name,
          milestoneName: crit.name,
          percentage: 100
        });
      } else if (!existing || existing.percentage !== calculatedPercentage) {
        await eventBus.publish('MilestoneStateChanged', {
          projectId,
          projectName: project.name,
          milestoneName: crit.name,
          percentage: calculatedPercentage,
          status
        });
      }
    }
  } catch (err) {
    console.error(`[ProjectService] Error in evaluateMilestonesForProject (${projectId}):`, err);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'project-service', status: 'healthy', dbType: db.type });
});

// Create Project
app.post('/projects', authenticate, async (req, res) => {
  try {
    const { name, description, facultyId, facultyName } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectDoc = {
      name: name.trim(),
      description: description ? description.trim() : '',
      status: 'In Progress',
      leadId: req.user.id,
      leadName: req.user.name || 'Team Lead',
      leadEmail: req.user.email,
      facultyId: facultyId || null,
      facultyName: facultyName || (facultyId ? 'Assigned Faculty' : 'Unassigned'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await projectsCollection.insertOne(projectDoc);
    const projectId = result.insertedId;

    // Automatically add creating student as Team Leader
    await teamMembersCollection.insertOne({
      projectId,
      userId: req.user.id,
      name: req.user.name || 'Student Lead',
      email: req.user.email,
      role: 'Team Lead',
      isLeader: true,
      addedAt: new Date().toISOString()
    });

    // Populate initial milestones based on active criteria
    await evaluateMilestonesForProject(projectId);

    await eventBus.publish('ProjectCreated', {
      projectId,
      name: projectDoc.name,
      leadName: projectDoc.leadName,
      leadEmail: projectDoc.leadEmail,
      facultyId: projectDoc.facultyId
    });

    res.status(201).json({
      message: 'Project created successfully',
      project: { id: projectId, ...projectDoc }
    });
  } catch (err) {
    console.error('[ProjectService] Create project error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List Projects
app.get('/projects', authenticate, async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    let filter = {};

    if (userRole === 'student') {
      // Find projects where user is lead or a team member
      const teamEntries = await teamMembersCollection.find({ userId: req.user.id }).toArray();
      const projectIds = teamEntries.map(t => t.projectId);
      filter = { $or: [{ leadId: req.user.id }, { _id: { $in: projectIds } }] };
    } else if (userRole === 'faculty') {
      // Find projects assigned to this faculty member, or allow viewing all
      if (req.query.assignedOnly === 'true') {
        filter = { facultyId: req.user.id };
      }
    }

    const projects = await projectsCollection.find(filter).toArray();

    // Enrich with team count, milestone progress, and connection state
    const enriched = await Promise.all(projects.map(async (p) => {
      const teamCount = await teamMembersCollection.countDocuments({ projectId: p._id });
      const milestones = await projectMilestonesCollection.find({ projectId: p._id }).toArray();
      const avgPercentage = milestones.length > 0
        ? Math.round(milestones.reduce((acc, m) => acc + (m.percentage || 0), 0) / milestones.length)
        : 0;

      return {
        id: p._id,
        name: p.name,
        description: p.description,
        status: p.status,
        leadName: p.leadName,
        leadEmail: p.leadEmail,
        facultyId: p.facultyId,
        facultyName: p.facultyName,
        teamSize: teamCount,
        progressPercentage: avgPercentage,
        milestonesCompleted: milestones.filter(m => m.status === 'Completed').length,
        totalMilestones: milestones.length,
        createdAt: p.createdAt
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Project Details
app.get('/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await projectsCollection.findOne({ _id: id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const team = await teamMembersCollection.find({ projectId: id }).toArray();
    const requirements = await requirementsCollection.find({ projectId: id }).toArray();
    const milestones = await projectMilestonesCollection.find({ projectId: id }).toArray();
    const documents = await documentsCollection.find({ projectId: id }).toArray();

    const avgPercentage = milestones.length > 0
      ? Math.round(milestones.reduce((acc, m) => acc + (m.percentage || 0), 0) / milestones.length)
      : 0;

    res.json({
      id: project._id,
      name: project.name,
      description: project.description,
      status: project.status,
      leadId: project.leadId,
      leadName: project.leadName,
      leadEmail: project.leadEmail,
      facultyId: project.facultyId,
      facultyName: project.facultyName,
      teamSize: team.length,
      progressPercentage: avgPercentage,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      team: team.map(t => ({
        id: t._id,
        name: t.name,
        email: t.email,
        role: t.role,
        isLeader: t.isLeader,
        addedAt: t.addedAt
      })),
      requirementsCount: requirements.length,
      milestonesCount: milestones.length,
      documentsCount: documents.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Project
app.put('/projects/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, facultyId, facultyName } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (description !== undefined) update.description = description.trim();
    if (status) update.status = status;
    if (facultyId !== undefined) {
      update.facultyId = facultyId;
      if (facultyName) update.facultyName = facultyName;
    }

    await projectsCollection.updateOne({ _id: id }, { $set: update });
    res.json({ message: 'Project updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Project
app.delete('/projects/:id', authenticate, authorizeRoles('Admin', 'Student'), async (req, res) => {
  try {
    const { id } = req.params;
    await projectsCollection.deleteOne({ _id: id });
    await teamMembersCollection.deleteMany({ projectId: id });
    await requirementsCollection.deleteMany({ projectId: id });
    await projectMilestonesCollection.deleteMany({ projectId: id });
    await documentsCollection.deleteMany({ projectId: id });

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team Management
app.get('/projects/:id/team', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const members = await teamMembersCollection.find({ projectId: id }).toArray();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/projects/:id/team/members', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isLeader } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const memberDoc = {
      projectId: id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role || 'Developer',
      isLeader: Boolean(isLeader),
      addedAt: new Date().toISOString()
    };

    const result = await teamMembersCollection.insertOne(memberDoc);
    res.status(201).json({ id: result.insertedId, ...memberDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/projects/:id/team/members/:memberId', authenticate, async (req, res) => {
  try {
    const { id, memberId } = req.params;
    await teamMembersCollection.deleteOne({ _id: memberId, projectId: id });
    res.json({ message: 'Member removed from team' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Requirements (Manually entered by students per SRS)
app.get('/projects/:id/requirements', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const reqs = await requirementsCollection.find({ projectId: id }).toArray();
    res.json(reqs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/projects/:id/requirements', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const count = await requirementsCollection.countDocuments({ projectId: id });
    const reqCode = `REQ-${String(count + 1).padStart(2, '0')}`;

    const newReq = {
      projectId: id,
      reqCode,
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: priority || 'Medium',
      category: category || 'Functional',
      status: 'Pending',
      createdBy: req.user.id,
      createdByName: req.user.name,
      createdAt: new Date().toISOString()
    };

    const result = await requirementsCollection.insertOne(newReq);
    res.status(201).json({ id: result.insertedId, ...newReq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/projects/:id/requirements/:reqId', authenticate, async (req, res) => {
  try {
    const { id, reqId } = req.params;
    const { title, description, priority, status } = req.body;
    const update = {};
    if (title) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    if (priority) update.priority = priority;
    if (status) update.status = status;

    await requirementsCollection.updateOne({ _id: reqId, projectId: id }, { $set: update });
    res.json({ message: 'Requirement updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/projects/:id/requirements/:reqId', authenticate, async (req, res) => {
  try {
    const { id, reqId } = req.params;
    await requirementsCollection.deleteOne({ _id: reqId, projectId: id });
    res.json({ message: 'Requirement deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Milestones & Progress
app.get('/projects/:id/milestones', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // Always trigger recalculation on read to ensure newest GitHub evidence is reflected
    await evaluateMilestonesForProject(id);
    const milestones = await projectMilestonesCollection.find({ projectId: id }).toArray();
    res.json(milestones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/projects/:id/milestones/recalculate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await evaluateMilestonesForProject(id);
    const milestones = await projectMilestonesCollection.find({ projectId: id }).toArray();
    res.json({ message: 'Milestones recalculated successfully', milestones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Milestone Evaluation Criteria Management
app.get('/criteria', authenticate, async (req, res) => {
  try {
    const criteria = await criteriaCollection.find({}).sort({ order: 1 }).toArray();
    res.json(criteria);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/criteria', authenticate, authorizeRoles('Faculty', 'Admin'), async (req, res) => {
  try {
    const { name, description, minCommits, minPRs, minMergedPRs, minClosedIssues, requiredDocType } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const count = await criteriaCollection.countDocuments({});
    const critDoc = {
      code: `M${count + 1}`,
      name: name.trim(),
      description: description || '',
      minCommits: parseInt(minCommits || 0, 10),
      minPRs: parseInt(minPRs || 0, 10),
      minMergedPRs: parseInt(minMergedPRs || 0, 10),
      minClosedIssues: parseInt(minClosedIssues || 0, 10),
      requiredDocType: requiredDocType || '',
      order: count + 1,
      createdAt: new Date().toISOString()
    };

    const result = await criteriaCollection.insertOne(critDoc);
    res.status(201).json({ id: result.insertedId, ...critDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/criteria/:id', authenticate, authorizeRoles('Faculty', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, minCommits, minPRs, minMergedPRs, minClosedIssues, requiredDocType } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (description !== undefined) update.description = description.trim();
    if (minCommits !== undefined) update.minCommits = parseInt(minCommits, 10);
    if (minPRs !== undefined) update.minPRs = parseInt(minPRs, 10);
    if (minMergedPRs !== undefined) update.minMergedPRs = parseInt(minMergedPRs, 10);
    if (minClosedIssues !== undefined) update.minClosedIssues = parseInt(minClosedIssues, 10);
    if (requiredDocType !== undefined) update.requiredDocType = requiredDocType;

    await criteriaCollection.updateOne({ _id: id }, { $set: update });
    res.json({ message: 'Criteria updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/criteria/:id', authenticate, authorizeRoles('Faculty', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await criteriaCollection.deleteOne({ _id: id });
    res.json({ message: 'Criteria rule deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Documents (Manual file uploads / records per SRS)
app.get('/projects/:id/documents', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const docs = await documentsCollection.find({ projectId: id }).toArray();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/projects/:id/documents', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, fileUrl, fileSize } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Document name and type are required' });
    }

    const doc = {
      projectId: id,
      name: name.trim(),
      type: type.trim(), // e.g. 'SRS', 'Architecture Design', 'Final Report', 'User Manual'
      fileUrl: fileUrl || `https://projectflow.academic.storage/docs/${id}/${encodeURIComponent(name)}.pdf`,
      fileSize: fileSize || '1.8 MB',
      uploadedBy: req.user.id,
      uploadedByName: req.user.name,
      uploadedAt: new Date().toISOString()
    };

    const result = await documentsCollection.insertOne(doc);

    // Re-evaluate milestones because documents may satisfy milestone criteria
    await evaluateMilestonesForProject(id);

    await eventBus.publish('DocumentUploaded', {
      projectId: id,
      docName: doc.name,
      docType: doc.type,
      uploadedBy: doc.uploadedByName
    });

    res.status(201).json({ id: result.insertedId, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/projects/:id/documents/:docId', authenticate, async (req, res) => {
  try {
    const { id, docId } = req.params;
    await documentsCollection.deleteOne({ _id: docId, projectId: id });
    await evaluateMilestonesForProject(id);
    res.json({ message: 'Document removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive Project Overview
app.get('/projects/:id/overview', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await projectsCollection.findOne({ _id: id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const team = await teamMembersCollection.find({ projectId: id }).toArray();
    const requirements = await requirementsCollection.find({ projectId: id }).toArray();
    const milestones = await projectMilestonesCollection.find({ projectId: id }).toArray();
    const documents = await documentsCollection.find({ projectId: id }).toArray();

    let githubStats = { connected: false, totalCommits: 0, totalPRs: 0, mergedPRs: 0, closedIssues: 0 };
    try {
      const ghRes = await axios.get(`${INTEGRATION_SERVICE_URL}/github/${id}/status`, { timeout: 3000 });
      if (ghRes.data) githubStats = ghRes.data;
    } catch (e) {
      // safe fallback
    }

    const avgPercentage = milestones.length > 0
      ? Math.round(milestones.reduce((acc, m) => acc + (m.percentage || 0), 0) / milestones.length)
      : 0;

    res.json({
      project,
      team,
      requirements,
      milestones,
      documents,
      githubStats,
      progressPercentage: avgPercentage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Academic Courses APIs (Google Classroom style)
// ==========================================

// Coordinator extensions to the existing course model. Each new course is institution-scoped.
app.get('/coordinator/courses', authenticate, requireInstitutionCoordinator, async (req, res) => {
  try {
    const courses = await coursesCollection.find(coordinatorCourseScope(req.user)).sort({ createdAt: -1 }).toArray();
    res.json(courses.map(course => ({ id: course._id, code: course.code, name: course.name, branchId: course.branchId, branchName: course.branchName, batchId: course.batchId, batch: course.batch, sessionId: course.sessionId, sessionName: course.sessionName, semester: course.semester, description: course.description || '', facultyName: course.facultyName || '', facultyEmail: course.facultyEmail || '', facultyId: course.facultyId || null, createdAt: course.createdAt })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/coordinator/courses', authenticate, requireInstitutionCoordinator, async (req, res) => {
  try {
    const institutionId = req.user.role === 'Admin' ? String(req.body.institutionId || '') : String(req.user.institutionId || '');
    const { name, code, branchId, batchId, sessionId } = req.body;
    if (!institutionId || !String(name || '').trim() || !String(code || '').trim() || !branchId || !batchId || !sessionId) return res.status(400).json({ error: 'Institution, course name and code, branch, batch, and session are required' });
    if (req.user.role !== 'Admin' && institutionId !== String(req.user.institutionId)) return res.status(403).json({ error: 'Institution access denied' });
    const [branch, batch, session] = await Promise.all([
      branchesCollection.findOne({ _id: String(branchId), institutionId }),
      batchesCollection.findOne({ _id: String(batchId), institutionId }),
      sessionsCollection.findOne({ _id: String(sessionId), institutionId })
    ]);
    if (!branch || !batch || !session || batch.branchId !== String(branchId) || batch.sessionId !== String(sessionId)) return res.status(400).json({ error: 'Selected branch, batch, and session must belong together in this institution' });
    const normalizedCode = String(code).trim().toUpperCase();
    if (await coursesCollection.findOne({ institutionId, code: normalizedCode })) return res.status(409).json({ error: 'This course code already exists in the institution' });
    const course = { _id: generateId(), institutionId, code: normalizedCode, name: String(name).trim(), department: branch.name, branchId: String(branchId), branchName: branch.name, batchId: String(batchId), batch: batch.name, sessionId: String(sessionId), sessionName: session.name, semester: String(req.body.semester || '').trim(), description: String(req.body.description || '').trim(), facultyId: null, facultyName: '', facultyEmail: '', enrolledEmails: [], enrolledStudentIds: [], announcements: [], resources: [], createdBy: req.user.id, createdAt: new Date().toISOString() };
    await coursesCollection.insertOne(course);
    res.status(201).json({ id: course._id, ...course });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/coordinator/courses/:id', authenticate, requireInstitutionCoordinator, async (req, res) => {
  try {
    const course = await coursesCollection.findOne({ _id: req.params.id, ...coordinatorCourseScope(req.user) });
    if (!course) return res.status(404).json({ error: 'Course not found in your institution' });
    const update = {};
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    if (req.body.description !== undefined) update.description = String(req.body.description).trim();
    if (req.body.semester !== undefined) update.semester = String(req.body.semester).trim();
    if (update.name === '') return res.status(400).json({ error: 'Course name cannot be empty' });
    await coursesCollection.updateOne({ _id: course._id }, { $set: update });
    res.json({ ...course, ...update });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/coordinator/assignments', authenticate, requireInstitutionCoordinator, async (req, res) => {
  try { res.json(await facultyAssignmentsCollection.find(coordinatorCourseScope(req.user)).sort({ createdAt: -1 }).toArray()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/coordinator/assignments', authenticate, requireInstitutionCoordinator, async (req, res) => {
  try {
    const { courseId, facultyId } = req.body;
    const scope = coordinatorCourseScope(req.user);
    const course = await coursesCollection.findOne({ _id: String(courseId || ''), ...scope });
    if (!course) return res.status(404).json({ error: 'Course not found in your institution' });
    const faculty = await usersCollection.findOne({ _id: String(facultyId || ''), role: 'Faculty', institutionId: course.institutionId, status: 'active' });
    if (!faculty) return res.status(400).json({ error: 'Select an active faculty member associated with this institution' });
    const activeCourseAssignment = await facultyAssignmentsCollection.findOne({ courseId: course._id, status: 'active' });
    if (activeCourseAssignment && String(activeCourseAssignment.facultyId) !== String(faculty._id)) return res.status(409).json({ error: 'This course already has a faculty member. Reassign its existing assignment instead.' });
    const duplicate = await facultyAssignmentsCollection.findOne({ courseId: course._id, facultyId: String(faculty._id), batchId: course.batchId, sessionId: course.sessionId, status: 'active' });
    if (duplicate) return res.status(409).json({ error: 'This faculty assignment already exists' });
    const assignment = { _id: generateId(), institutionId: course.institutionId, courseId: course._id, courseCode: course.code, courseName: course.name, facultyId: String(faculty._id), facultyName: faculty.name, facultyEmail: faculty.email, branchId: course.branchId, branchName: course.branchName, batchId: course.batchId, batchName: course.batch, sessionId: course.sessionId, sessionName: course.sessionName, semester: course.semester, status: 'active', createdBy: req.user.id, createdAt: new Date().toISOString() };
    await facultyAssignmentsCollection.insertOne(assignment);
    await coursesCollection.updateOne({ _id: course._id }, { $set: { facultyId: String(faculty._id), facultyName: faculty.name, facultyEmail: faculty.email } });
    res.status(201).json(assignment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/coordinator/assignments/:id', authenticate, requireInstitutionCoordinator, async (req, res) => {
  try {
    const assignment = await facultyAssignmentsCollection.findOne({ _id: req.params.id, ...coordinatorCourseScope(req.user), status: 'active' });
    if (!assignment) return res.status(404).json({ error: 'Assignment not found in your institution' });
    const faculty = await usersCollection.findOne({ _id: String(req.body.facultyId || ''), role: 'Faculty', institutionId: assignment.institutionId, status: 'active' });
    if (!faculty) return res.status(400).json({ error: 'Select an active faculty member associated with this institution' });
    const duplicate = await facultyAssignmentsCollection.findOne({ courseId: assignment.courseId, facultyId: String(faculty._id), batchId: assignment.batchId, sessionId: assignment.sessionId, status: 'active' });
    if (duplicate && String(duplicate._id) !== String(assignment._id)) return res.status(409).json({ error: 'This faculty assignment already exists' });
    await facultyAssignmentsCollection.updateOne({ _id: assignment._id }, { $set: { facultyId: String(faculty._id), facultyName: faculty.name, facultyEmail: faculty.email, updatedBy: req.user.id } });
    await coursesCollection.updateOne({ _id: assignment.courseId }, { $set: { facultyId: String(faculty._id), facultyName: faculty.name, facultyEmail: faculty.email } });
    res.json({ ...assignment, facultyId: String(faculty._id), facultyName: faculty.name, facultyEmail: faculty.email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Faculty teaching workspace: coordinator-assigned courses, branch roster, teams, and project rules.
app.get('/faculty/courses', authenticate, requireFacultyWorkspaceAccess, async (req, res) => {
  try {
    const courses = await coursesCollection.find(facultyWorkspaceCourseFilter(req.user)).sort({ name: 1 }).toArray();
    res.json(courses.map(course => ({ id: course._id, code: course.code, name: course.name, description: course.description || '', projectBrief: course.projectBrief || '', teamRules: course.teamRules || { minMembers: 4, maxMembers: 5, minFemaleMembers: 0 }, projectDeadline: course.projectDeadline || null, institutionId: course.institutionId, branchId: course.branchId, branchName: course.branchName, batchId: course.batchId, batch: course.batch, sessionId: course.sessionId, sessionName: course.sessionName, semester: course.semester, facultyId: course.facultyId || null, facultyName: course.facultyName || '', createdAt: course.createdAt })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/faculty/courses/:id', authenticate, requireFacultyWorkspaceAccess, async (req, res) => {
  try {
    const course = await coursesCollection.findOne({ _id: req.params.id });
    if (!course || !canManageFacultyCourse(req.user, course)) return res.status(404).json({ error: 'Course not found in your teaching scope' });
    const [teamRows, eligibleRows, projects] = await Promise.all([
      courseTeamsCollection.find({ $or: [{ courseId: course._id }, { courseCode: course.code }] }).toArray(),
      usersCollection.find({ role: 'Student', institutionId: course.institutionId, branchId: course.branchId, status: 'active' }).toArray(),
      projectsCollection.find({ $or: [{ courseId: course._id }, { courseCode: course.code }] }).toArray()
    ]);
    const profilesByEmail = new Map(eligibleRows.map(student => [String(student.email || '').toLowerCase(), student]));
    const enrolledIds = new Set((course.enrolledStudentIds || []).map(String));
    const enrolledEmails = new Set((course.enrolledEmails || []).map(email => String(email).toLowerCase()));
    const roster = eligibleRows.filter(student => enrolledIds.has(String(student._id)) || enrolledEmails.has(String(student.email || '').toLowerCase()));
    for (const team of teamRows) for (const member of team.members || []) {
      const profile = profilesByEmail.get(String(member.email || '').toLowerCase());
      if (profile && !roster.some(student => String(student._id) === String(profile._id))) roster.push(profile);
    }
    const publicStudent = student => ({ id: student._id, name: student.name, email: student.email, rollNumber: student.rollNumber || '', department: student.department || '', batch: student.batch || '', avatarUrl: student.avatarUrl || '', institutionId: student.institutionId || null, branchId: student.branchId || null });
    const studentMap = new Map([...eligibleRows, ...roster].map(student => [String(student.email || '').toLowerCase(), publicStudent(student)]));
    const teams = teamRows.map(team => ({ id: team._id || team.id, name: team.name, description: team.description || '', status: team.status || 'Available', projectStatus: team.projectStatus || 'Not started', progressPercentage: Number(team.progressPercentage) || 0, maxMembers: team.maxMembers || course.teamRules?.maxMembers || 5, members: (team.members || []).map(member => ({ ...member, ...(studentMap.get(String(member.email || '').toLowerCase()) || {}) })), createdAt: team.createdAt }));
    const eligibleStudents = eligibleRows.filter(student => !roster.some(enrolled => String(enrolled._id) === String(student._id))).map(publicStudent).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    res.json({ course: { id: course._id, code: course.code, name: course.name, description: course.description || '', projectBrief: course.projectBrief || '', teamRules: course.teamRules || { minMembers: 4, maxMembers: 5, minFemaleMembers: 0 }, projectDeadline: course.projectDeadline || null, institutionId: course.institutionId, branchId: course.branchId, branchName: course.branchName, batchId: course.batchId, batch: course.batch, sessionId: course.sessionId, sessionName: course.sessionName, semester: course.semester, facultyId: course.facultyId || null, facultyName: course.facultyName || '' }, students: roster.map(publicStudent).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), eligibleStudents, teams, projects: projects.map(project => ({ id: project._id, name: project.name, status: project.status, progressPercentage: project.progressPercentage || 0, githubUrl: project.githubUrl || project.repositoryUrl || '', courseCode: project.courseCode || course.code })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/faculty/courses/:id/rules', authenticate, requireFacultyWorkspaceAccess, async (req, res) => {
  try {
    const course = await coursesCollection.findOne({ _id: req.params.id });
    if (!course || !canManageFacultyCourse(req.user, course)) return res.status(404).json({ error: 'Course not found in your teaching scope' });
    const minMembers = Number(req.body.teamRules?.minMembers);
    const maxMembers = Number(req.body.teamRules?.maxMembers);
    const minFemaleMembers = Number(req.body.teamRules?.minFemaleMembers || 0);
    if (!Number.isInteger(minMembers) || !Number.isInteger(maxMembers) || minMembers < 2 || maxMembers > 10 || minMembers > maxMembers) return res.status(400).json({ error: 'Team size must be between 2 and 10, with minimum no greater than maximum' });
    if (!Number.isInteger(minFemaleMembers) || minFemaleMembers < 0 || minFemaleMembers > maxMembers) return res.status(400).json({ error: 'Minimum women members must be between 0 and the maximum team size' });
    const projectBrief = String(req.body.projectBrief || '').trim();
    const projectDeadline = req.body.projectDeadline ? new Date(req.body.projectDeadline).toISOString() : null;
    if (projectBrief.length > 5000) return res.status(400).json({ error: 'Project brief cannot exceed 5,000 characters' });
    const update = { teamRules: { minMembers, maxMembers, minFemaleMembers }, projectBrief, projectDeadline };
    await coursesCollection.updateOne({ _id: course._id }, { $set: update });
    res.json({ id: course._id, ...update });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/faculty/courses/:id/students', authenticate, requireFacultyWorkspaceAccess, async (req, res) => {
  try {
    const course = await coursesCollection.findOne({ _id: req.params.id });
    if (!course || !canManageFacultyCourse(req.user, course)) return res.status(404).json({ error: 'Course not found in your teaching scope' });
    const studentIds = [...new Set((Array.isArray(req.body.studentIds) ? req.body.studentIds : []).map(String))].slice(0, 200);
    if (!studentIds.length) return res.status(400).json({ error: 'Select at least one student to enroll' });
    const enrolled = await usersCollection.find({ _id: { $in: studentIds }, role: 'Student', institutionId: course.institutionId, branchId: course.branchId, status: 'active' }).toArray();
    if (enrolled.length !== studentIds.length) return res.status(400).json({ error: 'Only active students from this course branch can be enrolled' });
    const ids = [...new Set([...(course.enrolledStudentIds || []).map(String), ...enrolled.map(student => String(student._id))])];
    const emails = [...new Set([...(course.enrolledEmails || []).map(email => String(email).toLowerCase()), ...enrolled.map(student => String(student.email).toLowerCase())])];
    await coursesCollection.updateOne({ _id: course._id }, { $set: { enrolledStudentIds: ids, enrolledEmails: emails } });
    res.json({ enrolled: enrolled.length, studentIds: ids });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/faculty/courses/:id/teams/:teamId/status', authenticate, requireFacultyWorkspaceAccess, async (req, res) => {
  try {
    const course = await coursesCollection.findOne({ _id: req.params.id });
    if (!course || !canManageFacultyCourse(req.user, course)) return res.status(404).json({ error: 'Course not found in your teaching scope' });
    const team = await courseTeamsCollection.findOne({ _id: req.params.teamId, courseId: course._id });
    if (!team) return res.status(404).json({ error: 'Project team not found in this course' });
    const allowed = ['Not started', 'In progress', 'Submitted', 'Under review', 'Completed'];
    const projectStatus = String(req.body.projectStatus || '');
    if (!allowed.includes(projectStatus)) return res.status(400).json({ error: 'Choose a valid project status' });
    const progressPercentage = Math.max(0, Math.min(100, Number(req.body.progressPercentage) || 0));
    await courseTeamsCollection.updateOne({ _id: team._id }, { $set: { projectStatus, progressPercentage, statusUpdatedBy: req.user.id, statusUpdatedAt: new Date().toISOString() } });
    res.json({ id: team._id, projectStatus, progressPercentage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 1. GET /courses - list authorized courses with optional search
app.get('/courses', authenticate, async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const userEmail = (req.user.email || '').toLowerCase();
    const userId = req.user.id || req.user._id;

    let courses = await coursesCollection.find({}).toArray();

    // Authorization: filter according to authenticated role
    if (userRole === 'student') {
      courses = courses.filter(c => {
        const emails = (c.enrolledEmails || []).map(e => e.toLowerCase());
        const ids = c.enrolledStudentIds || [];
        return emails.includes(userEmail) || ids.includes(userId);
      });
    } else if (userRole === 'faculty') {
      courses = courses.filter(c => {
        const fEmail = (c.facultyEmail || '').toLowerCase();
        return fEmail === userEmail || c.facultyId === userId;
      });
    }
    // Admin role receives all courses

    // Search query filtering
    if (req.query.search) {
      const searchStr = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
      const q = String(searchStr || '').trim().toLowerCase();
      courses = courses.filter(c =>
        (c.code || '').toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.facultyName || '').toLowerCase().includes(q) ||
        (c.batch || '').toLowerCase().includes(q) ||
        (c.semester || '').toLowerCase().includes(q)
      );
    }

    const formatted = courses.map(c => ({
      id: c._id,
      code: c.code,
      name: c.name,
      facultyName: c.facultyName,
      facultyEmail: c.facultyEmail,
      batch: c.batch,
      semester: c.semester,
      department: c.department,
      color: c.color,
      icon: c.icon,
      description: c.description,
      announcementsCount: (c.announcements || []).length,
      createdAt: c.createdAt
    }));

    res.json(formatted);
  } catch (err) {
    console.error('[ProjectService] Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to retrieve courses: ' + err.message });
  }
});

// 2. GET /courses/broadcasts - announcements across authorized courses
app.get('/courses/broadcasts', authenticate, async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const userEmail = (req.user.email || '').toLowerCase();
    const userId = req.user.id || req.user._id;

    let courses = await coursesCollection.find({}).toArray();

    if (userRole === 'student') {
      courses = courses.filter(c => {
        const emails = (c.enrolledEmails || []).map(e => e.toLowerCase());
        const ids = c.enrolledStudentIds || [];
        return emails.includes(userEmail) || ids.includes(userId);
      });
    } else if (userRole === 'faculty') {
      courses = courses.filter(c => {
        const fEmail = (c.facultyEmail || '').toLowerCase();
        return fEmail === userEmail || c.facultyId === userId;
      });
    }

    const courseMap = new Map();
    courses.forEach(c => {
      courseMap.set(c.code, c);
      if (c._id) courseMap.set(String(c._id), c);
    });

    const broadcasts = [];
    const allAnnouncements = await announcementsCollection.find({}).toArray();
    for (const ann of allAnnouncements) {
      const c = courseMap.get(ann.courseCode) || courseMap.get(String(ann.courseId));
      if (c) {
        broadcasts.push({
          ...ann,
          id: ann._id || ann.id,
          courseId: c._id,
          courseCode: c.code,
          courseName: c.name,
          color: c.color
        });
      }
    }

    if (broadcasts.length === 0) {
      courses.forEach(c => {
        (c.announcements || []).forEach(ann => {
          broadcasts.push({
            ...ann,
            id: ann._id || ann.id,
            courseId: c._id,
            courseCode: c.code,
            courseName: c.name,
            color: c.color
          });
        });
      });
    }

    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve broadcasts: ' + err.message });
  }
});

// 3. GET /courses/:id - single course details by ID or code with authorization check
app.get('/courses/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    res.json({
      id: course._id,
      code: course.code,
      name: course.name,
      facultyName: course.facultyName,
      facultyEmail: course.facultyEmail,
      batch: course.batch,
      semester: course.semester,
      department: course.department,
      color: course.color,
      icon: course.icon,
      description: course.description,
      teamRules: course.teamRules || { minMembers: 4, maxMembers: 5, minFemaleMembers: 0 },
      projectBrief: course.projectBrief || '',
      projectDeadline: course.projectDeadline || null,
      instructorMessage: course.instructorMessage || null,
      announcements: course.announcements || [],
      resources: course.resources || [],
      createdAt: course.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve course details: ' + err.message });
  }
});

// 4. GET /courses/:id/announcements - list announcements for course with search/unread/pinned filters
app.get('/courses/:id/announcements', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const filter = {
      $or: [
        { courseId: course._id },
        { courseCode: course.code }
      ]
    };

    let announcements = await announcementsCollection.find(filter).toArray();

    if (announcements.length === 0 && course.announcements && course.announcements.length > 0) {
      announcements = course.announcements.map(a => ({
        ...a,
        courseId: course._id,
        courseCode: course.code,
        courseName: course.name,
        facultyName: course.facultyName,
        facultyEmail: course.facultyEmail,
        isPinned: Boolean(a.isPinned),
        isImportant: Boolean(a.isImportant),
        publishedAt: a.publishedAt || new Date().toISOString(),
        date: a.date || 'Recent',
        attachments: a.attachments || [],
        readBy: a.readBy || []
      }));
    }

    const userEmail = (req.user.email || '').toLowerCase();
    const userId = req.user.id || req.user._id;

    // Filter by search query if provided
    const searchParam = req.query.search;
    const searchStr = Array.isArray(searchParam) ? searchParam[0] : searchParam;
    if (searchStr && typeof searchStr === 'string' && searchStr.trim()) {
      const q = searchStr.trim().toLowerCase();
      announcements = announcements.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.content && a.content.toLowerCase().includes(q)) ||
        (a.facultyName && a.facultyName.toLowerCase().includes(q))
      );
    }

    // Filter by unreadOnly if provided
    if (req.query.unreadOnly === 'true') {
      announcements = announcements.filter(a => {
        const reads = (a.readBy || []).map(r => String(r).toLowerCase());
        return !reads.includes(userEmail) && !reads.includes(String(userId));
      });
    }

    // Filter by pinnedOnly if provided
    if (req.query.pinnedOnly === 'true') {
      announcements = announcements.filter(a => a.isPinned);
    }

    // Sort: pinned first, then by publishedAt descending
    announcements.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const dateA = new Date(a.publishedAt || a.date || 0);
      const dateB = new Date(b.publishedAt || b.date || 0);
      return dateB - dateA;
    });

    // Format response and attach isRead indicator
    const formatted = announcements.map(a => {
      const reads = (a.readBy || []).map(r => String(r).toLowerCase());
      const isRead = reads.includes(userEmail) || reads.includes(String(userId));
      return {
        id: a._id || a.id,
        _id: a._id || a.id,
        courseId: a.courseId || course._id,
        courseCode: a.courseCode || course.code,
        courseName: a.courseName || course.name,
        title: a.title,
        content: a.content,
        facultyId: a.facultyId,
        facultyName: a.facultyName || course.facultyName,
        facultyEmail: a.facultyEmail || course.facultyEmail,
        isPinned: Boolean(a.isPinned),
        isImportant: Boolean(a.isImportant),
        publishedAt: a.publishedAt,
        date: a.date,
        attachments: a.attachments || [],
        readBy: a.readBy || [],
        isRead
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve announcements: ' + err.message });
  }
});

// 5. GET /courses/:id/announcements/:announcementId - single announcement
app.get('/courses/:id/announcements/:announcementId', authenticate, async (req, res) => {
  try {
    const { id, announcementId } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    let announcement = await announcementsCollection.findOne({ _id: announcementId });
    if (!announcement) {
      announcement = await announcementsCollection.findOne({ id: announcementId });
    }
    if (!announcement) {
      return res.status(404).json({ error: `Announcement '${announcementId}' not found` });
    }

    // Verify announcement belongs to this course
    if (announcement.courseCode !== course.code && announcement.courseId !== course._id) {
      return res.status(404).json({ error: `Announcement does not belong to course ${course.code}` });
    }

    const userEmail = (req.user.email || '').toLowerCase();
    const userId = req.user.id || req.user._id;
    const reads = (announcement.readBy || []).map(r => String(r).toLowerCase());
    const isRead = reads.includes(userEmail) || reads.includes(String(userId));

    res.json({
      ...announcement,
      id: announcement._id || announcement.id,
      isRead
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve announcement: ' + err.message });
  }
});

// 6. POST /courses/:id/announcements - faculty/admin publish announcement
app.post('/courses/:id/announcements', authenticate, authorizeRoles('Faculty', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const { title, content, isPinned, isImportant, attachments } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Announcement title is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Announcement content is required' });
    }

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const newAnnouncement = {
      _id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      courseId: course._id,
      courseCode: course.code,
      courseName: course.name,
      title: title.trim(),
      content: content.trim(),
      facultyId: req.user.id || req.user._id,
      facultyName: req.user.name || course.facultyName,
      facultyEmail: req.user.email || course.facultyEmail,
      isPinned: Boolean(isPinned),
      isImportant: Boolean(isImportant),
      publishedAt: now.toISOString(),
      date: dateFormatted,
      attachments: Array.isArray(attachments) ? attachments : [],
      readBy: []
    };

    await announcementsCollection.insertOne(newAnnouncement);

    if (eventBus) {
      eventBus.publish('AnnouncementPublished', {
        announcementId: newAnnouncement._id,
        courseCode: course.code,
        title: newAnnouncement.title
      }).catch(e => console.warn('[ProjectService] EventBus error:', e.message));
    }

    res.status(201).json({
      ...newAnnouncement,
      id: newAnnouncement._id,
      isRead: false
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create announcement: ' + err.message });
  }
});

// 7. PUT /courses/:id/announcements/:announcementId - faculty/admin update announcement
app.put('/courses/:id/announcements/:announcementId', authenticate, authorizeRoles('Faculty', 'Admin'), async (req, res) => {
  try {
    const { id, announcementId } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    let announcement = await announcementsCollection.findOne({ _id: announcementId });
    if (!announcement) {
      announcement = await announcementsCollection.findOne({ id: announcementId });
    }
    if (!announcement) {
      return res.status(404).json({ error: `Announcement '${announcementId}' not found` });
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.content !== undefined) updates.content = req.body.content.trim();
    if (req.body.isPinned !== undefined) updates.isPinned = Boolean(req.body.isPinned);
    if (req.body.isImportant !== undefined) updates.isImportant = Boolean(req.body.isImportant);
    if (req.body.attachments !== undefined) updates.attachments = req.body.attachments;
    updates.updatedAt = new Date().toISOString();

    await announcementsCollection.updateOne(
      { _id: announcement._id },
      { $set: updates }
    );

    const updated = await announcementsCollection.findOne({ _id: announcement._id });
    res.json({
      ...updated,
      id: updated._id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update announcement: ' + err.message });
  }
});

// 8. DELETE /courses/:id/announcements/:announcementId - faculty/admin delete announcement
app.delete('/courses/:id/announcements/:announcementId', authenticate, authorizeRoles('Faculty', 'Admin'), async (req, res) => {
  try {
    const { id, announcementId } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    let announcement = await announcementsCollection.findOne({ _id: announcementId });
    if (!announcement) {
      announcement = await announcementsCollection.findOne({ id: announcementId });
    }
    if (!announcement) {
      return res.status(404).json({ error: `Announcement '${announcementId}' not found` });
    }

    await announcementsCollection.deleteOne({ _id: announcement._id });
    res.json({ message: 'Announcement deleted successfully', announcementId: announcement._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete announcement: ' + err.message });
  }
});

// 9. PUT /courses/:id/announcements/:announcementId/read - toggle/mark read status
app.put('/courses/:id/announcements/:announcementId/read', authenticate, async (req, res) => {
  try {
    const { id, announcementId } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    let announcement = await announcementsCollection.findOne({ _id: announcementId });
    if (!announcement) {
      announcement = await announcementsCollection.findOne({ id: announcementId });
    }
    if (!announcement) {
      return res.status(404).json({ error: `Announcement '${announcementId}' not found` });
    }

    const userEmail = (req.user.email || '').toLowerCase();
    const markUnread = req.body && req.body.unread === true;
    let currentReadBy = Array.isArray(announcement.readBy) ? [...announcement.readBy] : [];

    if (markUnread) {
      currentReadBy = currentReadBy.filter(e => e.toLowerCase() !== userEmail);
    } else {
      if (!currentReadBy.map(e => e.toLowerCase()).includes(userEmail)) {
        currentReadBy.push(userEmail);
      }
    }

    await announcementsCollection.updateOne(
      { _id: announcement._id },
      { $set: { readBy: currentReadBy } }
    );

    const isRead = !markUnread;
    res.json({
      success: true,
      announcementId: announcement._id,
      isRead,
      readByCount: currentReadBy.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update read status: ' + err.message });
  }
});

// 10. GET /courses/:id/attachments/:filename - secure attachment download
app.get('/courses/:id/attachments/:filename', authenticate, async (req, res) => {
  try {
    const { id, filename } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const cleanFilename = path.basename(filename);
    const ext = path.extname(cleanFilename).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.docx' || ext === '.doc') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.zip') contentType = 'application/zip';
    else if (ext === '.txt' || ext === '.md') contentType = 'text/plain; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);

    let contentBuffer;
    if (ext === '.pdf') {
      const pdfText = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 260 >>\nstream\nBT\n/F1 16 Tf\n50 720 Td\n(ProjectFlow Course Document: ${course.code} - ${course.name}) Tj\n/F1 12 Tf\n0 -30 Td\n(Document: ${cleanFilename}) Tj\n0 -20 Td\n(Instructor: ${course.facultyName}) Tj\n0 -20 Td\n(Academic Batch: ${course.batch || '2026-2028'}) Tj\n0 -20 Td\n(Authorized Download for: ${req.user.name || req.user.email}) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000262 00000 n \n0000000580 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n660\n%%EOF`;
      contentBuffer = Buffer.from(pdfText, 'utf-8');
    } else {
      contentBuffer = Buffer.from(
        `ProjectFlow Course Material\nCourse: ${course.code} - ${course.name}\nInstructor: ${course.facultyName}\nFile: ${cleanFilename}\nGenerated for enrolled student: ${req.user.name || req.user.email}\n`
      );
    }

    res.send(contentBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve attachment: ' + err.message });
  }
});

// 11. GET /courses/:id/teams - team listing for the course
app.get('/courses/:id/teams', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const filter = {
      $or: [
        { courseId: course._id },
        { courseCode: course.code }
      ]
    };

    let teams = await courseTeamsCollection.find(filter).toArray();
    const userEmail = (req.user.email || '').toLowerCase();

    const formatted = teams.map(t => {
      const members = Array.isArray(t.members) ? t.members : [];
      const isUserMember = members.some(m => (m.email || '').toLowerCase() === userEmail) ||
                           ((t.teamLeadEmail || '').toLowerCase() === userEmail);
      const memberCount = members.length || t.memberCount || 0;
      const maxMembers = t.maxMembers || 5;

      let status = memberCount >= maxMembers ? 'Full' : 'Available';
      if (isUserMember) {
        status = 'Joined';
      }

      return {
        id: t._id || t.id,
        _id: t._id || t.id,
        name: t.name,
        description: t.description || '',
        courseId: t.courseId || course._id,
        courseCode: t.courseCode || course.code,
        teamLead: t.teamLead,
        teamLeadEmail: t.teamLeadEmail,
        memberCount,
        maxMembers,
        status,
        isUserMember,
        members,
        createdAt: t.createdAt
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve course teams: ' + err.message });
  }
});

// 12. GET /courses/:id/my-team - get authenticated student's current team in course
app.get('/courses/:id/my-team', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const userEmail = (req.user.email || '').toLowerCase();
    const filter = {
      $or: [
        { courseId: course._id },
        { courseCode: course.code }
      ]
    };

    const teams = await courseTeamsCollection.find(filter).toArray();
    const userTeam = teams.find(t => {
      const members = Array.isArray(t.members) ? t.members : [];
      return members.some(m => (m.email || '').toLowerCase() === userEmail) ||
             ((t.teamLeadEmail || '').toLowerCase() === userEmail);
    });

    if (!userTeam) {
      return res.json({ team: null });
    }

    const members = Array.isArray(userTeam.members) ? userTeam.members : [];
    const isLeader = ((userTeam.teamLeadEmail || '').toLowerCase() === userEmail) ||
                     members.some(m => (m.email || '').toLowerCase() === userEmail && m.isLeader);

    return res.json({
      team: {
        id: userTeam._id || userTeam.id,
        _id: userTeam._id || userTeam.id,
        name: userTeam.name,
        description: userTeam.description || '',
        courseId: userTeam.courseId || course._id,
        courseCode: userTeam.courseCode || course.code,
        teamLead: userTeam.teamLead,
        teamLeadEmail: userTeam.teamLeadEmail,
        isLeader,
        memberCount: members.length,
        maxMembers: userTeam.maxMembers || 5,
        status: 'Joined',
        isUserMember: true,
        members,
        createdAt: userTeam.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve your team: ' + err.message });
  }
});

// 13. POST /courses/:id/teams - create a new team for the course
app.post('/courses/:id/teams', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const userEmail = (req.user.email || '').toLowerCase();
    const userName = req.user.name || 'Student';

    // 1. Check if caller already belongs to a team in this course
    const filter = {
      $or: [
        { courseId: course._id },
        { courseCode: course.code }
      ]
    };
    const existingCourseTeams = await courseTeamsCollection.find(filter).toArray();
    const callerExistingTeam = existingCourseTeams.find(t => {
      const members = Array.isArray(t.members) ? t.members : [];
      return members.some(m => (m.email || '').toLowerCase() === userEmail) ||
             ((t.teamLeadEmail || '').toLowerCase() === userEmail);
    });

    if (callerExistingTeam) {
      return res.status(400).json({
        error: `You are already a member of team '${callerExistingTeam.name}' in this course. You cannot create another team.`
      });
    }

    // 2. Validate request body
    const { name, description, members } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required.' });
    }
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({ error: 'Team name must be between 2 and 80 characters.' });
    }

    // Uniqueness check for team name within this course (case-insensitive)
    const duplicateTeamName = existingCourseTeams.find(t =>
      (t.name || '').toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicateTeamName) {
      return res.status(400).json({ error: `A team named '${cleanName}' already exists in this course.` });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ error: 'Project description cannot exceed 500 characters.' });
    }

    const teamRules = course.teamRules || { minMembers: 4, maxMembers: 5, minFemaleMembers: 0 };
    const minMembers = Number(teamRules.minMembers) || 4;
    const maxMembers = Number(teamRules.maxMembers) || 5;
    const minFemaleMembers = Number(teamRules.minFemaleMembers) || 0;
    // Enforce the project team rules configured by the assigned faculty/coordinator.
    if (!Array.isArray(members) || members.length < minMembers || members.length > maxMembers) {
      return res.status(400).json({
        error: `Team size must be between ${minMembers} and ${maxMembers} members for this course.`
      });
    }

    // 4. Duplicate checks within submitted member list
    const seenRolls = new Set();
    const seenEmails = new Set();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m || !m.rollNumber || !m.email) {
        return res.status(400).json({
          error: `Member ${i + 1} is missing roll number or institutional email.`
        });
      }
      const r = String(m.rollNumber).trim();
      const e = String(m.email).trim().toLowerCase();
      if (!r || !e) {
        return res.status(400).json({
          error: `Member ${i + 1} has an empty roll number or email.`
        });
      }
      if (seenRolls.has(r)) {
        return res.status(400).json({
          error: `Duplicate roll number '${r}' in member list.`
        });
      }
      if (seenEmails.has(e)) {
        return res.status(400).json({
          error: `Duplicate email '${e}' in member list.`
        });
      }
      seenRolls.add(r);
      seenEmails.add(e);
    }

    // Verify calling student is part of the submitted team members
    const callerInMembers = members.some(m =>
      String(m.email).trim().toLowerCase() === userEmail
    );
    if (!callerInMembers) {
      return res.status(400).json({
        error: 'The team creator must be included as one of the team members.'
      });
    }

    // 5. Backend verification of member identities, batch eligibility, course eligibility, and cross-team duplicates
    const resolvedMembers = [];
    const courseBatch = course.batch; // e.g. '2026-2028'
    const enrolledEmails = (course.enrolledEmails || []).map(em => em.toLowerCase());

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const roll = String(m.rollNumber).trim();
      const email = String(m.email).trim().toLowerCase();

      // Look up student in usersCollection
      let userDoc = null;
      if (usersCollection) {
        userDoc = await usersCollection.findOne({ rollNumber: roll });
        if (!userDoc) {
          userDoc = await usersCollection.findOne({
            $or: [
              { rollNumber: roll },
              { rollNumber: roll.toUpperCase() },
              { rollNumber: roll.toLowerCase() }
            ]
          });
        }
      }

      if (!userDoc) {
        return res.status(400).json({
          error: `Student identity verification failed: No registered student found with roll number '${roll}'.`
        });
      }

      // Check email matches student record
      if ((userDoc.email || '').toLowerCase() !== email) {
        return res.status(400).json({
          error: `Validation failed: Roll number '${roll}' does not belong to email '${email}'. Both must belong to the same student.`
        });
      }

      // Check batch eligibility
      if (courseBatch && userDoc.batch && userDoc.batch !== courseBatch) {
        return res.status(400).json({
          error: `Batch mismatch: Student '${userDoc.name}' (${roll}) is in batch ${userDoc.batch}, but course requires batch ${courseBatch}.`
        });
      }

      // Check course eligibility / enrollment
      if (enrolledEmails.length > 0 && !enrolledEmails.includes(email)) {
        return res.status(400).json({
          error: `Eligibility failed: Student '${userDoc.name}' (${email}) is not enrolled in course ${course.code}.`
        });
      }

      // Check duplicate membership across other existing teams in this course
      const memberInOtherTeam = existingCourseTeams.find(t => {
        const tMembers = Array.isArray(t.members) ? t.members : [];
        return tMembers.some(tm => (tm.email || '').toLowerCase() === email || (tm.rollNumber && tm.rollNumber === roll)) ||
               ((t.teamLeadEmail || '').toLowerCase() === email);
      });
      if (memberInOtherTeam) {
        return res.status(400).json({
          error: `Duplicate membership: Student '${userDoc.name}' (${email}) already belongs to team '${memberInOtherTeam.name}' in this course.`
        });
      }

      const isLeader = email === userEmail;
      resolvedMembers.push({
        name: userDoc.name || (isLeader ? userName : 'Student Member'),
        email: userDoc.email,
        rollNumber: userDoc.rollNumber || roll,
        avatarUrl: userDoc.avatarUrl || '',
        isLeader
      });
    }

    if (minFemaleMembers > 0) {
      // Gender is read from the registered student profile and never copied into team roster data.
      const verifiedMembers = await usersCollection.find({ email: { $in: resolvedMembers.map(member => member.email) } }).toArray();
      const verifiedFemaleCount = verifiedMembers.filter(student => student.gender === 'Female').length;
      if (verifiedFemaleCount < minFemaleMembers) return res.status(400).json({ error: `This course requires at least ${minFemaleMembers} women member(s) in each team.` });
    }

    // 6. Save new team
    const newTeam = {
      _id: generateId(),
      courseId: course._id,
      courseCode: course.code,
      name: cleanName,
      description: (description || '').trim(),
      teamLead: userName,
      teamLeadEmail: userEmail,
      memberCount: resolvedMembers.length,
      maxMembers,
      status: resolvedMembers.length >= maxMembers ? 'Full' : 'Available',
      members: resolvedMembers,
      createdAt: new Date().toISOString()
    };

    await courseTeamsCollection.insertOne(newTeam);

    if (eventBus) {
      eventBus.publish('TeamCreated', {
        teamId: newTeam._id,
        courseCode: course.code,
        teamName: newTeam.name,
        creator: userEmail
      }).catch(e => console.warn('[ProjectService] EventBus error:', e.message));
    }

    res.status(201).json({
      success: true,
      message: `Team '${newTeam.name}' created successfully.`,
      team: {
        ...newTeam,
        id: newTeam._id,
        isUserMember: true,
        status: 'Joined',
        isLeader: true
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create team: ' + err.message });
  }
});

// 14. POST /courses/:id/teams/:teamId/join - join an available team
app.post('/courses/:id/teams/:teamId/join', authenticate, async (req, res) => {
  try {
    const { id, teamId } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const userEmail = (req.user.email || '').toLowerCase();
    const userName = req.user.name || 'Student';

    // 1. Check if user is already in a team in this course
    const filter = {
      $or: [
        { courseId: course._id },
        { courseCode: course.code }
      ]
    };
    const courseTeams = await courseTeamsCollection.find(filter).toArray();
    const existingTeam = courseTeams.find(t => {
      const members = Array.isArray(t.members) ? t.members : [];
      return members.some(m => (m.email || '').toLowerCase() === userEmail) ||
             ((t.teamLeadEmail || '').toLowerCase() === userEmail);
    });

    if (existingTeam) {
      return res.status(400).json({
        error: `You are already a member of team '${existingTeam.name}' in this course. You cannot join multiple teams.`
      });
    }

    // 2. Find target team
    let targetTeam = await courseTeamsCollection.findOne({ _id: teamId });
    if (!targetTeam) {
      targetTeam = await courseTeamsCollection.findOne({ id: teamId });
    }
    if (!targetTeam) {
      return res.status(404).json({ error: `Team '${teamId}' not found.` });
    }

    // Verify target team belongs to this course
    if (targetTeam.courseId !== course._id && targetTeam.courseCode !== course.code) {
      return res.status(400).json({ error: `Team '${targetTeam.name}' does not belong to course ${course.code}.` });
    }

    const members = Array.isArray(targetTeam.members) ? [...targetTeam.members] : [];
    const maxMembers = targetTeam.maxMembers || 5;

    // Check if team is full
    if (members.length >= maxMembers) {
      return res.status(400).json({ error: `Team '${targetTeam.name}' is already full (${members.length}/${maxMembers} members).` });
    }

    // 3. Retrieve user's roll number and batch from usersCollection
    let rollNumber = '';
    if (usersCollection) {
      const userDoc = await usersCollection.findOne({ email: userEmail });
      if (userDoc) {
        rollNumber = userDoc.rollNumber || '';
        if (course.batch && userDoc.batch && userDoc.batch !== course.batch) {
          return res.status(400).json({
            error: `Batch mismatch: You belong to batch '${userDoc.batch}', but this course requires batch '${course.batch}'.`
          });
        }
      }
    }

    // Add member
    members.push({
      name: userName,
      email: req.user.email,
      rollNumber: rollNumber || '20251651000',
      isLeader: false
    });

    const newMemberCount = members.length;
    const newStatus = newMemberCount >= maxMembers ? 'Full' : 'Available';

    await courseTeamsCollection.updateOne(
      { _id: targetTeam._id },
      {
        $set: {
          members,
          memberCount: newMemberCount,
          status: newStatus
        }
      }
    );

    const updated = await courseTeamsCollection.findOne({ _id: targetTeam._id });
    res.json({
      success: true,
      message: `Successfully joined ${targetTeam.name}!`,
      team: {
        ...updated,
        id: updated._id,
        isUserMember: true,
        status: 'Joined'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join team: ' + err.message });
  }
});

// 15. POST /courses/:id/teams/:teamId/leave - leave team
app.post('/courses/:id/teams/:teamId/leave', authenticate, async (req, res) => {
  try {
    const { id, teamId } = req.params;
    let course;
    try {
      course = await getAuthorizedCourse(id, req.user);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ error: authErr.message });
    }
    if (!course) {
      return res.status(404).json({ error: `Course '${id}' not found` });
    }

    const userEmail = (req.user.email || '').toLowerCase();

    let team = await courseTeamsCollection.findOne({ _id: teamId });
    if (!team) {
      team = await courseTeamsCollection.findOne({ id: teamId });
    }
    if (!team) {
      return res.status(404).json({ error: `Team '${teamId}' not found.` });
    }

    let members = Array.isArray(team.members) ? [...team.members] : [];
    const isMember = members.some(m => (m.email || '').toLowerCase() === userEmail);
    if (!isMember) {
      return res.status(400).json({ error: 'You are not a member of this team.' });
    }

    // Remove member
    members = members.filter(m => (m.email || '').toLowerCase() !== userEmail);

    if (members.length === 0) {
      // Disband team if no members left
      await courseTeamsCollection.deleteOne({ _id: team._id });
      return res.json({ success: true, message: `Team '${team.name}' has been disbanded as all members left.` });
    }

    let teamLead = team.teamLead;
    let teamLeadEmail = team.teamLeadEmail;
    if ((teamLeadEmail || '').toLowerCase() === userEmail) {
      // Reassign lead to next member
      members[0].isLeader = true;
      teamLead = members[0].name;
      teamLeadEmail = members[0].email;
    }

    const newStatus = members.length >= (team.maxMembers || 5) ? 'Full' : 'Available';

    await courseTeamsCollection.updateOne(
      { _id: team._id },
      {
        $set: {
          members,
          memberCount: members.length,
          teamLead,
          teamLeadEmail,
          status: newStatus
        }
      }
    );

    res.json({ success: true, message: `You have successfully left '${team.name}'.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave team: ' + err.message });
  }
});

async function startServer() {
  db = await createDatabase('project-service', 'project_db');
  projectsCollection = db.collection('projects');
  teamMembersCollection = db.collection('teamMembers');
  requirementsCollection = db.collection('requirements');
  criteriaCollection = db.collection('criteria');
  projectMilestonesCollection = db.collection('projectMilestones');
  documentsCollection = db.collection('documents');
  coursesCollection = db.collection('courses');
  announcementsCollection = db.collection('announcements');
  courseTeamsCollection = db.collection('courseTeams');

  const authDb = await createDatabase('project-service-auth', 'auth_db');
  usersCollection = authDb.collection('users');
  branchesCollection = authDb.collection('branches');
  batchesCollection = authDb.collection('batches');
  sessionsCollection = authDb.collection('academic_sessions');
  facultyAssignmentsCollection = db.collection('faculty_assignments');

  await seedCriteriaIfEmpty();
  await seedCoursesIfEmpty();
  await seedAnnouncementsIfEmpty();
  await seedCourseTeamsIfEmpty();

  eventBus = await createEventBus('project-service');

  // Listen for SyncCompleted events from Integration Service to automatically trigger milestone re-evaluation
  await eventBus.subscribe('SyncCompleted', async (event) => {
    if (event.payload?.projectId) {
      console.log(`[ProjectService] Received SyncCompleted event for project ${event.payload.projectId}. Re-evaluating milestones...`);
      await evaluateMilestonesForProject(event.payload.projectId);
    }
  });

  app.listen(PORT, () => {
    console.log(`[ProjectService] Running on port ${PORT} with database 'project_db'`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Project Service:', err);
});
