var http = require('http');

var app = http.createServer(function(request, response){
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    var obj = dump(request);

    var json = JSON.stringify(obj);

    response.end(json);
});

app.listen(1338);

var dump = function(obj) {
    var type, props = Object.getOwnPropertyNames(obj);
    var dict = {};
    props.forEach(function(prop){
        type = typeof obj[prop];
        if (type !== 'function' && type !== 'object') {
            dict[prop] = obj[prop];
        }
    });
    return dict;
};