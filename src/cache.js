
/***********\
   Cache
\***********/

lojax.Cache = function () {
    this.store = {};
};

lojax.Cache.prototype = {
    add: function ( request ) {
        this.remove( request.action );
        this.store[request.action] = request;
        if ( request.expire ) {
            this.setTimeout( request );
        }
    },
    remove: function ( action ) {
        var request = this.store[action];
        if ( request ) {
            if ( request.timeout ) {
                clearTimeout( request.timeout );
            }
            delete this.store[action];
        }
    },
    get: function ( action ) {
        var request = this.store[action];
        if ( request ) {
            if ( request.renew === 'sliding' && request.timeout ) {
                this.setTimeout( request );
            }
            return this.store[action];
        }
    },
    setTimeout: function ( request ) {
        var self = this;
        if ( request.timeout ) {
            clearTimeout( request.timeout );
        }
        request.timeout = setTimeout( function () {
            self.expire( request );
        }, request.expire * 1000 );
    },
    expire: function ( request ) {
        if ( request.renew === 'auto' ) {
            request.exec();
            this.setTimeout( request );
        }
        else {
            this.remove( request.action );
        }
    },
    clear: function () {
        var self = this;
        var actions = Object.getOwnPropertyNames( this.store );
        actions.forEach( function ( action ) {
            self.remove( action );
        } );
    },
    contains: function ( action ) {
        return ( action in this.store );
    }
};
