const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const ThreatFeedList = sequelize.define('ThreatFeedList', {
  url_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  isBlacklisted: DataTypes.BOOLEAN,
  lastUpdate: DataTypes.DATE,
  url_TIF: DataTypes.TEXT,
}, {
  tableName: 'ThreatFeedList',
  timestamps: false,
});

module.exports = ThreatFeedList;
