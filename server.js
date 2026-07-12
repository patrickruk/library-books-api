require('dotenv').config();
const express = require('express');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./authMiddleware');
const bcrypt = require('bcrypt');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.get('/api/authors', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM authors ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong fetching authors' });
    }
});

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

app.post('/api/books', authMiddleware, async (req, res) => {
    try {
        if (!req.body) {
    return res.status(400).json({ error: 'Request body is required' });
}
        const { title, published_year, author_id } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Title is required and cannot be empty' });
        }

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
});

app.put('/api/books/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, published_year, author_id } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Title is required and cannot be empty' });
        }

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
});


app.delete('/api/books/:id', authMiddleware, async (req, res) => {
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



app.post('/api/register', async (req, res) => {
    try {
        if (!req.body) {
    return res.status(400).json({ error: 'Request body is required' });
}
        const { username, password } = req.body;

        if (!username || username.trim() === '') {
            return res.status(400).json({ error: 'Username is required' });
        }
        if (!password || password.trim() === '') {
            return res.status(400).json({ error: 'Password is required' });
        }
        
        if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
}
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO users (username, password_hash)
            VALUES ($1, $2)
            RETURNING id, username
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
});


app.post('/api/login', async (req, res) => {

    try {
        if (!req.body) {
    return res.status(400).json({ error: 'Request body is required' });
}
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

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});