const client = require('../lib/client.js');
const UTIL = require('../lib/common/util.js');

// my id
var _id = process.argv[2] || 'client';
var topic = process.argv[3] || 'PING';


// hostname for my broker
var broker = process.argv[4] || 'supernode.local';
var port = process.argv[5] || 1883;

var wait_to_ping =  parseInt(process.argv[6]) || 1000;
var ping_refresh_time = parseInt(process.argv[7]) || 1000; // time between pings

var br_addr; // Address our broker

var pinging = false;

var C;

function sendPINGs(){

    // only begin measurements once client is actually active
    C.startRecordingPONGs();
    C.startRecordingBandwidth();

    C.sendPING(topic, 64);

    setInterval(function(){
        C.sendPING(topic, 64);
    }, ping_refresh_time);
}

function clearSubscriptions(){
    C.unsubscribe();
}

// init
// get GW address before attempting init
UTIL.lookupIP(broker, function(addr){
    br_addr = addr;

    C = new client(br_addr, port, _id, topic, function(id){
        _id = id;    

        // subscribe to receive pongs on my unique topic
        C.subscribe(_id);
    
        // subscribe to receive pings on the PING channel
        C.subscribe(topic);

        // give time for clients to join and subscribe first
        if (pinging === false){
            pinging = true;
            setTimeout(sendPINGs, wait_to_ping);
        }
    });

});



 