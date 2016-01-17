
/***********\
   Cache
\***********/

lojax.Cache = function () {
    this.store = {};
};

lojax.Cache.prototype = {
    add: function ( request ) {
        var key = request.getFullUrl();
        this.remove( key );
        this.store[key] = request;
        if ( request.expire ) {
            this.setTimeout( request );
        }
    },
    remove: function ( key ) {
        var request = this.store[key];
        if ( request ) {
            if ( request.timeout ) {
                clearTimeout( request.timeout );
            }
            delete this.store[key];
        }
    },
    get: function ( key ) {
        var request = this.store[key];
        if ( request ) {
            if ( request.renew === 'sliding' && request.timeout ) {
                this.setTimeout( request );
            }
            return this.store[key];
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
            this.remove( request.getFullUrl() );
        }
    },
    clear: function () {
        var self = this;
        var keys = Object.getOwnPropertyNames( this.store );
        keys.forEach( function ( key ) {
            self.remove( key );
        } );
    },
    contains: function ( key ) {
        return ( key in this.store );
    }
};
