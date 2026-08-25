import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, queryAll, queryOne, execute } from '../db/database.js';
import bcrypt from 'bcryptjs';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    await getDb();
    const { username, password } = req.body;
    const user = queryOne('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Simple token (in production, use JWT)
    const token = uuid();
    res.json({
      token,
      user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users
router.get('/users', async (req, res) => {
  try {
    await getDb();
    const users = queryAll('SELECT id, username, display_name, email, role, active FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users — Create user
router.post('/users', async (req, res) => {
  try {
    await getDb();
    const { username, password, display_name, email, role } = req.body;
    const hash = await bcrypt.hash(password || 'password', 10);
    const id = uuid();
    execute(`
      INSERT INTO users (id, username, password_hash, display_name, email, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, username, hash, display_name || username, email || '', role || 'VIEWER']);
    res.status(201).json({ id, username, display_name: display_name || username, role: role || 'VIEWER' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/current — Get current user (demo mode, returns first admin)
router.get('/current', async (req, res) => {
  try {
    await getDb();
    const user = queryOne('SELECT id, username, display_name, email, role FROM users WHERE role = ? LIMIT 1', ['ADMIN']);
    if (!user) {
      return res.json({ id: 'demo', username: 'admin', display_name: 'Demo Admin', role: 'ADMIN' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
