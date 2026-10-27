const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { createDatabase } = require('../../shared/db');
const { createEventBus } = require('../../shared/eventBus');
const {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticate,
  authorizeRoles
} = require('../../shared/authMiddleware');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.AUTH_PORT || 5001;

let db;
let usersCollection;
let institutionsCollection;
let branchesCollection;
let batchesCollection;
let sessionsCollection;
let membershipsCollection;
let eventBus;

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  role: user.role,
  department: user.department,
  institutionId: user.institutionId || null,
  designation: user.designation || null,
  bio: user.bio || null
});

async function requireCoordinator(req, res, next) {
  try {
    const user = await usersCollection.findOne({ _id: req.user?.id });
    const coordinatorAccess = user && (user.role === 'Coordinator' || (user.roles || []).includes('Coordinator'));
    if (!user || (!coordinatorAccess && user.role !== 'Admin') || user.status === 'suspended') {
      return res.status(403).json({ error: 'Coordinator access is required' });
    }
    req.user.role = user.role;
    req.user.roles = user.roles || [user.role];
    req.user.institutionId = user.institutionId || null;
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
}

function coordinatorInstitutionFilter(req) {
  if (req.user.role === 'Admin') return {};
  return { institutionId: req.user.institutionId };
}

const MAX_INLINE_MEDIA_BYTES = 6 * 1024 * 1024;
function mediaByteLength(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return 0;
  const comma = value.indexOf(',');
  if (comma < 0 || !value.slice(0, comma).endsWith(';base64')) return Infinity;
  const payload = value.slice(comma + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor(payload.length * 3 / 4) - padding;
}

function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(String(value)).protocol); }
  catch { return false; }
}

