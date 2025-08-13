const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const ScannedLink = require('./ScannedLink');
const ScanSession = require('./ScanSession');

const ScanResults = sequelize.define('ScanResults', {
  result_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  isMalicious: DataTypes.BOOLEAN,
  anomalyScore: DataTypes.DECIMAL(5,2),
  classificationScore: DataTypes.DECIMAL(5,2),
  intelMatch: DataTypes.STRING(255),
  link_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: ScannedLink,
      key: 'link_ID',
    },
  },
  session_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: ScanSession,
      key: 'session_ID',
    },
  },
}, {
  tableName: 'ScanResults',
  timestamps: false,
});

module.exports = ScanResults;
