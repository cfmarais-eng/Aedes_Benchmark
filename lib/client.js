// Dependancies


const mqtt = require('mqtt');
const record = require('./record.js');
const UTIL = require('./common/util.js');
const crypto = require('crypto');


function client(host, port, id, pingTopic, onConnect){

    var _mqttClient;
    var url = "mqtt://" + host + ":" + port;
    var _pingTopic = pingTopic;

    var _id = id;
    var _onConnect = onConnect;

    // performance measurement
    const recBandwidth = new record();
    const recPongs = new record();
    const recDuplicates = new record();

    const PING_TIMEOUT = 15000; // 15s

    var PONGS = {};     // record of responses
    var PINGS = [];     // array of pings we have received

    var numPINGs = 0;
    var numPONGs = 0;

    // Only record PINGS and PONGS (messages between clients)
    var bytesSent = 0;      // bytes
    var bytesReceived = 0;  // bytess
    var msgsSent = 0;       // messages sent  
    var msgsReceived = 0;   // messages received

    // Connect to broker and initialise listener
    var _connect = function(){
        _mqttClient = mqtt.connect(url, {
            clientId : _id
        });

        _mqttClient.on('connect', function(){
            if(typeof _onConnect == 'function'){
                _onConnect(_id);
                console.log('we connected to: ')
            }
        });

        _mqttClient.on('message', function(topic, message, packet){
            _handleMessage(topic, message, packet);
        });

        _mqttClient.on('packetsend', function(packet){
            var topic  = packet.topic;
            
            // dont record system message sizes
            if (typeof(topic) != 'undefined' && topic.startsWith('$SYS') == false){
                msgsSent += 1;
                bytesSent += UTIL.sizeof(packet);
                console.log('caught message on topic:', topic);
            }
        });

        _mqttClient.on('reconnect', function(){
            console.log('reconnect');
        })
    }

    var _publish = this.publish = function(topic, payload){
        // add my id to identify source of packet
        payload.fromID = _id;
        _mqttClient.publish(topic, JSON.stringify(payload));

        
    }

    var _subscribe = this.subscribe = function(topic){
        _mqttClient.subscribe(topic);
        console.log('subscribing to topic: ' + topic);
    }

    var _unsubscribe = this.unsubscribe = function(topic){
        if (typeof(topic) != 'undefined'){
            _mqttClient.unsubscribe(topic);
            console.log('unsubscribing from: ', topic)
        }else{
            _mqttClient.unsubscribe();
            console.log('unsubscribing from all topics');
        }
    }

    var _sendPING = this.sendPING = function(topic, bytes){
        numPINGs += 1;
        bytes = parseInt(bytes) || 64;

        var time = UTIL.getTimestamp();

        var payload = {
            pinger : _id,
            pingID : _id + '-' + numPINGs,
            sendTime : time,
            bytes : crypto.randomBytes(bytes)
        }

        // preallocate the response storage
        PONGS[payload.pingID] = {
            sendTime : payload.sendTime,
            ids : [],
            totLat : 0,
            minLat : 0,
            maxLat : 0,
            avgLat : 0
        }
        //console.log('sending ping: ', payload.pingID);
        _publish(topic, payload);
    }

    var _handleMessage = function(topic, payload, packet){

        //console.log(topic, payload);

        payload = JSON.parse(payload);

        bytesReceived += UTIL.sizeof(topic) + UTIL.sizeof(payload);
        msgsReceived += 1;

        switch (topic) {
            case _pingTopic:{
                
                var pingID = payload.pingID;
                var fromID = payload.pinger;
                console.log('received ping: ', pingID);

                if (PINGS.includes(pingID)){
                    var dup = {
                        type : 'PING',
                        sendTime : payload.sendTime,
                        pingID : payload.pingID,
                        fromID : fromID
                    }
                    recDuplicates.write(dup, 'client-' + _id + '-duplicates');
                    console.log('Duplicate PING from: ' + payload.pinger);
                    break;
                }

                PINGS.push(pingID);

                // send the packet back as a response on the client's unique topic    
                _publish(fromID, payload);
            }
            break;

            // This is a response to one of our pings
            case id : {
                var now = UTIL.getTimestamp();
                var sendTime = payload.sendTime;
                var lat =  (now - sendTime)/2;

                // discard if this is not a response to our PING (spatial messages might overlap with our subs)
                // also discard if it is too late
                if (payload.pinger !== id || now - sendTime > PING_TIMEOUT){
                    break;
                }

                var pingID = payload.pingID;
                var fromID = payload.fromID;

                console.log('received pong: ' + pingID + ' from: ' + fromID);

                var pong = PONGS[pingID];

                if(pong.ids.includes(fromID)){
                    var dup = {
                        type : 'PONG',
                        sendTime : sendTime,
                        pingID : pingID,
                        fromID : fromID
                    }
                    recDuplicates.write(dup, 'client-' + id + '-duplicates');
                    console.log('received a duplicate PONG from: ' + fromID);
                }

                pong.ids.push(fromID);

                // first response
                if(pong.ids.length === 1){
                    pong.minLat = lat;
                    pong.maxLat = lat;
                }else{
                    pong.minLat = lat < pong.minLat ? lat : pong.minLat;
                    pong.maxLat = lat > pong.maxLat ? lat : pong.maxLat;
                }

                pong.totLat += lat;
                pong.avgLat = pong.totLat / pong.ids.length;

                // add this pong to the list
                PONGS[pingID] = pong; 

                numPONGs += 1;
            }
            break;
        }
    }
    this.startRecordingPONGs = function(){
        recPongs.init(_id + '-pongs','/results');
        recDuplicates.init( _id + '-duplicates','/results');
        var now;

        // Update PONG record every 5 seconds
        setInterval(function(){
            now = UTIL.getTimestamp();
            for (var pingID in PONGS){
                var pong = PONGS[pingID];
                
                // still waiting for possible responses for each pong after this one
                if (now - PONGS[pingID].sendTime < PING_TIMEOUT){
                    break;
                }

                recPongs.write(pong,_id + '-pongs');
                delete PONGS[pingID];
            }      
        }, 5000);
    }

    this.startRecordingBandwidth = function(){
        recBandwidth.init(_id + '-bandwidth', '/results');

        bytesSent = 0;
        bytesReceived = 0;
        msgsSent = 0;
        msgsReceived = 0;
        var time = process.hrtime();

        // Update bandwidth measurements periodically
        setInterval(function(){
            var dt = process.hrtime(time)[0] + process.hrtime(time)[1]/1000000000;  // seconds + nanoseconds
            var bpsSent = bytesSent / dt || 0;
            bytesSent = 0;

            var bpsReceived = bytesReceived / dt || 0;
            bytesReceived = 0;

            var mpsSent = msgsSent / dt || 0;
            msgsSent = 0;

            var mpsReceived = msgsReceived / dt || 0;
            msgsReceived = 0;

            time = process.hrtime();

            _recordBandwidth(UTIL.getTimestamp(), bpsSent, bpsReceived, mpsSent, mpsReceived);

        }, 2000); 
    }

    var _recordBandwidth = function(time, bpsSent, bpsReceived, mpsSent, mpsReceived){
        var state = {
            time : time,
            bpsReceived : bpsReceived,
            bpsSent : bpsSent,
            mpsReceived : mpsReceived,
            mpsSent : mpsSent,
        }
        recBandwidth.write(state, _id + '-bandwidth');
    }

    _connect();
}

if (typeof module !== "undefined"){
    module.exports = client;
}