function validateInstitutionMedia(input) {
  const gallery = Array.isArray(input.gallery) ? input.gallery : [];
  if (gallery.length > 12) return 'Gallery can contain at most 12 images';
  const imageValues = [input.logoUrl, input.coverUrl, ...gallery.map(item => typeof item === 'string' ? item : item?.url)].filter(Boolean);
  let embeddedBytes = 0;
  for (const value of imageValues) {
    if (String(value).startsWith('data:')) {
      if (!/^data:image\/(png|jpeg|webp);base64,/i.test(value)) return 'Uploaded images must be PNG, JPEG, or WebP';
      const bytes = mediaByteLength(value);
      if (bytes > 2 * 1024 * 1024) return 'Each uploaded image must be 2 MB or smaller';
      embeddedBytes += bytes;
    } else if (!isHttpUrl(value)) return 'Image links must be valid http or https URLs';
  }
  if (input.videoUrl) {
    if (String(input.videoUrl).startsWith('data:')) {
      if (!/^data:video\/(mp4|webm);base64,/i.test(input.videoUrl)) return 'Uploaded videos must be MP4 or WebM';
      const bytes = mediaByteLength(input.videoUrl);
      if (bytes > 4 * 1024 * 1024) return 'The short video must be 4 MB or smaller';
      embeddedBytes += bytes;
    } else if (!isHttpUrl(input.videoUrl)) return 'Video links must be valid http or https URLs';
  }
  if (embeddedBytes > MAX_INLINE_MEDIA_BYTES) return 'Total uploaded media must be 6 MB or smaller';
  return null;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'auth-service', status: 'healthy', dbType: db.type });
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Admin accounts remain managed by the admin path; users can self-register into these three roles.
    const assignedRole = role || 'Student';
    if (!['Coordinator', 'Faculty', 'Student'].includes(assignedRole)) {
      return res.status(400).json({ error: 'Choose Coordinator, Faculty, or Student as your role' });
    }

    const institutionInput = req.body.institution || {};
    let normalizedCity = '';
    if (assignedRole === 'Coordinator') {
      const institutionName = String(institutionInput.name || '').trim();
      const institutionType = String(institutionInput.type || '').trim().toLowerCase();
      if (!institutionName || !['college', 'university', 'school'].includes(institutionType)) {
        return res.status(400).json({ error: 'Coordinator registration requires an institution name and type' });
      }
      normalizedCity = String(institutionInput.city || '').trim().toLowerCase();
      const sameName = await institutionsCollection.find({ normalizedName: institutionName.toLowerCase() }).toArray();
      if (sameName.some(item => (item.normalizedCity || String(item.city || '').trim().toLowerCase()) === normalizedCity)) {
        return res.status(409).json({ error: 'This institution already exists. Use the institution directory or contact its current coordinator.' });
      }
      if (institutionInput.website && !isHttpUrl(institutionInput.website)) return res.status(400).json({ error: 'Website must be a valid http or https URL' });
      const mediaError = validateInstitutionMedia(institutionInput);
      if (mediaError) return res.status(400).json({ error: mediaError });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
      roles: [assignedRole],
      institutionId: null,
      status: 'active',
      department: req.body.department || 'Computer Science & Engineering',
      createdAt: new Date().toISOString()
    };

    const result = await usersCollection.insertOne(newUser);
    let institution = null;
    if (assignedRole === 'Coordinator') {
      institution = {
        _id: crypto.randomUUID(),
        name: String(institutionInput.name).trim(),
        normalizedName: String(institutionInput.name).trim().toLowerCase(),
        type: String(institutionInput.type).trim().toLowerCase(),
        city: String(institutionInput.city || '').trim(),
        normalizedCity,
        state: String(institutionInput.state || '').trim(),
        country: String(institutionInput.country || '').trim(),
        address: String(institutionInput.address || '').trim(),
        website: String(institutionInput.website || '').trim(),
        description: String(institutionInput.description || '').trim(),
        logoUrl: String(institutionInput.logoUrl || '').trim(),
        coverUrl: String(institutionInput.coverUrl || '').trim(),
        videoUrl: String(institutionInput.videoUrl || '').trim(),
        gallery: Array.isArray(institutionInput.gallery) ? institutionInput.gallery.slice(0, 12) : [],
        status: 'active',
        createdBy: result.insertedId,
        createdAt: new Date().toISOString()
      };
      try {
        await institutionsCollection.insertOne(institution);
        await usersCollection.updateOne({ _id: result.insertedId }, { $set: { institutionId: institution._id } });
        newUser.institutionId = institution._id;
      } catch (err) {
        await usersCollection.deleteOne({ _id: result.insertedId });
        throw err;
      }
    }

    const token = generateToken({
      id: result.insertedId,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      roles: newUser.roles,
      institutionId: newUser.institutionId
    });
    const refreshToken = generateRefreshToken({ id: result.insertedId });

    await eventBus.publish('UserRegistered', {
      userId: result.insertedId,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      refreshToken,
      user: {
        id: result.insertedId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        roles: newUser.roles,
        institutionId: newUser.institutionId,
        department: newUser.department
      },
      institution: institution ? { id: institution._id, name: institution.name, type: institution.type } : null
    });
  } catch (err) {
    console.error('[AuthService] Register error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact Admin.' });
    }

    const token = generateToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: user.roles || [user.role],
      institutionId: user.institutionId || null
    });
    const refreshToken = generateRefreshToken({ id: user._id });

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles || [user.role],
        institutionId: user.institutionId || null,
        department: user.department || 'Computer Science'
      }
    });
  } catch (err) {
    console.error('[AuthService] Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Refresh Token
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await usersCollection.findOne({ _id: decoded.id });
    if (!user) {
      return res.status(404).json({ error: 'User no longer exists' });
    }

    const newToken = generateToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: user.roles || [user.role],
      institutionId: user.institutionId || null
    });

    res.json({ token: newToken });
  } catch (err) {
    res.status(500).json({ error: 'Refresh failed: ' + err.message });
  }
});

