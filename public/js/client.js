var socket;
var date = new Date(); 
var username = '', color = '';
var ref = false;
var appview; // app view, bound to body
var Users, Squares; // collections
var started = false;

var nickSound = new buzz.sound( "sounds/bunny", {
    formats: [ "mp3" ]
});
var johnSound = new buzz.sound( "sounds/papa", {
    formats: [ "mp3" ]
});
var startSound = new buzz.sound( "sounds/start", {
    formats: [ "mp3" ]
});
var stopSound = new buzz.sound( "sounds/finish", {
    formats: [ "mp3" ]
});

$(document).ready(function() {

	
 
	/* ========== BACKBONE APP DEFINITIONS ========== */

	/* ----- BACKBONE MODELS ----- */

	// To represent a player in the game, a spectator, or a referee.
	// Basically anyone viewing the game who may be taking part.
	User = Backbone.Model.extend({
		sync: function () { return false; },
        initialize: function(){
            $('#console').prepend('New user initialized<br>');
        },
        defaults: function() {
			return {
				username: 'Anonymous',
				active: false,
				count: 0,
				bonus: 0
			};
		},
		updateScore: function(score) {
			this.set({ count: score });
			this.trigger('update', {});
		},
		addBonus: function() {
			console.log('addBonus');
			var _bonus = this.get('bonus');
			this.set({ bonus: _bonus+3 });
			this.trigger('update', {});
		}
    });

	// To represent a square tile in the game UI which changes color when clicked.
	// Players need to capture these!
    Square = Backbone.Model.extend({
		// overwrite sync
		sync: function () { return false; },
		// default values
		defaults: function() {
			return {
				owner: '',
				starred: false
			};
		},
        events: {
			"click"   : "tryClaim"
		},
		// try and claim a square
        tryClaim: function() {
			// assume all claims succeed for now, websockets is fast enough to make conflicts unlikely
			if (this.get('owner')!==username)
				this.claimSuccess(username);
	    },
	    claimSuccess: function(newOwner) {
			this.set({ owner : newOwner });
	    },
	    // another player claimed a square
	    squareStolen: function(data) {
			this.set({ owner : data.username });
			this.trigger('stolen', data);
		},
		// referee placed star on the board
		placeStar: function(data) {
			this.set({ starred : true });
			this.trigger('starred', data);
		},
		// star cleared from board
		clearStar: function(data) {
			this.set({ starred : false });
		}

    });

    /* ----- BACKBONE COLLECTIONS ----- */

    // To hold all users, whether player/referee/spectator
    var Users = Backbone.Collection.extend({
		model: User
	});

    // To hold all square tiles which make up the game board.
	var Squares = Backbone.Collection.extend({
		model: Square
	});

	/* ----- BACKBONE VIEWS ----- */

	// To show a user in the list on the game screen
	UserView = Backbone.View.extend({
		template: _.template($('#user_template').html()),

		initialize: function() {
			this.listenTo(this.model, 'update', this.render);
		},
		render: function() {
			console.log('UserView render');
			this.$el.html(this.template(this.model.toJSON()));
			return this;

		}
	});

	// To show a square tile on the board.
	// This will update according to the state of the game, via commands from Socket.IO.
	SquareView = Backbone.View.extend({
		template: _.template($('#square_template').html()),
		initialize: function(){
			this.listenTo(this.model, 'change', this.render);
			this.listenTo(this.model, 'stolen', this.squareStolen);
			this.listenTo(this.model, 'starred', this.squareStarred);
			//console.log('models id: ' + this.model.id);
		},
		render: function(){
			//console.log('SquareView render:' + this.id);
			this.$el.html(this.template(this.model.toJSON()));
			return this;

		},
		events: {
			"click": "claimSquare",
			'stolen': "squareStolen"
		},
		claimSquare: function( event ){

			// no faking clicks please
			if (!(event.pageX && event.which)) return;

			var id = this.model.id;

			if (ref){
				// refs cant claim squares
				appview.placeStar({ id: id });

			} else {

				if (started){
					console.log('attempting to claim square ' + id);
					var claim_data = { id: id, username: username, color: color };

					this.takeSquare(claim_data);

					socket.emit('claimsquare', claim_data);

				} else { // game not started
					// change state of game to finished/not started
					console.log('not started yet');
				}
			}
		},
		squareStolen: function(data) {
			console.log('square stolen!');
			console.log(data);

			this.takeSquare(data);


			//this.takeSquare(this.$el.data('id'), this.$el.data('username'), this.$el.data('color')); 
			// clear data
			//$.removeData(this.$el);
		},
		squareStarred: function(data){
			// dont need to update model
			this.$el.children('.square')
				.addClass('starred');

			// ref has already called this directly
			if (ref){
				// let players know about the star!
				console.log('emitting data');
				console.log(data);
				socket.emit('starplaced', data);
			}
		},
		takeSquare: function(data) {
			this.model.tryClaim(); //update model

			var starred = this.model.get('starred');

			console.log('takeSquare, starred: ' + starred);

			if (starred) {

				// play sound if a bonus point has been awarded
				if ((color==='colorNick')&&(data.username===username)){
					nickSound.play();

				} else if ((color==='colorJohn')&&(data.username===username)){
					johnSound.play();

				} else if (data.username===username){
					
				} 

				// remove star
				this.model.clearStar(data);

			}

			// restyle square
			this.$el.children('.square')
				.attr('class', 'square ' + data.color)
				.html(data.username);

			// update scores
			var score = appview.countSquaresOwnedBy(data);
			console.log(data.username + ' score: ' + score);
			var usrs = Users.where({ username: data.username });

			usrs[0].updateScore(score);

			if (starred) {
				usrs[0].addBonus();
			}

		}
	});
	
	// A wrapped view for the whole game.
	// This acts as an interface between jQuery event handling in the UI and the Backbone.js objects.
	AppView = Backbone.View.extend({
		el: $("body"),
		events: {
			"click #send":  "sendMessage",
			"keypress #send": "checkSendKeypress"
		},
		initialize: function() {
			// add squares
			console.log('AppView initialize');
			this.listenTo(Squares, 'add', this.addSquare);
			this.listenTo(Users, 'add', this.addUser);
			this.listenTo(Users, 'remove', this.removeUser);
			
			for (var i=0; i<this.options.num; i++) {
				this.createSquare({ id: i });
			}
		},
		addUser: function(usr) {
			var view = new UserView({model: usr});
			this.$("#users_list").append(view.render().el);
		},
		removeUser: function(usr) {
			console.log('remove user');
			var _username = usr.get('username');
			this.$('#user_'+ _username).remove();
		},
		addSquare: function(sq) {
			var view = new SquareView({model: sq});
			this.$("#squares_wrap").append(view.render().el);
		},
		createSquare: function(data) {
			//console.log('createSquare:');
			Squares.create({ id: data.id });
		},
		sendMessage: function () {
			var message = $('#message').val();
			$('#message').val('');

			var message_data = { username: username, message: message };
			this.appendMessage(message_data);

			socket.emit('sendmessage', message_data);

		},
		checkSendKeypress: function(e) {
			if(e.which == 13) {
		      $(this).blur();
		      $('#send').focus().click();
		    }
		},
		appendMessage: function(data) {
			//$('#console').prepend(data.username + ': ' + data.message + '<br>');
		},
		logMessage: function(data) {
			//$('#console').prepend(data.message + '<br>');
		},
		newUserJoined: function(data) {
			//$('#console').prepend(data.username + ' joined, color: '+data.color+'<br>');
			var user = new User({ username: data.username, color: data.color, count: data.count, active: data.active});
			Users.add(user);	
		},
		startGame: function() {
			started = true;
			$('#squares_overlay').addClass('go').fadeOut();
			startSound.play();
		},
		stopGame: function() {
			started = false;
			$('#squares_overlay').removeClass('go');
			stopSound.play();

			this.calculateWinner();
		},
		placeStar: function(data) {
			var sq = Squares.get(data.id);
			sq.placeStar(data);
		},
		updateGameTime: function(data) {
			$('#countdown').html(data.timer);

			if (!data.timer) {
				$('#stop_game').trigger('click');
				this.calculateWinner();
			}
		},
		calculateWinner: function(){

			if (ref) return;
			// count totals for each user

			var winningUsername = '';
			var highest = 0;

			for(var i=0; i<Users.length; i++){

				usr = Users.at(i);
				var total = this.countSquaresOwnedBy({ color: usr.get('color') }) + usr.get('bonus');
				if (total>highest) {
					// new highest
					winningUsername = usr.get('username');
					highest = total;

				}

			}


			var win = (username===winningUsername);

			var modal = win ? '#winner_modal' : '#loser_modal';

			$(modal).modal({
				keyboard: false,
				backdrop: 'static',
				locked: true
			});

		},
		countSquaresOwnedBy: function(data) {
			var sqs = $('.'+data.color);
			return sqs.length;
		}

	});

 /* ========== // BACKBONE APP DEFINITIONS ========== */





/* ========== UI - event handlers ========== */

$('#welcome_modal').modal({
	keyboard: false
}).on('shown', function () {
	$('#username').focus();
});



$('.refresh_page').click(function() {
	window.location.reload(true);
});


$('#color').keypress(function(e){
	if (e.keyCode != 13) return;
	$('#ready_button').trigger('click');

});

$('#start_game').click(function(){
	if (ref && (!started)) {
		$(this).attr('disabled', 'disabled');
		$('#stop_game').removeAttr('disabled').show();

		var gameTimer = parseInt($('#game_timer').val(),10);

		started = true;
		socket.emit('startgame', { timer: gameTimer });

		appview.startGame();
	}
});

$('#stop_game').click(function(){
	if (ref && started) {
		$(this).attr('disabled', 'disabled');
		$('#start_game').removeAttr('disabled').show();

		started = false;
		socket.emit('stopgame', {});
	}
});


$('#ref_button').click(function(){
	username = 'Ref';
	color = 'ref';
	ref = true;
	$('#ref_controls').show();

	initSocketIO();
	initBackboneApp();
});

$('#ready_button').click(function(){
	username = $('#username').val();
	color = $('.choose_color.selected').data('class');

	if (!(color && username)) {
		alert('Please enter your name and select a color!');
		return false;
	}

	initSocketIO();
	initBackboneApp();
});

$('.choose_color').click(function(){

	$('.choose_color').removeClass('selected');
	$(this).addClass('selected');
	$('#ref_button').attr('disabled','disabled');
	$('#ready_button').removeAttr('disabled');

	$('#ref_button').hide();
});


$('#disconnect').click(function(){
	console.log('disconnecting');
	socket.disconnect();
});


/* ========== // UI - event handlers ========== */


 /* ========== INIT APP ========== */
function initBackboneApp(){

	// Collections
	Users = new Users();
	Squares = new Squares();

	// App wrapper
	appview = new AppView({ num: 150 });
}

 /* ========== // INIT APP ========== */

 /* ========== SOCKET.IO EVENTS ========== */

// Called when welcome modal has been completed.
function initSocketIO() {

	socket = io.connect(window.location.hostname);

	// Used for debugging
	socket.on('message', function(data) {
		console.log(data);
		appview.appendMessage(data);
	}); 

	// Used for debugging
	socket.on('logmessage', function(data) {
		console.log(data);
		appview.logMessage(data);
	});

	// New user has joined
	socket.on('newuser', function(data) {
		appview.newUserJoined(data);
	});
	
	// Sync users
	// Received in response to this client connecting, so current players are displayed immediately.
	// 
	socket.on('allusers', function(data) {
		console.log('allusers sync');
		
		for (var key in data.users) {
			var usr = Users.where({username: key});

			if (!usr.length) {
				var userData = {username: key, color: data.users[key].color, count: data.users[key].count, active: data.users[key].active };
				appview.newUserJoined(userData);
			}
		}
	});

	// A Square tile on the board has been claimed by another player.
	// The acquiring player does not receive this message as they claim the square locally.
	socket.on('squareclaimed', function(data) {
		console.log('squareclaimed message');
		console.log(data);

		var sq = Squares.get(data.id);
		sq.squareStolen(data);
		
	});

	// Establish a connection to the server, and add this client as a user.
	socket.on('connect', function() {
		var activePlayer = !ref;
		var count = ref ? '-' : 0;
		var userData = {username: username, color:color, active:activePlayer, count:count};
		
		appview.newUserJoined(userData);
		socket.emit('adduser', userData);

	});

	// User disconnect - timeout or manual disconnect.
	socket.on('disconnected', function(data) {
		console.log(data.username + ' disconnected');
		var usr = Users.where({ username: data.username });
		Users.remove(usr);
	});

	// Referee started the game.
	socket.on('startgame', function(data) {
		console.log('game started!');
		appview.startGame();
	}); 

	// Referee stopped the game.
	socket.on('stopgame', function(data) {
		console.log('game stopped!');
		appview.stopGame();
	}); 

	// Referee placed star - bonus points!
	socket.on('starplaced', function(data) {
		console.log('star placed');
		appview.placeStar(data);
	}); 

	// Game countdown timer
	socket.on('timer', function(data) {
		console.log('timer:' + data.timer);
		appview.updateGameTime(data);
	}); 

}
/* ========== // SOCKET.IO EVENTS ========== */


});



