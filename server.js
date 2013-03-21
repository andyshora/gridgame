var   express = require('express'),
    app = express(),
    http = require('http'),
    server = http.createServer(app),
    io  = require('socket.io').listen(server),
    port = process.env.PORT || 5000;

var timer = 0;


var timerInterval;


server.listen(port);

var users = {};

app.configure(function() {
    app.use(express.static(__dirname + '/public'));
      app.use(app.router);
});

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

io.configure(function () {
    io.set('transports', ['websocket']);
});

var usernames = {};

io.sockets.on('connection', function (socket) {

  socket.on('claimsquare', function (data) {
    socket.username = data.username;
    console.log('claim square ' + data.id + ' - ' + data.username + ' ' + data.color);
    
    socket.broadcast.emit('squareclaimed', { id: data.id, username: data.username, color: data.color });

  });
  
  socket.on('adduser', function (data) {
    socket.username = data.username;
    console.log(data.username + ' connected');
    usernames[data.username] = data;
    socket.broadcast.emit('newuser', { username: data.username, color: data.color });

    socket.emit('allusers', { users: usernames });
  });



  socket.on('sendmessage', function (data) {
    console.log('message sent by '+data.username+': '+data.message);
    socket.broadcast.emit('message', { username: data.username, message: data.message });
  });

  socket.on('disconnect', function () {
    delete usernames[socket.username];
    //console.log('usernames: '+usernames);

    socket.broadcast.emit('disconnected', { username: socket.username });
    //socket.broadcast.emit('logmessage', { message: socket.username + ' has disconnected'} );
  });

  // Ref functions
  socket.on('startgame', function (data) {
    console.log('game started');
    socket.broadcast.emit('startgame', {});

    timer = data.timer; // 10 secs
    timerInterval = setInterval(countdown, 1000);
  });
  socket.on('stopgame', function (data) {
    clearInterval(timerInterval);
    console.log('game stopped');
    socket.broadcast.emit('stopgame', {});
  });
  socket.on('starplaced', function (data) {
    console.log('square starred');
    socket.broadcast.emit('starplaced', data);
  });

  function countdown() {
      timer--;
      console.log('------TIMER:' + timer);

      if (timer>0) {
        socket.broadcast.emit('timer', { timer: timer });
        socket.emit('timer', { timer: timer });
      } else {
        clearInterval(timerInterval);
        socket.broadcast.emit('timer', { timer: 0 });
        socket.emit('timer', { timer: timer });
      }
  }


});