// Current User Profile
app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const user = await usersCollection.findOne({ _id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: user.roles || [user.role],
      institutionId: user.institutionId || null,
      designation: user.designation || null,
      bio: user.bio || null,
      department: user.department,
      status: user.status,
      createdAt: user.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public institution discovery and profile data. Private account fields are never returned.
app.get('/institutions', async (req, res) => {
  try {
    const query = String(req.query.search || '').trim();
    const filter = { status: 'active' };
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['name', 'type', 'city', 'state', 'country'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } }));
      delete filter.name;
    }
    const institutions = await institutionsCollection.find(filter).sort({ normalizedName: 1, name: 1 }).limit(50).toArray();
    res.json(institutions.map(({ _id, name, type, city, state, country, logoUrl, coverUrl, description }) => ({
      id: _id, name, type, city, state, country,
      logoUrl: String(logoUrl || '').startsWith('data:') ? '' : logoUrl,
      coverUrl: String(coverUrl || '').startsWith('data:') ? '' : coverUrl,
      description
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/institutions/:id', async (req, res) => {
  try {
    const institution = await institutionsCollection.findOne({ _id: req.params.id, status: 'active' });
    if (!institution) return res.status(404).json({ error: 'Institution not found' });
    const [branches, coordinators] = await Promise.all([
      branchesCollection.find({ institutionId: institution._id, status: 'active' }).toArray(),
      usersCollection.find({ institutionId: institution._id, status: 'active' }).toArray()
    ]);
    const { _id, createdBy, ...profile } = institution;
    const coordinatorProfiles = coordinators.filter(person => person.role === 'Coordinator' || (person.roles || []).includes('Coordinator'));
    res.json({ ...profile, id: _id, branches: branches.map(({ _id: id, name, code, programs }) => ({ id, name, code, programs: programs || [] })), coordinatorCount: coordinatorProfiles.length, coordinators: coordinatorProfiles.map(publicUser) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/institutions/:id/membership', authenticate, async (req, res) => {
  try {
    const membership = await membershipsCollection.findOne({ institutionId: req.params.id, userId: String(req.user.id) });
    res.json({ status: membership?.status || 'none' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/institutions/:id/membership', authenticate, async (req, res) => {
  try {
    if (!['Faculty', 'Student'].includes(req.user.role)) return res.status(403).json({ error: 'Only faculty or student accounts can request institution membership' });
    const institution = await institutionsCollection.findOne({ _id: req.params.id, status: 'active' });
    if (!institution) return res.status(404).json({ error: 'Institution not found' });
    const branchId = String(req.body.branchId || '');
    const branch = await branchesCollection.findOne({ _id: branchId, institutionId: institution._id, status: 'active' });
    if (!branch) return res.status(400).json({ error: 'Choose an active branch in this institution' });
    const userId = String(req.user.id);
    const existing = await membershipsCollection.findOne({ userId, institutionId: req.params.id });
    if (existing && existing.status !== 'rejected') return res.status(200).json({ status: existing.status, message: 'Membership request already exists' });
    const current = await usersCollection.findOne({ _id: req.user.id });
    if (!current || current.institutionId) return res.status(409).json({ error: 'This account is already associated with an institution' });
    if (existing?.status === 'rejected') {
      await membershipsCollection.updateOne({ _id: existing._id }, { $set: { branchId, branchName: branch.name, role: req.user.role, status: 'pending', requestedAt: new Date().toISOString(), reviewedBy: null, reviewedAt: null } });
      return res.status(200).json({ status: 'pending', message: 'Your updated branch request has been sent to the coordinator' });
    }
    const membership = { _id: crypto.randomUUID(), institutionId: req.params.id, branchId, branchName: branch.name, userId, role: req.user.role, status: 'pending', requestedAt: new Date().toISOString() };
    await membershipsCollection.insertOne(membership);
    res.status(201).json({ status: membership.status, message: 'Membership request sent to institution coordinators' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/institutions', authenticate, requireCoordinator, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const type = String(req.body.type || '').trim().toLowerCase();
    if (!name || !['college', 'university', 'school'].includes(type)) return res.status(400).json({ error: 'Institution name and a valid type are required' });
    if (req.user.role === 'Coordinator' && req.user.institutionId) return res.status(409).json({ error: 'This coordinator is already associated with an institution' });
    const normalizedCity = String(req.body.city || '').trim().toLowerCase();
    const sameName = await institutionsCollection.find({ normalizedName: name.toLowerCase() }).toArray();
    if (sameName.some(item => (item.normalizedCity || String(item.city || '').trim().toLowerCase()) === normalizedCity)) return res.status(409).json({ error: 'An institution with this name and city already exists' });
    const gallery = Array.isArray(req.body.gallery) ? req.body.gallery.slice(0, 12) : [];
    const mediaError = validateInstitutionMedia({ ...req.body, gallery });
    if (mediaError) return res.status(400).json({ error: mediaError });
    const doc = { _id: crypto.randomUUID(), name, normalizedName: name.toLowerCase(), type, city: String(req.body.city || '').trim(), normalizedCity, state: String(req.body.state || '').trim(), country: String(req.body.country || '').trim(), address: String(req.body.address || '').trim(), website: String(req.body.website || '').trim(), description: String(req.body.description || '').trim(), logoUrl: String(req.body.logoUrl || '').trim(), coverUrl: String(req.body.coverUrl || '').trim(), videoUrl: String(req.body.videoUrl || '').trim(), gallery, status: 'active', createdBy: req.user.id, createdAt: new Date().toISOString() };
    if (doc.website && !/^https?:\/\//i.test(doc.website)) return res.status(400).json({ error: 'Website must be a valid http or https URL' });
    const result = await institutionsCollection.insertOne(doc);
    if (req.user.role === 'Coordinator' && !req.user.institutionId) {
      await usersCollection.updateOne({ _id: req.user.id }, { $set: { institutionId: result.insertedId } });
      req.user.institutionId = result.insertedId;
    }
    res.status(201).json({ ...doc, id: result.insertedId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/coordinator/overview', authenticate, requireCoordinator, async (req, res) => {
  try {
    const scope = coordinatorInstitutionFilter(req);
    const [institutions, branches, batches, sessions, faculty, coordinators] = await Promise.all([
      institutionsCollection.find(scope).toArray(), branchesCollection.find(scope).toArray(), batchesCollection.find(scope).toArray(),
      sessionsCollection.find(scope).toArray(), usersCollection.find({ ...scope, role: 'Faculty' }).toArray(),
      usersCollection.find(scope).toArray()
    ]);
    const coordinatorProfiles = coordinators.filter(person => person.role === 'Coordinator' || (person.roles || []).includes('Coordinator'));
    res.json({ institution: institutions[0] || null, stats: { branches: branches.length, batches: batches.length, sessions: sessions.length, faculty: faculty.length, coordinators: coordinatorProfiles.length }, branches, batches: batches.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,6), faculty: faculty.map(publicUser), coordinators: coordinatorProfiles.map(publicUser) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/coordinator/institutions/:id', authenticate, requireCoordinator, async (req, res) => {
  try {
    const institutionId = String(req.params.id);
    if (req.user.role !== 'Admin' && institutionId !== String(req.user.institutionId)) return res.status(403).json({ error: 'Institution access denied' });
    const institution = await institutionsCollection.findOne({ _id: institutionId });
    if (!institution) return res.status(404).json({ error: 'Institution not found' });
    const allowed = ['name', 'type', 'city', 'state', 'country', 'address', 'website', 'description', 'logoUrl', 'coverUrl', 'videoUrl'];
    const update = {};
    for (const field of allowed) if (req.body[field] !== undefined) update[field] = String(req.body[field]).trim();
    if (update.name !== undefined && !update.name) return res.status(400).json({ error: 'Institution name cannot be empty' });
    if (update.type !== undefined && !['college', 'university', 'school'].includes(update.type.toLowerCase())) return res.status(400).json({ error: 'Institution type is invalid' });
    if (update.type !== undefined) update.type = update.type.toLowerCase();
    if (update.name !== undefined) update.normalizedName = update.name.toLowerCase();
    if (update.city !== undefined) update.normalizedCity = update.city.toLowerCase();
    const nextName = update.normalizedName || institution.normalizedName;
    const nextCity = update.normalizedCity !== undefined ? update.normalizedCity : (institution.normalizedCity || String(institution.city || '').trim().toLowerCase());
    if (nextName !== institution.normalizedName || nextCity !== (institution.normalizedCity || String(institution.city || '').trim().toLowerCase())) {
      const sameName = await institutionsCollection.find({ normalizedName: nextName }).toArray();
      if (sameName.some(item => String(item._id) !== institutionId && (item.normalizedCity || String(item.city || '').trim().toLowerCase()) === nextCity)) return res.status(409).json({ error: 'An institution with this name and city already exists' });
    }
    if (update.website && !/^https?:\/\//i.test(update.website)) return res.status(400).json({ error: 'Website must be a valid http or https URL' });
    if (req.body.gallery !== undefined) {
      if (!Array.isArray(req.body.gallery)) return res.status(400).json({ error: 'Gallery must be an array of image links or uploads' });
      update.gallery = req.body.gallery;
    }
    const mediaError = validateInstitutionMedia({
      logoUrl: update.logoUrl !== undefined ? update.logoUrl : institution.logoUrl,
      coverUrl: update.coverUrl !== undefined ? update.coverUrl : institution.coverUrl,
      videoUrl: update.videoUrl !== undefined ? update.videoUrl : institution.videoUrl,
      gallery: update.gallery !== undefined ? update.gallery : institution.gallery
    });
    if (mediaError) return res.status(400).json({ error: mediaError });
    await institutionsCollection.updateOne({ _id: institutionId }, { $set: update });
    res.json({ ...institution, ...update, id: institutionId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/coordinator/branches', authenticate, requireCoordinator, async (req, res) => {
  try { res.json(await branchesCollection.find(coordinatorInstitutionFilter(req)).sort({ name: 1 }).toArray()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/coordinator/memberships', authenticate, requireCoordinator, async (req, res) => {
  try {
    const scope = coordinatorInstitutionFilter(req);
    const requests = await membershipsCollection.find({ ...scope, status: 'pending' }).sort({ requestedAt: -1 }).toArray();
    const users = await Promise.all(requests.map(request => usersCollection.findOne({ _id: request.userId })));
    res.json(requests.map((request, index) => ({ id: request._id, status: request.status, role: request.role || users[index]?.role || 'Faculty', branchId: request.branchId, branchName: request.branchName, requestedAt: request.requestedAt, member: users[index] ? publicUser(users[index]) : null })).filter(request => request.member));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/coordinator/memberships/:id', authenticate, requireCoordinator, async (req, res) => {
  try {
    const status = String(req.body.status || '');
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });
    const membership = await membershipsCollection.findOne({ _id: req.params.id, ...coordinatorInstitutionFilter(req), status: 'pending' });
    if (!membership) return res.status(404).json({ error: 'Pending membership request not found in your institution' });
    if (status === 'approved' && !membership.branchId) return res.status(400).json({ error: 'This older request has no branch selected. Decline it so the member can submit a new branch request.' });
    await membershipsCollection.updateOne({ _id: membership._id }, { $set: { status, reviewedBy: String(req.user.id), reviewedAt: new Date().toISOString() } });
    if (status === 'approved') await usersCollection.updateOne({ _id: membership.userId }, { $set: { institutionId: membership.institutionId, branchId: membership.branchId, institutionMembershipStatus: 'active' } });
    res.json({ id: membership._id, status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/coordinator/branches', authenticate, requireCoordinator, async (req, res) => {
  try {
    const institutionId = req.user.role === 'Admin' ? String(req.body.institutionId || '') : String(req.user.institutionId || '');
    const name = String(req.body.name || '').trim();
    if (!institutionId || !name) return res.status(400).json({ error: 'Institution and branch name are required' });
    if (req.user.role !== 'Admin' && institutionId !== String(req.user.institutionId)) return res.status(403).json({ error: 'Institution access denied' });
    const institution = await institutionsCollection.findOne({ _id: institutionId });
    if (!institution) return res.status(404).json({ error: 'Institution not found' });
    if (await branchesCollection.findOne({ institutionId, normalizedName: name.toLowerCase() })) return res.status(409).json({ error: 'This branch already exists' });
    const doc = { _id: crypto.randomUUID(), institutionId, name, normalizedName: name.toLowerCase(), code: String(req.body.code || '').trim(), programs: Array.isArray(req.body.programs) ? req.body.programs.map(String).map(x => x.trim()).filter(Boolean) : [], status: 'active', createdBy: req.user.id, createdAt: new Date().toISOString() };
    const result = await branchesCollection.insertOne(doc);
    res.status(201).json({ ...doc, id: result.insertedId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/coordinator/sessions', authenticate, requireCoordinator, async (req, res) => {
  try { res.json(await sessionsCollection.find(coordinatorInstitutionFilter(req)).sort({ startYear: -1 }).toArray()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/coordinator/sessions', authenticate, requireCoordinator, async (req, res) => {
  try {
    const institutionId = req.user.role === 'Admin' ? String(req.body.institutionId || '') : String(req.user.institutionId || '');
    const name = String(req.body.name || '').trim();
    if (!institutionId || !name) return res.status(400).json({ error: 'Institution and session name are required' });
    const institution = await institutionsCollection.findOne({ _id: institutionId });
    if (!institution || (req.user.role !== 'Admin' && institutionId !== String(req.user.institutionId))) return res.status(403).json({ error: 'Institution access denied' });
    if (await sessionsCollection.findOne({ institutionId, name })) return res.status(409).json({ error: 'This academic session already exists' });
    const doc = { _id: crypto.randomUUID(), institutionId, name, startYear: Number(req.body.startYear) || null, endYear: Number(req.body.endYear) || null, status: 'active', createdBy: req.user.id, createdAt: new Date().toISOString() };
    const result = await sessionsCollection.insertOne(doc);
    res.status(201).json({ ...doc, id: result.insertedId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/coordinator/batches', authenticate, requireCoordinator, async (req, res) => {
  try { res.json(await batchesCollection.find(coordinatorInstitutionFilter(req)).sort({ createdAt: -1 }).toArray()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/coordinator/batches', authenticate, requireCoordinator, async (req, res) => {
  try {
    const institutionId = req.user.role === 'Admin' ? String(req.body.institutionId || '') : String(req.user.institutionId || '');
    const { name, branchId, sessionId } = req.body;
    if (!institutionId || !String(name || '').trim() || !branchId || !sessionId) return res.status(400).json({ error: 'Batch name, branch, and academic session are required' });
    if (req.user.role !== 'Admin' && institutionId !== String(req.user.institutionId)) return res.status(403).json({ error: 'Institution access denied' });
    const [branch, session] = await Promise.all([branchesCollection.findOne({ _id: String(branchId), institutionId }), sessionsCollection.findOne({ _id: String(sessionId), institutionId })]);
    if (!branch || !session) return res.status(400).json({ error: 'Branch and academic session must belong to this institution' });
    const normalizedName = String(name).trim().toLowerCase();
    if (await batchesCollection.findOne({ institutionId, normalizedName, sessionId: String(sessionId) })) return res.status(409).json({ error: 'This batch already exists for the selected session' });
    const doc = { _id: crypto.randomUUID(), institutionId, name: String(name).trim(), normalizedName, branchId: String(branchId), branchName: branch.name, sessionId: String(sessionId), sessionName: session.name, cohortYear: Number(req.body.cohortYear) || null, description: String(req.body.description || '').trim(), status: 'active', createdBy: req.user.id, createdAt: new Date().toISOString() };
    const result = await batchesCollection.insertOne(doc);
    res.status(201).json({ ...doc, id: result.insertedId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get Faculty List (for faculty assignment dropdowns)
app.get('/auth/faculty', authenticate, async (req, res) => {
  try {
    const facultyMembers = await usersCollection.find({ role: 'Faculty' }).toArray();
    res.json(facultyMembers.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      department: u.department || 'Computer Science',
      status: u.status
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Students List
app.get('/auth/students', authenticate, async (req, res) => {
  try {
    const students = await usersCollection.find({ role: 'Student' }).toArray();
    res.json(students.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      department: u.department,
      status: u.status
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin User Directory
app.get('/auth/users', authenticate, authorizeRoles('Admin', 'Faculty'), async (req, res) => {
  try {
    const users = await usersCollection.find({}).toArray();
    res.json(users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department || 'Computer Science',
      status: u.status || 'active',
      createdAt: u.createdAt
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Create User (can create Admins, Faculty, Students)
app.post('/auth/users', authenticate, authorizeRoles('Admin'), async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await usersCollection.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userDoc = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      roles: [role],
      institutionId: req.body.institutionId || null,
      designation: req.body.designation || null,
      department: department || 'Computer Science & Engineering',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const result = await usersCollection.insertOne(userDoc);
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertedId,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
        roles: userDoc.roles,
        department: userDoc.department
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Update User Status / Details
app.put('/auth/users/:id', authenticate, authorizeRoles('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role, department, name } = req.body;
    const updateFields = {};
    if (status) updateFields.status = status;
    if (role) { updateFields.role = role; updateFields.roles = [role]; }
    if (department) updateFields.department = department;
    if (name) updateFields.name = name;

    await usersCollection.updateOne({ _id: id }, { $set: updateFields });
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  db = await createDatabase('auth-service', 'auth_db');
  usersCollection = db.collection('users');
  institutionsCollection = db.collection('institutions');
  branchesCollection = db.collection('branches');
  batchesCollection = db.collection('batches');
  sessionsCollection = db.collection('academic_sessions');
  membershipsCollection = db.collection('institution_memberships');
  eventBus = await createEventBus('auth-service');

  app.listen(PORT, () => {
    console.log(`[AuthService] Running on port ${PORT} with database 'auth_db'`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Auth Service:', err);
});
