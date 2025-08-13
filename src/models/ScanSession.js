const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const ScanEngine = require('./ScanEngine');

const ScanSession = sequelize.define('ScanSession', {
  session_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  browserInfo: DataTypes.STRING(255),
  timestamp: DataTypes.DATE,
  engineVersion: {
    type: DataTypes.STRING(255),
    references: {
      model: ScanEngine,
      key: 'engineVersion',
    },
  },
}, {
  tableName: 'ScanSession',
  timestamps: false,
});

module.exports = ScanSession;

