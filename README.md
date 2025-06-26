# Cybersecurity Chrome Extension Server

This project is a Node.js/Express backend for a Chrome-based cybersecurity extension (DEVScan). It analyzes website links using machine learning models, caches results, and stores data in MySQL via Sequelize ORM. The server exposes RESTful API endpoints for the extension and supports automated and manual testing.

## Features
- Analyze website links for security using ML models
- MySQL database integration via Sequelize
- Caching of scan results
- RESTful API endpoints for Chrome extension and manual use
- Automated tests with Jest and Supertest

## Folder Structure

```
server/
├── src/
│   ├── controllers/      # API request handlers (business logic)
│   ├── models/           # Sequelize models (database tables)
│   ├── routes/           # Express route definitions (API endpoints)
│   ├── services/         # Reusable logic (ML, cache, etc.)
│   ├── app.js            # Express app setup (no server start)
│   └── server.js         # Entry point: DB connect & server start
├── tests/                # Automated Jest/Supertest tests
├── .env                  # Environment variables (DB, ML service, etc.)
├── package.json          # Project metadata, scripts, dependencies
└── README.md             # Project documentation
```

### Folder/Files Explained
- **src/controllers/**: Handles API request logic (e.g., scan sessions, scanned links, scan results).
- **src/models/**: Sequelize models for MySQL tables (e.g., ScanSession, ScannedLink, ScanResults, CachedResults).
- **src/routes/**: Express route files, mapping URLs to controller functions.
- **src/services/**: Business logic and helpers (e.g., ML service integration, cache management).
- **src/app.js**: Sets up the Express app, middleware, and routes (does not start the server).
- **src/server.js**: Connects to the database and starts the Express server.
- **tests/**: Contains Jest/Supertest test files for endpoints and services.
- **.env**: Stores sensitive config (DB credentials, ML service URL, etc.).
- **package.json**: Lists dependencies and npm scripts (start, test, etc.).

## Setup
- See `.env` for environment variables
- See `src/` for source code
- See `tests/` for tests

## Running the Server
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your `.env` file with MySQL and ML service details.
3. Start the server:
   ```bash
   npm start
   ```

## Testing
- Run all automated tests:
  ```bash
  npm test
  ```

## API Endpoints
- See `src/routes/` and controller files for all available endpoints.
- Use Postman or similar tools to manually test endpoints (see project documentation or ask for a step-by-step guide).
