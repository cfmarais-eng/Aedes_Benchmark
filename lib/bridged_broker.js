const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const Packet = require('aedes-packet');
const Bridge = require('./bridge.js');
const record = require('./record.js');
const UTIL = require('./common/util.js');

var _id = process.argv[2] || UTIL.getHostname();
var _id = _id.toString();
const port = parseInt(process.argv[3]) || 8000;
const isMaster = process.argv[4] || true;
const master = process.argv[5] || 'LAPTOP-JJ5440PB';
var bridge;

const recBandwidth = new record();
var bytesSent = 0;      // bytes
var bytesReceived = 0;  // bytess
var msgsSent = 0;       // messages sent  
var msgsReceived = 0;   // messages received
var recording = false;

var _init = function(){
    if (server.listening == false){
        server.listen(port, function () {
          console.log(_id + ' started and listening on port ', port)
        })
    }
    
    // if we are not the master, we should create listeners to
    // capture our client events so that we can mirror them on the bridge
    if (isMaster == false || isMaster == 'false'){
        aedes.on('subscribe', function (topics) {
            console.log('new subscription:',topics)
            bridge.subscribe(topics);
        });
        
        aedes.on('publish', function(packet, client){
            
            if (typeof(packet.topic) != 'undefined' && client != null){
                // only publish if the right type
                if (packet.topic.startsWith('$') == false){
                    bridge.publish(packet);
                }
            }

        });       
    }else{
        aedes.on('subscribe', function(topic){
            console.log('new subscription:',topic)
        });

        aedes.on('publish', function(packet, client){
            
            if (typeof(packet.topic) != 'undefined' && client != null){
                // only publish if the right type
                if (packet.topic.startsWith('$') == false){
                    msgsReceived += 1;
                    bytesReceived += UTIL.sizeof(packet);

                    if(recording === false){
                        _startRecordingBandwidth();
                        recording = true;
                    }
                }
            }

        });
    }
}

// bridge is giving us publications from the master, 
// we should publish them to our clients
var _handleMessage = function(packet){
    aedes.publish(packet);
}

var _startRecordingBandwidth = function(){
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

if (isMaster == true || isMaster == 'true') {
    console.log('I am the master broker, no need to create bridging client');
    _init();
} 
else {
    console.log('I am a bridged broker, creating bridging client');

    UTIL.lookupIP(master, function(addr){
        bridge = new Bridge(addr, 8000, _id, _handleMessage, function(id){
            _id = id;    
            
            // I have successfully connected to the master, so init
            _init();
        });
    
    });

}

