
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
  final_verdict: {
    type: DataTypes.STRING(32)
  },
  confidence_score: {
    type: DataTypes.STRING(16)
  },
  anomaly_risk_level: {
    type: DataTypes.STRING(16)
  },
  explanation: {
    type: DataTypes.TEXT
  },
  tip: {
    type: DataTypes.TEXT
  },
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
