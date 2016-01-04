/***********\
   Request
\***********/

lojax.Request = function ( params ) {
    this.method = params.method.toLowerCase();
    this.form = priv.resolveForm( params );
    this.action = priv.resolveAction( params );
    this.model = priv.resolveModel( params );
    this.contentType = priv.resolveContentType( params );
    this.transition = params.transition;
    this.target = priv.resolveTarget( params );
    this.data = priv.resolveData( params );
    this.source = params.source;
    this.expire = params.expire;
    this.renew = params.renew;
    this.cancel = false;
    this.resolve = [];
    this.reject = [];
    this.result = null;
    this.error = null;
};

lojax.Request.prototype = {
    getSearch: function () {
        // used for both form encoding and url query strings
        var inputs, queryString = '';
        if ( priv.hasValue( this.form ) ) {
            inputs = priv.resolveInputs( this.form );
            queryString = priv.buildForm( inputs ).serialize();
        }
        else if ( priv.hasValue( this.model ) ) {
            queryString = $.param( this.model );
        }
        return queryString;
    },
    getForm: function ( method ) {
        var form = null;
        method = method || 'post';
        if ( priv.hasValue( this.form ) ) {
            form = priv.buildForm( this.form, this.action, method );
        }
        else if ( priv.hasValue( this.model ) ) {
            // it's not possible to post json via javascript without ajax
            // so we'll have to convert it to a form first
            form = priv.formFromModel( this.model, method, this.action );
        }
        else {
            // if there's neither a form nor a model, return a blank form
            // it's the only way we can trigger a post from javascript
            form = priv.formFromModel( null, method, this.action );
        }
        return form;
    },
    getHash: function () {
        var hash = priv.checkHash( this.action );
        if ( hash !== null ) {
            var search = this.getSearch();
            return hash + ( search !== '' ? '?' + search : '' );
        }
        return null;
    },
    ajax: function ( type ) {
        var self = this,
            options = {
                url: this.action,
                type: type.toUpperCase()
            };

        if ( /POST|PUT/.test( options.type ) && this.model ) {
            options.data = JSON.stringify( this.model );
            options.contentType = 'application/json';
        }
        else {
            options.data = this.getSearch();
        }

        lojax.log( 'ajax: options: ' + options );
        $.ajax( options )
            .done( self.done.bind( self ) )
            .fail( self.fail.bind( self ) );
    },
    done: function ( response ) {
        this.result = response;
        this.resolve.forEach( function ( fn ) { fn( response ); } );
        priv.triggerEvent( lojax.events.afterRequest, this, this.source );
    },
    fail: function ( error ) {
        this.error = error;
        this.reject.forEach( function ( fn ) { fn( error ); } );
        priv.triggerEvent( lojax.events.afterRequest, this, this.source );
    },
    methods: {
        get: function () {
            var queryString = this.getSearch();
            var url = priv.checkHash( this.action );
            window.location = url + '?' + queryString;
            priv.triggerEvent( lojax.events.afterRequest, this, this.source );
        },
        post: function () {
            var self = this;
            var form = this.getForm( type );
            form.appendTo( 'body' );
            form[0].submit();
            // in the case of downloading a file, the page is not refreshed
            // so we still need to clean up after ourselves
            setTimeout( function () {
                form.remove();
                priv.triggerEvent( lojax.events.afterRequest, self, form );
            }, 0 );
        },
        'ajax-get': function () {
            var url = priv.checkHash( this.action );
            var search = this.getSearch();
            $.get( url, search )
                .done( this.done.bind( this ) )
                .fail( this.fail.bind( this ) );
        },
        'ajax-post': function () {
            this.ajax( 'post' );
        },
        'ajax-put': function () {
            this.ajax( 'put' );
        },
        'ajax-delete': function () {
            this.ajax( 'delete' );
        },
        jsonp: function () {
            var self = this;
            var queryString = this.getSearch();
            var url = priv.checkHash( this.action );
            var s = document.createElement( 'script' );
            s.type = 'text/javascript';
            s.src = url + '?' + queryString;
            document.body.appendChild( s );
            setTimeout( function () {
                document.body.removeChild( s );
                // we have no way of handling the response of JSONP
                // but trigger the event anyway
                priv.triggerEvent( lojax.events.afterRequest, self, self.source );
            }, 10 );
        }
    },

    exec: function () {
        // reset 
        this.result = null;
        this.error = null;
        this.cancel = false;

        if ( !priv.hasValue( this.methods[this.method] ) ) throw 'Unsupported method: ' + this.method;

        if ( priv.hasValue( this.action ) && this.action !== '' ) {
            priv.triggerEvent( lojax.events.beforeRequest, this, this.source );
            if ( !this.cancel ) {
                // execute the method function
                this.methods[this.method].bind( this )();
            }
            else {
                // always trigger afterRequest even if there was no request
                // it's typically used to turn off progress bars
                priv.triggerEvent( lojax.events.afterRequest, this, this.source );
            }
        }
        return this;
    },

    // fake promise
    then: function ( resolve, reject ) {
        var self = this;
        if ( typeof resolve === 'function' && this.resolve.indexOf( resolve ) === -1 ) {
            this.resolve.push( resolve );
            if ( this.result !== null ) {
                // the response came before calling this function
                resolve( self.result );
            }
        }
        if ( typeof reject === 'function' && this.reject.indexOf( reject === -1 ) ) {
            this.reject.push( reject );
            if ( this.error !== null ) {
                // the response came before calling this function
                reject( self.error );
            }
        }
        return this;
    },

    // fake promise
    catch: function ( reject ) {
        return this.then( undefined, reject );
    },

    clear: function () {
        // remove all handlers
        this.resolve.splice( 0, this.resolve.length );
        this.reject.splice( 0, this.reject.length );
    }
};

