const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection with retry logic
const DB_CONFIG = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'taskuser',
  password: process.env.DB_PASS || 'taskpass',
  database: process.env.DB_NAME || 'taskdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

function createPool() {
  pool = mysql.createPool(DB_CONFIG);
  console.log('MySQL connection pool created.');
}

function waitForDB(retries = 10, delay = 3000) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      pool.query('SELECT 1', (err) => {
        if (!err) {
          console.log('Connected to MySQL.');
          resolve();
        } else if (remaining > 0) {
          console.log(`MySQL not ready. Retrying in ${delay / 1000}s... (${remaining} attempts left)`);
          setTimeout(() => attempt(remaining - 1), delay);
        } else {
          reject(new Error('Could not connect to MySQL after multiple attempts.'));
        }
      });
    };
    attempt(retries);
  });
}

function initDB() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status ENUM('pending', 'done') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  pool.query(createTableSQL, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Tasks table ready.');
    }
  });
}

// Routes

// GET all tasks (JSON API)
app.get('/api/tasks', (req, res) => {
  pool.query('SELECT * FROM tasks ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST create a task
app.post('/api/tasks', (req, res) => {
  const { title, description } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required.' });
  }
  pool.query(
    'INSERT INTO tasks (title, description) VALUES (?, ?)',
    [title.trim(), (description || '').trim()],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: result.insertId, message: 'Task created.' });
    }
  );
});

// PATCH toggle task status
app.patch('/api/tasks/:id/toggle', (req, res) => {
  const { id } = req.params;
  pool.query(
    "UPDATE tasks SET status = IF(status='pending','done','pending') WHERE id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found.' });
      res.json({ message: 'Status toggled.' });
    }
  );
});

// DELETE a task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  pool.query('DELETE FROM tasks WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found.' });
    res.json({ message: 'Task deleted.' });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
createPool();
waitForDB()
  .then(() => {
    initDB();
    app.listen(PORT, () => {
      console.log(`Task Manager app running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
