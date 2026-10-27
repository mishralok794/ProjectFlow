const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { verifyToken } = require('../shared/authMiddleware');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.GATEWAY_PORT || 5000;

const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
  project: process.env.PROJECT_SERVICE_URL || 'http://localhost:5002',
  task: process.env.TASK_SERVICE_URL || 'http://localhost:5003',
  evaluation: process.env.EVALUATION_SERVICE_URL || 'http://localhost:5004',
  integration: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:5005',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5006'
};

// Gateway Health & Services status
app.get('/health', async (req, res) => {
  const serviceStatuses = {};
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const resp = await axios.get(`${url}/health`, { timeout: 1500 });
      serviceStatuses[name] = resp.data.status;
    } catch (err) {
      serviceStatuses[name] = 'offline';
    }
  }
  res.json({
    gateway: 'healthy',
    timestamp: new Date().toISOString(),
    services: serviceStatuses
  });
});

// Authentication extraction middleware at Gateway level
function gatewayAuth(req, res, next) {
  // Allow public auth endpoints, webhook receiver, and health check
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/github/webhook', '/health'];
  if (publicPaths.some(p => req.path.startsWith(p)) || (req.method === 'GET' && req.path.startsWith('/api/institutions'))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Gateway: Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Gateway: Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

app.use(gatewayAuth);

// Helper function to proxy requests to target microservice
async function proxyRequest(targetUrl, req, res) {
  try {
    const headers = {
      'content-type': req.headers['content-type'] || 'application/json'
    };

    if (req.user) {
      headers['x-user-id'] = req.user.id || req.user._id || '';
      headers['x-user-role'] = req.user.role || '';
      headers['x-user-email'] = req.user.email || '';
      headers['x-user-name'] = encodeURIComponent(req.user.name || '');
    }

    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization;
    }

    const isAttachment = req.url.includes('/attachments/');
    const response = await axios({
      method: req.method,
      url: targetUrl.split('?')[0],
      params: req.query,
      data: req.body,
      headers,
      responseType: isAttachment ? 'arraybuffer' : 'json',
      validateStatus: () => true // Allow handling downstream status codes
    });

    if (response.headers['content-type']) {
      res.setHeader('content-type', response.headers['content-type']);
    }
    if (response.headers['content-disposition']) {
      res.setHeader('content-disposition', response.headers['content-disposition']);
    }

    if (isAttachment) {
      if (response.status >= 400) {
        try {
          const errorObj = JSON.parse(Buffer.from(response.data).toString('utf-8'));
          return res.status(response.status).json(errorObj);
        } catch (e) {
          return res.status(response.status).send(response.data);
        }
      }
      return res.status(response.status).send(Buffer.from(response.data));
    }

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error(`[Gateway Proxy Error] Target: ${targetUrl}:`, err.message);
    res.status(502).json({
      error: 'Bad Gateway: Microservice request failed',
      details: err.message
    });
  }
}

// 1. Auth Service Routes
app.all('/api/auth/*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.auth}${subPath}`, req, res);
});

app.all('/api/institutions*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.auth}${subPath}`, req, res);
});

app.all('/api/coordinator/courses*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.project}${subPath}`, req, res);
});

app.all('/api/coordinator/assignments*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.project}${subPath}`, req, res);
});

app.all('/api/faculty*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.project}${subPath}`, req, res);
});

app.all('/api/coordinator*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.auth}${subPath}`, req, res);
});

// 2. Project Service Routes (/api/projects/*, /api/criteria/*)
app.all('/api/projects*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.project}${subPath}`, req, res);
});

app.all('/api/criteria*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.project}${subPath}`, req, res);
});

app.all('/api/courses*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.project}${subPath}`, req, res);
});

// 3. Task Service Routes (/api/tasks/*)
app.all('/api/tasks*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.task}${subPath}`, req, res);
});

// 4. Evaluation Service Routes (/api/evaluations/*)
app.all('/api/evaluations*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.evaluation}${subPath}`, req, res);
});

// 5. Integration Service Routes (/api/github/*)
app.all('/api/github*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.integration}${subPath}`, req, res);
});

// 6. Notification Service Routes (/api/notifications/*)
app.all('/api/notifications*', (req, res) => {
  const subPath = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.notification}${subPath}`, req, res);
});

app.listen(PORT, () => {
  console.log(`[API Gateway] Active on port ${PORT}. Routing to 6 microservices.`);
});
