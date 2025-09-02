
const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const ScanResults = require('./ScanResults');
const ScannedLink = require('./ScannedLink');

const CachedResults = sequelize.define('CachedResults', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  results_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: ScanResults,
      key: 'result_ID',
    },
  },
  link_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: ScannedLink,
      key: 'link_ID',
    },
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
  cacheSource: {
    type: DataTypes.STRING(32),
    defaultValue: 'ml_service'
  },
  lastScanned: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  expiresAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'cached_results',
  timestamps: false,
});

// Define associations
CachedResults.belongsTo(ScannedLink, { 
  foreignKey: 'link_ID',
  targetKey: 'link_ID'
});

CachedResults.belongsTo(ScanResults, { 
  foreignKey: 'results_ID',
  targetKey: 'result_ID'
});

module.exports = CachedResults;
