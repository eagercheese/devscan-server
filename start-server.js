// ==============================
// DEVSCAN SERVER STARTUP SCRIPT
// ==============================
// Main entry point for the DEVScan backend server
// Handles database connection, table synchronization, and server startup

// Ensure we're in the correct directory for relative imports
process.chdir(__dirname);

// Load environment variables from .env file
require('dotenv').config();

// Import main application and database connection
const app = require('./src/app');
const sequelize = require('./src/models');
const PORT = process.env.PORT || 3001;

// Startup logging for debugging
console.log('Starting DEVScan Server...');
console.log('Working directory:', process.cwd());
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', PORT);

// Database connection and server startup sequence
sequelize.authenticate()
  .then(() => {
    console.log('MySQL connection established successfully.');
    
    // Sync database tables (create/update schema without dropping data)
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log('Database tables synced successfully.');
    
    // Clean up any failed scan cache entries that shouldn't be there
    const cacheService = require('./src/services/cacheService');
    return cacheService.cleanupFailedScans();
  })
  .then(() => {
    console.log('Cache cleanup completed.');
    
    // Start the HTTP server
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log('Extension endpoint: /api/extension/analyze');
      console.log('Health check: /health');
      console.log('Debug endpoint: /debug/database');
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the MySQL database:', err);
    process.exit(1);
  });
