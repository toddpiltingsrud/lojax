﻿
/***********\
   Request
\***********/

jx.Request = function ( obj ) {

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
    if (priv.resolveModel) this.model = priv.resolveModel( obj );
    this.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
    this.transition = obj.transition;
    this.target = priv.resolveTarget( obj );
    this.poll = priv.resolvePoll( obj );
    this.processData = true;
    this.data = this.getData( obj );
    this.source = obj.source;
    this.preload = 'preload' in obj;
    this.eventType = obj.eventType;
    this.cancel = false;
    this.resolve = [];
    this.reject = [];
    this.result = null;
    this.error = null;
    this.suppressEvents = obj.suppressEvents || false;
    this.callbacks = {
        then: priv.getFunctionAtPath( obj.then ),
        'catch': priv.getFunctionAtPath( obj['catch'] )
    };
    this.before = priv.getFunctionAtPath( obj.before );
};

jx.Request.prototype = {

    getData: function () {
        var data;
        jx.info( 'resolveData: method:' , this.method );
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
                    data = $( this.form ).serialize();
                }
                break;
            case 'post':
            case 'put':
                // convert model to form and submit
                if ( this.model ) {
                    data = priv.formFromModel( this.model );
                }
                else if ( this.form ) {
                    data = priv.formFromInputs( this.form, this.action, this.method );
                }
                else {
                    // post and put require a form, it's the only way we can do a post or put from JS
                    data = $( "<form method='" + this.method.toUpperCase() + "' action='" + this.action + "' style='display:none'></form>" );
                }
                break;
            case 'ajax-post':
            case 'ajax-put':
                // serialize form, JSON.stringify model and change content-type to application/json
                if ( this.model ) {
                    data = JSON.stringify( this.model );
                    this.contentType = 'application/json';
                }
                else if ( this.form ) {
                    if ( window.FormData ) { // && $(this.form).find('[type=file]').length ) {
                        data = priv.getFormData( this.form );
                        // prevent jQuery from converting this into a string
                        this.processData = false;
                        this.contentType = false;
                    }
                    else {
                        data = $( this.form ).serialize();
                    }
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
    ajax: function () {
        var self = this;
        $.ajax( {
            url: this.action,
            type: this.method.toUpperCase(),
            data: this.data,
            contentType: this.contentType,
            processData: this.processData
        } )
            .done( self.done.bind( self ) )
            .fail( self.fail.bind( self ) );

    },
    done: function ( response ) {
        this.result = response;
        priv.callFunctionArray( this.resolve, this, response );
        priv.afterRequest( this, this.suppressEvents );
    },
    fail: function ( error ) {
        this.error = error;
        priv.callFunctionArray( this.reject, this, error );
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
        put: function () {
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
            this.ajax();
        },
        'ajax-put': function () {
            this.ajax();
        },
        'ajax-delete': function () {
            this.ajax();
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
        var cancel = false;
        this.reset();

        jx.info( 'request.exec: this:' , this );

        if ( !priv.hasValue( this.methods[this.method] ) ) throw 'Unsupported method: ' + this.method;

        if ( priv.hasValue( this.action ) && this.action !== '' ) {
            if ( typeof this.before === 'function' ) {
                priv.call( this.before, this, this );
                if ( this.cancel ) return;
            }
            // don't trigger any events for beforeSubmit
            // it's typically used as a validation hook
            // if validation fails we want lojax to take no action at all
            priv.beforeSubmit( this );
            if ( this.cancel ) return;
            priv.beforeRequest( this, this.suppressEvents );
            if ( !this.cancel ) {
                // execute the method function
                this.methods[this.method].bind( this )();
                jx.info( 'request.exec: executed' );
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
        if ( typeof resolve === 'function' ) {
            this.resolve.push( resolve );
            if ( this.result !== null ) {
                // the response came before calling this function
                priv.call( resolve, this, this.result );
            }
        }
        if ( typeof reject === 'function' ) {
            this.reject.push( reject );
            if ( this.error !== null ) {
                // the response came before calling this function
                priv.call( reject, this, this.error );
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
        this.resolve = [];
        this.reject = [];
    }

};

