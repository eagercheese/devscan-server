const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const ScanSession = require('./ScanSession');

const ScannedLink = sequelize.define('ScannedLink', {
  link_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  session_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: ScanSession,
      key: 'session_ID',
    },
  },
  scanTimestamp: DataTypes.DATE,
  url: DataTypes.TEXT,
}, {
  tableName: 'ScannedLink',
  timestamps: false,
});

module.exports = ScannedLink;
