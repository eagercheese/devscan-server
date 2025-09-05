
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
  url: {
    type: DataTypes.STRING(2048),
    allowNull: true, // Make it optional to avoid breaking existing records
    defaultValue: null,
    index: true // Add index for fast URL lookups
  },
  final_verdict: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  confidence_score: {
    type: DataTypes.STRING(16),
    allowNull: false
  },
  anomaly_risk_level: {
    type: DataTypes.STRING(16),
    allowNull: false
  },
  explanation: {
    type: DataTypes.TEXT
  },
  tip: {
    type: DataTypes.TEXT
  },
  // ML Features for retraining
  anomaly_score: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  who_is: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  https: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  js_len: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  js_obf_len: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  contains_suspicious_tld: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  char_continuity_rate: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  num_dots_url: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  domain_url_ratio: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  tld_length: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  path_url_ratio: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  path_domain_ratio: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  entropy_extension: {
    type: DataTypes.DOUBLE,
    allowNull: true
  },
  path_token_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  iso_score: {
    type: DataTypes.DOUBLE,
    allowNull: true
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
  timestamps: false, // Disable timestamps to match existing schema
  indexes: [
    {
      unique: false,
      fields: ['url', 'expiresAt'] // Composite index for cache lookup
    },
    {
      unique: false,
      fields: ['lastScanned'] // Index for cleanup queries
    }
  ]
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
