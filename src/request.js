
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
    this.expire = params.expire;
    this.renew = params.renew;
    this.cancel = false;
    this.resolve = [];
    this.reject = [];
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
            window.location = this.action + ( this.data ? '?' + this.data : '' );
            priv.triggerEvent( lojax.events.afterRequest, this, this.source );
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
                priv.triggerEvent( lojax.events.afterRequest, self, form );
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

