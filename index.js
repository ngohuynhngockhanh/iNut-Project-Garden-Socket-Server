var PORT = process.env.PORT || 8884
const DRUPAL_URL = "http://localhost:8889/"
const MQTT_OPTIONS = {
	url: 'mqtt://118.69.171.114:8887',
	username: null,
	password: null
}

var express = require('express');
var cors = require('cors')
var app = express();
var server = require('http').Server(app);
var io = require("socket.io").listen(server);
var request = require('request')
const  mqtt = require('mqtt');
const _ = require('lodash')
var fs = require("fs");

//If i use this my app will not start
// app.use(express.static());
const format_folder = __dirname + '/format-render/'
app.use(express.static(__dirname + '/public'))
app.use(express.static(format_folder))
app.use(cors())
app.get('/', function(req, res){
  res.sendfile('index.html');
});

// get all device type format
var formats = []
fs.readdir(format_folder, (err, files) => {
  files.forEach(file => {
    console.log("Format read:", file);
    fs.readFile(format_folder +  file, 'utf8', function(error, content) {
    	try {
    		var format = JSON.parse(content)
    		formats.push(format)
    	} catch(e) {}
    })
  });
});
app.get('/formats.json', function(req, res) {
	res.json(formats)
})


//Get input from front-end



var client = io.of('/client');
client.on('connection', function(socket){
	var auth = {}
	console.log("New Connection")
	var autoDisconnect = setTimeout(function() {
		socket.disconnect()
	}, 10000)

	socket.emit('please_login')
	

	var send_format_type = function() {
		socket.emit("all_formats", formats)
	}

	var login = function(auth_info) {
		if (!auth_info.data)
			return false
		console.log("Login using", auth_info)
		_.assign(auth, auth_info)

		var auth_string = "Basic " + new Buffer(auth_info.data.name + ":" + auth_info.data.pass).toString("base64")
		var options = {
		  url: DRUPAL_URL + 'user/socket/devices?_format=json',
		  headers: {
		    'Content-Type': 'application/json',
		    'Authorization': auth_string
		  }
		};
		 
		function callback(error, response, body) {
		  if (!error && response.statusCode == 200) {
		  	try {
			    var nodes = JSON.parse(body);
			    _.map(nodes, function(node) {
			    	var id = node.field_node_id
			    	socket.join(id)
			    	
			    })
			    clearTimeout(autoDisconnect)
			    console.log(auth_info, "Auth => Ok")
			    send_format_type()
			  } catch(e) {
			  	console.log("Auth Error", e)
			  	socket.disconnect()
			  }
		  }
		}
		 
		request(options, callback);
	}

	socket.on('please_send_format_type', send_format_type)
	socket.on('login', login)
});



server.listen(PORT, function(){

	  // Server is running
  	  console.log('listening on port', PORT);

});


var mqtt_client  = mqtt.connect(MQTT_OPTIONS.url, MQTT_OPTIONS)
mqtt_client.on('connect', function () {
	console.log("MQTT Client connected to server", MQTT_OPTIONS.url)
	mqtt_client.subscribe('#')
})

mqtt_client.on('disconnect', function() {
	console.log("MQTT Client disconnected from server")
})

mqtt_client.on('message', function (topic, message) {
  //console.log(topic, message)
  var topic_eles = _.split(topic, '/', 3)
  var node_id = topic_eles[1]
  var channel = topic_eles[2]
 	switch (channel) {
 		case 'read':
 		case 'write': {
 			message = message.toString()
 			try {
 				message = JSON.parse(message)
 			} catch(e) {
 				message = {
 					message: message
 				}
 			}
 			console.log("To room", node_id, "channel", channel)
 			client.to(node_id).emit("data", node_id, channel, message)
 		}
 	}
  //console.log("Node", node_id)
})


