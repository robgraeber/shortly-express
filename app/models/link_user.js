var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var LinkUser = db.Model.extend({
  tableName: 'urls_users',
  hasTimestamps: true
});

module.exports = LinkUser;