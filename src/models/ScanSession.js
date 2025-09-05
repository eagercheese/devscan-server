const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const ScanEngine = require('./ScanEngine');

const ScanSession = sequelize.define('ScanSession', {
  session_ID: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
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

