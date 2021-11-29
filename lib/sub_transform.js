// world size
const x_limit = 1000;
const y_limit = 1000;
const radius = 5;

// FNV-1a algorithm
// https://github.com/tjwebb/fnv-plus
var fnv = require('fnv-plus');

this.generateSubscription = function(topic){

    fnv.seed('knock knock');
    var x_hash = fnv.hash(topic);

    fnv.seed('whos there?')
    var y_hash = fnv.hash(topic);

    var x = x_hash.value % x_limit;   
    var y = y_hash.value % y_limit;

    var spatialSub = {x : x, y: y, radius : radius, channel : topic}
    return 'sp: <' + JSON.stringify(spatialSub)+'>';
}

var topics = ['a', 'A', 'b', 'bb', 'hello', 'helloo', '1234', '45@$!@^&%$!&^$%!(@&$^%', 'AGUYIAGWIGUAGUGAWEGIUAWG'];

for (var i = 0; i < topics.length; i++){
    console.log(this.generateSubscription(topics[i]));
}