const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const ScanEngine = sequelize.define('ScanEngine', {
  engineVersion: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false,
  },
}, {
  tableName: 'ScanEngine',
  timestamps: false,
});

module.exports = ScanEngine;
