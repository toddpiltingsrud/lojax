
/***********\
   Request
\***********/

lojax.Request = function ( params ) {
    this.method = params.method.toLowerCase();
    this.form = priv.resolveForm( params );
    this.action = priv.resolveAction( params );
    this.model = priv.resolveModel( params );
    this.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
    this.transition = params.transition;
    this.target = priv.resolveTarget( params );
    this.data = this.getData( params );
    this.source = params.source;
    this.cache = params.cache;
    this.expire = params.expire;
    this.renew = params.renew;
    this.beforeRequest = params.beforeRequest || priv.noop;
    this.afterRequest = params.afterRequest || priv.noop;
    this.cancel = false;
    this.resolve = null;
    this.reject = null;
    this.result = null;
    this.error = null;
};

lojax.Request.prototype = {

    getData: function () {
        var data;
        lojax.log( 'resolveData: method:' ).log( this.method );
        switch ( this.method ) {
            case 'get':
            case 'ajax-get':
            case 'ajax-delete':
            case 'jsonp':
                // convert model to form, serialize form
                // currently the api doesn't provide a way to specify a model
                if ( this.model ) {
                    data = priv.formFromModel( this.model ).serialize();
                }
                else if ( this.form ) {
                    data = priv.formFromInputs( this.form, this.action, this.method ).serialize();
                }
                break;
            case 'post':
                // convert model to form and submit
                if ( this.model ) {
                    data = priv.formFromModel( this.model );
                }
                else if ( this.form ) {
                    data = priv.formFromInputs( this.form, this.action, this.method );
                }
                else {
                    // post requires a form, it's the only way we can do a post from JS
                    data = $( "<form method='POST' action='" + this.action + "' style='display:none'></form>" );
                }
                break;
            case 'ajax-post':
            case 'ajax-put':
                //serialize form, JSON.stringify model and change content-type to application/json
                if ( this.model ) {
                    data = JSON.stringify( this.model );
                    this.contentType = 'application/json';
                }
                else if ( this.form ) {
                    data = priv.formFromInputs( this.form, this.action, this.method ).serialize();
                }
                break;
        }
        return data;
    },
    ajax: function ( type ) {
        var self = this,
            options = {
                url: this.action,
                type: type.toUpperCase(),
                data: this.data,
                contentType: this.contentType
            };

        lojax.log( 'ajax: options: ' + options );
        $.ajax( options )
            .done( self.done.bind( self ) )
            .fail( self.fail.bind( self ) );
    },
    done: function ( response ) {
        this.result = response;
        if ( this.resolve ) this.resolve( response );
        this.afterRequest( this );
    },
    fail: function ( error ) {
        this.error = error;
        if ( this.reject ) this.reject( error );
        this.afterRequest( this );
    },
    methods: {
        get: function () {
            window.location = this.action + ( this.data ? '?' + this.data : '' );
            this.afterRequest( this );
        },
        post: function () {
            var self = this;
            var form = this.data;
            form.appendTo( 'body' );
            form[0].submit();
            // in the case of downloading a file, the page is not refreshed
            // so we still need to clean up after ourselves
            setTimeout( function () {
                form.remove();
                self.afterRequest( self );
            }, 0 );
        },
        'ajax-get': function () {
            $.get( this.action, this.data )
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
            var s = document.createElement( 'script' );
            s.type = 'text/javascript';
            s.src = this.action + ( this.data ? '?' + this.data : '' );
            document.body.appendChild( s );
            setTimeout( function () {
                document.body.removeChild( s );
                // we have no way of handling the response of JSONP
                // but trigger the event anyway
                self.afterRequest( self );
            }, 10 );
        }
    },

    exec: function () {
        this.reset();

        if ( !priv.hasValue( this.methods[this.method] ) ) throw 'Unsupported method: ' + this.method;

        if ( priv.hasValue( this.action ) && this.action !== '' ) {
            this.beforeRequest( this );
            if ( !this.cancel ) {
                if ( this.cache && ( this.result || this.error ) ) {
                    lojax.log( 'request.exec: cached' );
                    // don't execute the AJAX request, just call the handlers
                    if ( this.result ) this.done( this.result );
                    if ( this.error ) this.fail( this.error );
                    this.afterRequest( this );
                }
                else {
                    // execute the method function
                    this.methods[this.method].bind( this )();
                    lojax.log( 'request.exec: executed' );
                }
            }
            else {
                // always trigger afterRequest even if there was no request
                // it's typically used to turn off progress bars
                this.afterRequest( this );
            }
        }
        return this;
    },

    // fake promise
    then: function ( resolve, reject ) {
        var self = this;
        if ( typeof resolve === 'function' ) {
            this.resolve = resolve;
            if ( this.result !== null ) {
                // the response came before calling this function
                resolve( self.result );
            }
        }
        if ( typeof reject === 'function' ) {
            this.reject = reject;
            if ( this.error !== null ) {
                // the response came before calling this function
                reject( self.error );
            }
        }
        return this;
    },

    // fake promise
    'catch': function ( reject ) {
        return this.then( undefined, reject );
    },

    reset: function () {
        if ( !this.cache ) {
            this.result = null;
            this.error = null;
        }
        this.cancel = false;
        this.resolve = null;
        this.reject = null;
    }
};

