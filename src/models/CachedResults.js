const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const ScanResults = require('./ScanResults');
const ScannedLink = require('./ScannedLink');
const Admin = require('./Admin');

const CachedResults = sequelize.define('CachedResults', {
  results_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: ScanResults,
      key: 'result_ID',
    },
  },
  link_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: ScannedLink,
      key: 'link_ID',
    },
  },
  isMalicious: DataTypes.BOOLEAN,
  anomalyScore: DataTypes.DECIMAL(5,2),
  classificationScore: DataTypes.DECIMAL(5,2),
  admin_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Admin,
      key: 'admin_ID',
    },
  },
}, {
  tableName: 'CachedResults',
  timestamps: true,
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

CachedResults.belongsTo(Admin, { 
  foreignKey: 'admin_ID',
  targetKey: 'admin_ID'
});

module.exports = CachedResults;
