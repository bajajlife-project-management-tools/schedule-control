/**
 * Schedule Control & Project Governance — Express Server
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

import { getDb, closeDb } from './db/database.js';
import { migrate } from './db/migrations/001_initial.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import raidRoutes from './routes/raid.js';
import changeControlRoutes from './routes/changeControl.js';
import snapshotRoutes from './routes/snapshots.js';
import auditRoutes from './routes/audit.js';
import importRoutes from './routes/importExport.js';
import calendarRoutes from './routes/calendar.js';
import authRoutes from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/raid', raidRoutes);
app.use('/api/change-requests', changeControlRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/import', importRoutes);
app.use('/api/calendar', calendarRoutes);

// Serve static frontend in production
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize database and start server
async function start() {
  try {
    await getDb();
    migrate();
    console.log('✅ Database initialized');

    // Auto-seed demo data if empty database
    const { queryOne } = await import('./db/database.js');
    const existing = queryOne('SELECT COUNT(*) as count FROM projects');
    if (!existing || existing.count === 0) {
      console.log('🌱 No projects found. Auto-seeding Enterprise AI Platform demo data...');
      const { seed } = await import('./db/seeds/demoData.js');
      await seed();
    }

    app.listen(PORT, () => {
      console.log(`🚀 Schedule Control server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

start();

export default app;
