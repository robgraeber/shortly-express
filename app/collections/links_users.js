var db = require('../config');
var LinkUser = require('../models/link_user');

var LinksUsers = new db.Collection();

LinksUsers.model = LinkUser;

module.exports = LinksUsers;
