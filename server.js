require('dotenv').config();
const express = require('express');
const pool = require('./db');

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

app.post('/api/books', async (req, res) => {
    try {
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

app.put('/api/books/:id', async (req, res) => {
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


app.delete('/api/books/:id', async (req, res) => {
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



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});