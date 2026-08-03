# Library Books API — Week 22 Update

## Overview
This update adds production-style authentication, input validation, and security hardening to the Library Books API (Node.js/Express + PostgreSQL).

## New Features

### Refresh Token System
- Dual-token authentication: short-lived access tokens (15 min) + long-lived refresh tokens (7 days)
- Refresh tokens stored in a dedicated `refresh_tokens` table, enabling server-side revocation
- Token rotation: each refresh invalidates the old token and issues a new one
- Unique `jti` claim on refresh tokens to prevent signature collisions
- `TIMESTAMPTZ` columns to avoid timezone-related expiry bugs

### Environment Variables
- All secrets (JWT keys, DB credentials) moved to `.env`, excluded from version control
- Separate secrets for access vs. refresh tokens to limit blast radius on leak

### Input Validation & Sanitization
- `express-validator` applied across `/api/register`, `/api/books` (POST/PUT)
- Type/range validation (e.g., `published_year`, `author_id`)
- Custom async validator confirming referenced `author_id` exists in the database
- HTML-escaping (`.escape()`) on user-supplied text fields to prevent stored XSS

### Security Hardening
- `helmet` — secure HTTP headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, etc.)
- `cors` — restricts cross-origin requests to the configured frontend origin
- `express-rate-limit` — general rate limiting (100 req/15min) and stricter auth rate limiting (configurable via `AUTH_RATE_LIMIT_MAX`) on `/api/login` and `/api/refresh-token`
- Verified immunity to SQL injection via parameterized queries throughout

### Role-Based Access Control (RBAC)
- `role` column added to `users` (`user` / `admin`), defaulting to `user`
- Role embedded in JWT at login and refreshed from the database on token refresh (so revoked privileges take effect within one access-token lifetime)
- `requireAdmin` middleware restricting `DELETE /api/books/:id` to admin accounts

## Endpoints Added/Changed
- `POST /api/refresh-token` — exchanges a valid refresh token for a new token pair
- `DELETE /api/books/:id` — now admin-only

## Setup
Requires a `.env` file with `DB_*`, `PORT`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and optionally `AUTH_RATE_LIMIT_MAX`.