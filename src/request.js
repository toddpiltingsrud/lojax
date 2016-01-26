
/***********\
   Request
\***********/

lojax.Request = function ( obj ) {
    lojax.log( 'lojax.Request: obj:' ).log( obj );
    if ( typeof obj === 'function' ) {
        obj = obj();
    }
    if ( typeof obj === 'string' ) {
        obj = {
            action: obj,
            method: 'ajax-get'
        };
    }

    this.method = obj.method.toLowerCase();
    this.form = priv.resolveForm( obj );
    this.action = priv.resolveAction( obj );
    this.isNavHistory = obj.isNavHistory;
    this.model = priv.resolveModel( obj );
    this.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
    this.transition = obj.transition;
    this.target = priv.resolveTarget( obj );
    this.data = this.getData( obj );
    this.source = obj.source;
    this.cache = obj.cache;
    this.expire = obj.expire;
    this.renew = obj.renew;
    this.cancel = false;
    this.resolve = null;
    this.reject = null;
    this.result = null;
    this.error = null;
    this.suppressEvents = obj.suppressEvents || false;
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
    getFullUrl: function() {
        switch ( this.method ) {
            case 'get':
            case 'ajax-get':
            case 'ajax-delete':
            case 'jsonp':
                return this.action + ( this.data ? '?' + this.data : '' );
            default:
                return this.action;
        }
    },
    ajax: function ( type ) {
        var self = this;
        $.ajax({
                url: this.action,
                type: type.toUpperCase(),
                data: this.data,
                contentType: this.contentType
            })
            .done( self.done.bind( self ) )
            .fail( self.fail.bind( self ) );
    },
    done: function ( response ) {
        this.result = response;
        if ( this.resolve ) this.resolve( response );
        priv.afterRequest( this, this.suppressEvents );
    },
    fail: function ( error ) {
        this.error = error;
        if ( this.reject ) this.reject( error );
        priv.afterRequest( this, this.suppressEvents );
    },
    methods: {
        get: function () {
            window.location = this.getFullUrl();
            priv.afterRequest( this, this.suppressEvents );
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
                priv.afterRequest( self, self.suppressEvents );
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
            s.src = this.getFullUrl();
            document.body.appendChild( s );
            setTimeout( function () {
                document.body.removeChild( s );
                // we have no way of handling the response of JSONP
                // but trigger the event anyway
                priv.afterRequest( self, self.suppressEvents );
            }, 10 );
        }
    },

    exec: function () {
        this.reset();

        lojax.log( 'request.exec: this:' ).log( this );

        if ( !priv.hasValue( this.methods[this.method] ) ) throw 'Unsupported method: ' + this.method;

        if ( priv.hasValue( this.action ) && this.action !== '' ) {
            priv.beforeRequest( this, this.suppressEvents );
            if ( !this.cancel ) {
                // execute the method function
                this.methods[this.method].bind( this )();
                lojax.log( 'request.exec: executed' );
                //if ( this.cache && ( this.result || this.error ) ) {
                //    lojax.log( 'request.exec: cached' );
                //    // don't execute the AJAX request, just call the handlers
                //    if ( this.result ) this.done( this.result );
                //    if ( this.error ) this.fail( this.error );
                //    priv.afterRequest( this, this.suppressEvents );
                //}
                //else {
                //    // execute the method function
                //    this.methods[this.method].bind( this )();
                //    lojax.log( 'request.exec: executed' );
                //}
            }
            else {
                // always trigger afterRequest even if there was no request
                // it's typically used to turn off progress bars
                priv.afterRequest( this, this.suppressEvents );
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

