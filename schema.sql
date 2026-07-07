-- Week 20 Day 1: Intro to SQL, Relationships & Joins
-- Database setup
CREATE DATABASE library_db;

-- Connect using: \c library_db

-- Tables
CREATE TABLE authors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50)
);

CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    published_year INT,
    author_id INT REFERENCES authors(id)
);

-- Sample data
INSERT INTO authors (name, country) VALUES ('Chinua Achebe', 'Nigeria');
INSERT INTO authors (name, country) VALUES ('Ngugi wa Thiong''o', 'Kenya');
INSERT INTO authors (name, country) VALUES ('Mariama Bâ', 'Senegal');
INSERT INTO authors (name, country) VALUES ('Wole Soyinka', 'Nigeria');
INSERT INTO authors (name, country) VALUES ('Ashraf Ahmed', 'Egypt');

INSERT INTO books (title, published_year, author_id) VALUES ('Things Fall Apart', 1958, 1);
INSERT INTO books (title, published_year, author_id) VALUES ('Petals of Blood', 1977, 2);
INSERT INTO books (title, published_year, author_id) VALUES ('No Longer at Ease', 1960, 1);
INSERT INTO books (title, author_id) VALUES ('The Pharaoh', 5);

-- Practice queries (kept for reference/study)
SELECT * FROM authors WHERE country ILIKE '%a';
SELECT books.title, books.published_year, authors.name, authors.country
FROM books
JOIN authors ON books.author_id = authors.id;

SELECT authors.name, books.title
FROM authors
LEFT JOIN books ON authors.id = books.author_id
WHERE books.title IS NULL;

SELECT COUNT(authors.id) AS total
FROM authors
LEFT JOIN books ON authors.id = books.author_id
WHERE books.author_id IS NULL;