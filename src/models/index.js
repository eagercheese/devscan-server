const { Sequelize } = require('sequelize');

// Provide fallback defaults if environment variables are not set
const DB_NAME = process.env.DB_NAME || 'DevScanDB';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'root';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3309;


console.log(`[Database] Attempting connection to MySQL: ${DB_USER}@${DB_HOST}/${DB_NAME}`);

const sequelize = new Sequelize(
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: false, // Set to true for SQL query logs
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    // Add retry options
    retry: {
      max: 3
    }
  }
);

module.exports = sequelize;
