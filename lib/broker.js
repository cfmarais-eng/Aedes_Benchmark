const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const UTIL = require('./common/util.js');
const record = require('./record.js');

var _id = UTIL.getHostname();
const port = 1883;

// performance measurement
const recBandwidth = new record();

// Only record PINGS and PONGS (messages between clients)
var bytesSent = 0;      // bytes
var bytesReceived = 0;  // bytess
var msgsSent = 0;       // messages sent  
var msgsReceived = 0;   // messages received
var recording = false;

var _init = function(){
    server.listen(port, function () {
      console.log(_id + ' started and listening on port ', port)
    })
    
    aedes.on('subscribe', function(topic){
        console.log('new subscription:',topic);
    })

    aedes.on('publish', function(packet, client){
        var topic  = packet.topic;
        
        if (typeof(topic) != 'undefined' && client != null && packet.cmd == 'publish'){

            console.log('publish message on topic:', topic, 'from: ', client.id);
            
            if(recording === false){
                recording = true;
                _startRecordingBandwidth();
            }

            msgsReceived += 1;
            bytesReceived += UTIL.sizeof(packet);
        }
    });
}

var _startRecordingBandwidth = function(){
    recBandwidth.init('broker-' + _id + '-bandwidth', '/results');

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
    recBandwidth.write(state, 'broker-' + _id + '-bandwidth');
}

_init();

