// Dependancies


const mqtt = require('mqtt');
const record = require('./record.js');
const UTIL = require('./common/util.js');
const crypto = require('crypto');

var subscriptions = [];

function bridge(host, port, id, handleMessage, onConnect){

    var _mqttClient;
    var url = "mqtt://" + host + ":" + port;

    var _id = id;
    var _handleMessage = handleMessage;
    var _onConnect = onConnect;

    // performance measurement
    const recBandwidth = new record();

    // Only record PINGS and PONGS (messages between clients)
    var bytesSent = 0;      // bytes
    var bytesReceived = 0;  // bytess
    var msgsSent = 0;       // messages sent  
    var msgsReceived = 0;   // messages received
    var recording = false;

    // Connect to broker and initialise listener
    var _connect = function(){
        _mqttClient = mqtt.connect(url, {
            clientId : _id
        });

        _mqttClient.on('connect', function(){
            if(typeof _onConnect == 'function'){
                _onConnect(_id);
            }
        });

        _mqttClient.on('message', function(topic, message, packet){

            //console.log('bridge receiving on topic:', topic);
            // only accept messages that dont come from us
            if (packet.topic.endsWith(_id) === false){
                packet.topic = _clientTopic(packet.topic);
                _handleMessage(packet);

                bytesReceived += UTIL.sizeof(packet);
                msgsReceived += 1;
            }
        });

        _mqttClient.on('reconnect', function(){
            console.log('reconnect');
        })
    }

    this.publish = function(packet){
        msgsSent += 1;
        bytesSent += UTIL.sizeof(packet);

        // extract options and reformat for publications
        var payload = packet.payload;
        var topic = _bridgeTopic(packet.topic);
        opts = {
            qos : packet.qos,
            retain : packet.retain,
            dup : packet.dup
        } 
        _mqttClient.publish(topic, payload, opts);
        //console.log('bridge publishing on topic:', topic);

        if (recording == false){
            recording = true;
            _startRecordingBandwidth();
        }
    }

    // topics is array of (n)[{topic: topic, qos : qos}]
    // is a list of all topics in the broker
    this.subscribe = function(topics){
        var newTopics = [];
        var temp;

        for(var i = 0; i < topics.length; i++){
            if(!subscriptions.includes(topics[i])){
                subscriptions.push(topics[i]);

                // receive this topic from all other brokers
                temp = topics[i].topic + '/+';

                newTopics.push(temp);
            }
        }

        console.log('new subscriptions:', newTopics);

        _mqttClient.subscribe(newTopics);

        // clean potentially irrelevant subscriptions
        // unsub from irrelevant subs and add subs for new ones
        /*
        for (var i = 0; i < subscriptions.length; i++){
            var sub = subscriptions(i);
            if(!topics.includes(sub)){
                _mqttClient.unsubscribe(sub.topic);
                subscriptions.splice(i, 1);
                i--;
            }
        }
        */
    }

    this.unsubscribe = function(topic){
        if (typeof(topic) != 'undefined'){

            var temp = topic + '/+';
            _mqttClient.unsubscribe(temp);
            console.log('unsubscribing from: ', topic);

        }else{
            _mqttClient.unsubscribe();
            console.log('unsubscribing from all topics');
        }
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

    var _bridgeTopic = function(topic){
        return topic + '/' + _id;
    }

    // trim the bridge id of the end
    var _clientTopic = function(topic){
        return topic.substring(0, topic.lastIndexOf('/'));
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
    module.exports = bridge;
}