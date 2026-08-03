require('dotenv').config();
const express = require('express');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const { authMiddleware, requireAdmin } = require('./authMiddleware');
const bcrypt = require('bcrypt');
const PORT = process.env.PORT || 3000;
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const helmet = require('helmet');
const app = express();
const cors = require('cors');
const rateLimit = require('express-rate-limit');



const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                  // 100 requests per IP per window
    message: { error: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.AUTH_RATE_LIMIT_MAX ? Number(process.env.AUTH_RATE_LIMIT_MAX) : 5,
    message: { error: 'Too many login attempts, please try again later' }
});

app.use(generalLimiter);
app.use(helmet());
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173'
}));

app.get('/api/authors', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM authors ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching authors' });
    }
});

app.put('/api/books/:id',
  authMiddleware,
  body('title').trim().notEmpty().withMessage('Title is required and cannot be empty').escape(),
  body('published_year')
    .isInt({ min: 1450, max: new Date().getFullYear() })
    .withMessage('Published year must be a valid integer between 1450 and the current year'),
  body('author_id')
    .isInt({ min: 1 }).withMessage('Author ID must be a valid integer')
    .custom(async (value) => {
      const result = await pool.query('SELECT id FROM authors WHERE id = $1', [value]);
      if (result.rows.length === 0) {
        throw new Error('Author does not exist');
      }
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, published_year, author_id } = req.body;

    try {
      const query = `
        UPDATE books
        SET title = $1, published_year = $2, author_id = $3
        WHERE id = $4
        RETURNING *
      `;
      const values = [title, published_year, author_id, id];
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Book not found' });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update book' });
    }
  }
);


app.get('/api/books', async (req, res) => {
    try {
        const query = `
            SELECT books.id, books.title, books.published_year, authors.name AS author_name
            FROM books
            JOIN authors ON books.author_id = authors.id
            ORDER BY books.id ASC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

app.post('/api/books',
  authMiddleware,
  body('title').trim().notEmpty().withMessage('Title is required and cannot be empty').escape(),
  body('published_year')
    .isInt({ min: 1450, max: new Date().getFullYear() })
    .withMessage('Published year must be a valid integer between 1450 and the current year'),
  body('author_id')
    .isInt({ min: 1 }).withMessage('Author ID must be a valid integer')
    .custom(async (value) => {
      const result = await pool.query('SELECT id FROM authors WHERE id = $1', [value]);
      if (result.rows.length === 0) {
        throw new Error('Author does not exist');
      }
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, published_year, author_id } = req.body;

    try {
      const query = `
        INSERT INTO books (title, published_year, author_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const values = [title, published_year, author_id];
      const result = await pool.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create book' });
    }
  }
);


app.post('/api/refresh-token', authLimiter,async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2',
      [refreshToken, payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

   const dbUser = await pool.query('SELECT role FROM users WHERE id = $1', [payload.userId]);

if (dbUser.rows.length === 0) {
  return res.status(403).json({ error: 'Account no longer exists' });
}

const currentRole = dbUser.rows[0].role;


    const newAccessToken = jwt.sign(
     { userId: payload.userId, role: currentRole },
     process.env.JWT_ACCESS_SECRET,
     { expiresIn: '15m' }
     );


    const newRefreshToken = jwt.sign(
      { userId: payload.userId, jti: crypto.randomUUID() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date(Date.now() + 7*24*60*60*1000).toISOString();
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [payload.userId, newRefreshToken, expiresAt]
    );

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


app.delete('/api/books/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            DELETE FROM books
            WHERE id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        return res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});



app.post('/api/register',
  body('username').trim().notEmpty().withMessage('Username is required').escape(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body; 

    try {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const query = `
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        RETURNING id, username, role
      `;
      const values = [username, passwordHash];

      const result = await pool.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Username already taken' });
      }
      res.status(500).json({ error: 'Failed to register user' });
    }
  }
);
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

 const accessToken = jwt.sign(
  { userId: user.id, role: user.role }, 
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: '15m' }
);

const refreshToken = jwt.sign(
  { userId: user.id, jti: crypto.randomUUID() }, 
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.status(200).json({
      message: 'Login successful',
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});