
var _ = require("underscore");
var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var LinkUser = require('./app/models/link_user');
var LinksUsers = require('./app/collections/links_users');
var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {
  if(!checkUser(req, res)){
    return;
  }
  res.render('index');
});
app.get('/logout', function(req, res) {
  if(!checkUser(req, res)){
    return;
  }
  util.removeSession(req.cookies.sessionId)
  res.redirect('/login');
});
app.get('/create', function(req, res) {
  if(!checkUser(req, res)){
    return;
  }
  res.render('index');
});

app.get('/links', function(req, res) {
  if(!checkUser(req, res)){
    return;
  }
  var session = util.getSession(req.cookies.sessionId);
  LinksUsers.resetQuery().query().where({user_id: session.userId}).then(function(linksUsers) {
    if(linksUsers){
      console.log("Shitty linksUsers:", linksUsers);
      var linkIds = _.pluck(linksUsers, "link_id");
      console.log("Shitty linkIds:", linkIds);
      Links.resetQuery().query().whereIn('id', linkIds).then(function(links){
        console.log("Shitty links:", links);
        res.send(200, links);
      });
    }else{
      res.send(404);
    }
  });
});

app.post('/links', function(req, res) {
  if(!checkUser(req, res)){
    return;
  }
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }
  var session = util.getSession(req.cookies.sessionId);
  new Link({ url: uri}).fetch().then(function(link) {
    if (link) {
      console.log("LINK FOUND");
      new LinkUser({
          user_id: session.userId,
          link_id: link.get("id")
        }).save().then(function(linkUser){
          console.log("LINK USER CREATED:", linkUser);
          res.send(200, link.attributes);
        });
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin,
        });
        link.save().then(function(newLink) {
          new LinkUser({
            user_id: session.userId,
            link_id: newLink.get("id")
          }).save().then(function(linkUser){
            console.log("LINK USER:", linkUser);
            Links.add(newLink);
            res.send(200, newLink);
          });
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/signup', function(req, res) {
  res.render('signup', {locals: {}});
});

app.get('/login', function(req, res) {
  res.render('login', {locals: {}});
});

app.post('/signup', function(req, res) {
  // console.log("PARAMS", req.body);
  if (req.body.username && req.body.password) {
    req.body.username = req.body.username.toUpperCase();
    new User({'username': req.body.username})
      .fetch()
      .then(function(user) { // if nothing found in database, returns null (not undefined)
        if (!user) {
          new User({'username': req.body.username, 'password': req.body.password})
          .save()
          .then(function (user){
            console.log("User created successfully!");
            util.createSession(user.get("id"),res);
            res.redirect('/');
          });
        } else {
          res.render('signup', {locals: {error: "User already exists!!"}});
        }
      });
  }
});

app.post('/login', function(req, res) {
  if (req.body.username && req.body.password) {
    req.body.username = req.body.username.toUpperCase();
  new User({'username': req.body.username, 'password': req.body.password})
    .fetch()
    .then(function(user) { // if nothing found in database, returns null (not undefined)
      if (user) {
        console.log(user.links());
        util.createSession(user.get("id"), res);
        res.redirect('/');
      }else{
        res.render('login', {locals: {error: "User or password not found!!"}});
      }
    });
  }
});

var checkUser = function (request, response) {
  // valid cookie and valid session
  if (request.cookies.sessionId && util.getSession(request.cookies.sessionId)) {
    console.log("User has a valid cookie and session id.", request.cookies.sessionId, util.getSession(request.cookies.sessionId));
    return true;
  } else {
    // redirect to login page
    response.redirect('/login');
    return false;
  }
};

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
