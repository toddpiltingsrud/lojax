
// namespace
var lojax = lojax || {};

(function($, lojax) { 
    
    /***********\
        API
    \***********/
    
    var priv = {};
    var rexp = {};
    lojax.Controller = {};
    lojax.Transitions = {};
    var instance = lojax.Controller;
    lojax.priv = priv;
    
    // handle an arbitrary event and execute a request
    lojax.on = function ( event, params ) {
        $( document ).on( event, function () {
            instance.executeRequest( params );
        } );
    };
    
    // remove event handler
    lojax.off = function ( event ) {
        $( document ).off( event );
    };
    
    // execute a request
    lojax.exec = function ( params ) {
        instance.executeRequest( params );
    };
    
    // call this from a script that is located inside a jx-panel, div[data-src] or .modal
    // executes a callback with the context set to the injected node
    lojax.in = function ( callback ) {
        lojax.log( 'lojax.in called' );
        instance.in = callback;
    };
    
    lojax.out = function ( callback ) {
        lojax.log( 'lojax.out called' );
        instance.out = callback;
    };
    
    lojax.closeModal = function () {
        // during testing the call to closeModal occurs
        // before the modal has a change to initialize
        // resulting in a modal that doesn't close
        // so use a timeout to make this function run last
        setTimeout( function () {
            if ( priv.hasValue( instance.modal ) ) {
                if ( $.fn.modal ) {
                    instance.modal.modal( 'hide' );
                }
                else if ( $.fn.kendoWindow ) {
                    instance.modal.data( 'kendoWindow' ).close();
                }
            }
        } );
    };
    
    // This action is executed when a browser nav button is clicked
    // which changes window.location.hash to an empty string.
    // This can be a url, a config object for creating a new request, 
    // or a function which returns a url or config object.
    lojax.emptyHashAction = null;
    
    lojax.events = {
        beforeRequest: 'beforeRequest',
        afterRequest: 'afterRequest',
        beforeUpdateModel: 'beforeUpdateModel',
        afterUpdateModel: 'afterUpdateModel',
        beforeInject: 'beforeInject',
        afterInject: 'afterInject',
        ajaxError: 'ajaxError'
    };
    
    lojax.logging = false;
    
    lojax.log = function ( arg ) {
        try {
            if ( lojax.logging && console && console.log ) {
                console.log( arg );
                return console;
            }
        }
        catch ( ex ) { }
        return {
            log: function () { }
        };
    };
    
    lojax.error = ( console && console.error ) ? console.error : function () { };
    
    lojax.config = {
        prefix: 'jx-',
        transition: 'fade-in',
        navHistory: true
    };
    
    lojax.select = {
        methodOrRequest: '[data-request],[jx-request],[data-method]:not([data-trigger]),[jx-method]:not([jx-trigger])',
        methodWithChange: '[data-method][data-trigger*=change],[jx-method][jx-trigger*=change]',
        methodWithEnterOrModel: '[data-method][data-trigger*=enter],[jx-method][jx-trigger*=enter],[data-model],[jx-model]',
        formWithMethod: 'form[data-method],form[jx-method]',
        model: '[data-model],[jx-model]',
        panel: function ( id ) {
            return '[' + lojax.config.prefix + 'panel="' + id + '"],[data-panel="' + id + '"]';
        },
        src: '[data-src],[jx-src]',
        preload: '[data-preload],[jx-preload]',
        jxModelAttribute: '[jx-model]',
        jxModel: 'jx-model',
        inputTriggerChangeOrEnter: ':input[name][jx-trigger*=change],:input[name][data-trigger*=change],:input[name][jx-trigger*=enter],:input[name][data-trigger*=enter]'
    };
    
    lojax.extend = function ( target, source ) {
        target = target || {};
        Object.getOwnPropertyNames( source ).forEach( function ( prop ) {
            target[prop] = source[prop];
        } );
        return target;
    };
    
    /***********\
     Controller
    \***********/
    
    lojax.extend( lojax.Controller, {
    
        init: function () {
            var self = this;
            this.div = null;
            this.modal = null;
            this.currentTransition = null;
            this.currentPanel = null;
            this.cache = {};
            this.isControl = false;
    
            $( function () {
                self.div = $( "<div style='display:none'></div>" ).appendTo( 'body' );
    
                self.removeHandlers();
                self.addHandlers();
                self.loadSrc();
                self.preloadAsync();
    
                // check window.location.hash for valid hash
                if ( priv.hasHash() ) {
                    setTimeout( self.handleHash );
                }
            } );
        },
    
        addHandlers: function () {
            $( document )
                .on( 'click', lojax.select.methodOrRequest, this.handleRequest )
                .on( 'change', lojax.select.methodWithChange, this.handleRequest )
                // allows executing a request on a single input element without wrapping it in a form (e.g. data-trigger="change enter")
                // also submits an element with a model attribute if enter key is pressed
                .on( 'keydown', lojax.select.methodWithEnterOrModel, this.handleEnterKey )
                .on( 'submit', lojax.select.formWithMethod, this.handleRequest )
                // handle the control key
                .on( 'keydown', this.handleControlKey ).on( 'keyup', this.handleControlKey );
            if ( lojax.config.navHistory ) {
                window.addEventListener( "hashchange", this.handleHash, false );
            }
        },
    
        removeHandlers: function () {
            $( document )
                .off( 'click', this.handleRequest )
                .off( 'change', this.handleRequest )
                .off( 'keydown', this.handleEnterKey )
                .off( 'submit', this.handleRequest )
                .off( 'keydown', this.handleControlKey )
                .off( 'keyup', this.handleControlKey );
            if ( lojax.config.navHistory ) {
                window.removeEventListener( "hashchange", this.handleHash, false );
            }
        },
    
        handleRequest: function ( evt ) {
            evt.stopPropagation();
    
            // handles click, change, submit, keydown (enter)
            // 'this' will be the element that was clicked, changed, submitted or keydowned
            var params = priv.getConfig( this ),
                $this = $( this );
    
            lojax.log( 'handleRequest: params: ' ).log( params );
    
            var request = new lojax.Request( params );
    
            lojax.log( 'handleRequest: request: ' ).log( request );
    
            try {
                // delegate hashes to handleHash
                if ( request.isNavHistory ) {
    
                    // if the control key is down and this is a hash url, let the browser handle it
                    if ( instance.isControl ) {
                        return;
                    }
    
                    // store the request's transition so handleHash can pick it up
                    instance.currentTransition = request.transition;
    
                    var newHash = request.action;
    
                    if ( request.data ) {
                        newHash += '?' + request.data;
                    }
    
                    // if hash equals the current hash, hashchange event won't fire
                    // so call handleHash directly
                    if ( '#' + newHash === window.location.hash ) {
                        instance.handleHash();
                    }
                    else {
                        // trigger hashchange event
                        window.location.hash = newHash;
                    }
                }
                else {
                    instance.executeRequest( request );
                }
            }
            catch ( ex ) {
                lojax.error( ex );
            }
    
            evt.preventDefault();
        },
    
        handleEnterKey: function ( evt ) {
            if ( evt.which === 13 ) {
                instance.handleRequest.call( this, evt );
            }
        },
    
        handleControlKey: function ( evt ) {
            if ( evt.which === 17 ) {
                instance.isControl = evt.type === 'keydown';
            }
        },
    
        handleHash: function () {
    
            lojax.log( 'handleHash called' );
    
            if ( !lojax.config.navHistory ) return;
    
            // grab the current hash and request it with ajax-get
    
            var handler, request, hash = window.location.hash;
    
            lojax.log( 'handleHash: hash:' ).log( hash );
            lojax.log( 'handleHash: lojax.emptyHashAction:' ).log( lojax.emptyHashAction );
    
            if ( priv.hasHash() ) {
    
                // If there's no anchor with this name, handle with default settings.
                // We want to support url-only access, and we don't want to clutter 
                // the url with request settings like transition and target. That 
                // means that there must be enough information already in the page 
                // or response (jx-panel) to be able to properly handle the response.
                handler = $( 'a[name="' + hash.substr( 1 ) + '"]' );
                if ( handler.length === 0 ) {
                    instance.executeRequest( {
                        action: hash,
                        method: 'ajax-get',
                        transition: instance.currentTransition
                    } );
                }
                instance.currentTransition = null;
            }
            else if ( hash === '' && lojax.emptyHashAction ) {
                // we got here because a browser navigation button 
                // was clicked which changed the hash to an empty string
                // so execute the configured action if present, else do nothing
                instance.executeRequest( lojax.emptyHashAction );
            }
        },
    
        executeRequest: function ( request ) {
    
            if ( !( request instanceof lojax.Request ) ) {
                request = new lojax.Request( request );
            }
    
            lojax.log( 'executeRequest: request: ' ).log( request );
    
            // no action? we're done here
            if ( request.action === null ) return;
    
            // check for caching
            if ( request.action in this.cache ) {
                request = this.cache[request.action];
                delete this.cache[request.action];
                lojax.log( 'executeRequest: retrieved from cache' );
            }
            else {
                request.exec();
            }
    
            request
                .then( function ( response ) {
                    instance.injectContent( request, response );
                } )
                .catch( instance.handleError );
        },
    
        injectContent: function ( request, response ) {
            var id, target, newModal, transition, $node, result;
    
            // empty response?
            if ( !priv.hasValue( response ) ) return;
    
            // ensure any loose calls to lojax.in are ignored
            instance.in = null;
    
            var doPanel = function () {
                var node = $( this );
                // match up with panels on the page
                id = priv.attr( node, 'panel' );
                target = request.target || $( lojax.select.panel( id ) ).first();
    
                if ( target.length ) {
    
                    lojax.log( 'injectContent: data-panel: ' + id );
                    transition = priv.resolveTransition( request, node );
                    priv.callOut( target );
                    // swap out the content
                    result = transition( target, node );
                    // perform post-inject chores
                    instance.postInject( result, node, request );
                }
            };
    
            // create a list of nodes from the response
            var nodes = $.parseHTML( response, true );
    
            if ( !nodes ) return;
    
            if ( request.target ) {
                // inject the entire response into the specified target
                doPanel.call( $( response ) );
            }
            else {
    
                lojax.log( 'injectContent: nodes:' ).log( nodes );
    
                for ( var i = 0; i < nodes.length; i++ ) {
                    $node = $( nodes[i] );
    
                    priv.triggerEvent( lojax.events.beforeInject, nodes, $node );
    
                    // don't create more than one modal at a time
                    if ( instance.modal === null ) {
                        // check if the node is a modal
                        if ( $node.is( '.modal' ) ) {
                            instance.createModal( $node, request );
                            continue;
                        }
                        else {
                            // check if the node contains a modal
                            newModal = $node.find( '.modal' );
                            if ( newModal.length ) {
                                instance.createModal( newModal, request );
                            }
                        }
                    }
    
                    // find all the panels in the new content
                    if ( request.target || $node.is( priv.attrSelector( 'panel' ) ) ) {
                        doPanel.call( $node );
                    }
                    else {
                        // iterate through the panels
                        $( nodes[i] ).find( priv.attrSelector( 'panel' ) ).each( doPanel );
                    }
                }
            }
    
            // process any loose script or style nodes
            instance.div.empty();
            nodes.forEach( function ( node ) {
                $node = $( node );
                if ( $node.is( 'script,style' ) ) {
                    instance.div.append( $node );
                }
            } );
        },
    
        createModal: function ( content, request ) {
            // injectContent delegates modals here
    
            // check for bootstrap
            if ( $.fn.modal ) {
                instance.modal = $( content ).appendTo( 'body' ).modal( {
                    show: false,
                    keyboard: true
                } );
                instance.modal.on( 'hidden.bs.modal', function () {
                    if ( priv.hasValue( instance.modal ) ) {
                        instance.modal.off( 'hidden.bs.modal', instance.onModalClose );
                        instance.modal.modal( 'hide' );
                        $( instance.modal ).remove();
                        instance.modal = null;
                    }
                } );
                instance.modal.modal( 'show' );
            }
                // check for kendo
            else if ( $.fn.kendoWindow ) {
                instance.modal = $( content ).appendTo( 'body' ).kendoWindow( {
                    title: $( content ).find( '.dialog-header' ).text(),
                    modal: true,
                    animation: {
                        open: {
                            effects: "fade:in"
                        }
                    },
                    visible: false,
                    close: function () {
                        if ( priv.hasValue( instance.modal ) ) {
                            instance.modal.data( 'kendoWindow' ).destroy();
                            $( instance.modal ).remove();
                            instance.modal = null;
                        }
                    }
                } );
                instance.modal.data( 'kendoWindow' ).center().open();
                instance.modal.find( '[data-dismiss=modal]' ).click( function () {
                    instance.modal.data( 'kendoWindow' ).close();
                } );
            }
            if ( instance.modal ) {
                instance.postInject( instance.modal, content, request );
            }
        },
    
        // an AJAX alternative to iframes
        loadSrc: function ( root ) {
            root = root || document;
            $( root ).find( lojax.select.src ).each( function () {
                var $this = $( this );
                var url = priv.attr( $this, 'src' );
                var config = priv.getConfig( $this );
                config.action = priv.noCache( config.src );
                config.method = config.method || 'ajax-get';
                config.target = $this;
                config.transition = config.transition || 'swap-content';
                config.suppressEvents = true;
                instance.executeRequest( config );
            } );
        },
    
        preloadAsync: function ( root ) {
            var self = this, config, request;
            root = root || document;
            // do this after everything else
            setTimeout( function () {
                // find elements that are supposed to be pre-loaded
                $( root ).find( lojax.select.preload ).each( function () {
                    config = priv.getConfig( this );
                    config.suppressEvents = true;
                    request = new lojax.Request( config );
                    // if it's got a valid action that hasn't already been cached, cache and execute
                    if ( priv.hasValue( request.action ) && !self.cache[request.action] ) {
                        self.cache[request.action] = request;
                        request.exec();
                        lojax.log( 'preloadAsync: request:' ).log( request );
                    }
                } );
            } );
        },
    
        postInject: function(context, source, request) {
            if ( typeof instance.out == 'function' ) {
                $( context )[0].out = instance.out;
                instance.out = null;
            }
            priv.triggerEvent( lojax.events.afterInject, context, source );
            priv.callIn( context, request );
            if ( priv.hasValue( request ) ) {
                context.refresh = request.exec.bind( request );
            }
            instance.loadSrc( context );
            instance.preloadAsync( context );
        },
    
        handleError: function ( response ) {
            priv.triggerEvent( lojax.events.ajaxError, response );
            if ( response.handled ) return;
            var error = [];
            Object.getOwnPropertyNames( response ).forEach( function ( name ) {
                if ( typeof response[name] !== 'function' ) {
                    error.push( response[name] );
                }
            } );
            lojax.log( 'handleError: response: ' ).log( response );
        }
    
    } );
    
    
    /***************\
    private functions
    \***************/
    
    lojax.extend(rexp, {
        search: /\?.+(?=#)|\?.+$/,
        hash: /#((.*)?[a-z]{2}(.*)?)/i
    });
    
    lojax.extend( priv, {
        noop: function () { },
        hasValue: function ( val ) {
            return val !== undefined && val !== null;
        },
        attr: function ( elem, name ) {
            // use attr instead of data function to account for changing attribute values
            return $( elem ).attr( 'data-' + name ) || $( elem ).attr( lojax.config.prefix + name );
        },
        attrSelector: function ( name ) {
            return '[data-' + name + '],[' + lojax.config.prefix + name + ']';
        },
        attributes: 'method action transition target form model preload src'.split( ' ' ),
        getConfig: function ( elem ) {
            var name, config, $this = $( elem );
    
            if ( $this.is( priv.attrSelector( 'request' ) ) ) {
                config = JSON.parse( priv.attr( $this, 'request' ).replace( /'/g, '"' ) );
            }
            else {
                // don't use the data() function to retrieve request configurations
                // if attributes are changed, the data function won't pick it up
                config = {};
    
                priv.attributes.forEach( function ( attr ) {
                    var val = priv.attr( $this, attr );
                    if ( val !== undefined ) {
                        config[attr] = val;
                    }
                } );
            }
    
            config.source = elem;
    
            return config;
        },
        resolveAction: function ( params ) {
            var action;
            // if there's an action in the params, return it
            if ( priv.hasValue( params.action ) && params.action.length ) {
                action = params.action;
            }
                // check for a valid href
            else if ( priv.hasValue( params.source )
                && priv.hasValue( params.source.href )
                && params.source.href.length
                && params.source.href.substr( 0, 11 ) !== 'javascript:' ) {
                action = params.source.href;
            }
                // if this is a submit button check for a form
            else if ( $( params.source ).is( '[type=submit]' ) ) {
                var closest = $( params.source ).closest( 'form,' + priv.attrSelector( 'model' ) );
                // is submit button inside a form?
                if ( closest.is( 'form' ) ) {
                    // post to form.action or current page
                    action = closest.attr( 'action' ) || window.location.href;
                }
            }
                // if this is a form use form.action or current page
            else if ( $( params.source ).is( 'form' ) ) {
                action = $( params.source ).attr( 'action' ) || window.location.href;
            }
    
            if ( params.method === 'ajax-get' && priv.hasHash( action ) ) {
                action = priv.resolveHash( action );
                params.isNavHistory = true;
            }
    
            return action;
        },
        resolveHash: function ( url ) {
            url = url || window.location.href;
            if ( priv.hasHash( url ) ) {
                return url.substr( url.indexOf( '#' ) + 1 );
            }
            return url;
        },
        resolveForm: function ( params ) {
            var closest;
            // use the jQuery selector if present
            if ( priv.hasValue( params.form ) ) {
                // account for selectors that either select a top element with inputs inside (e.g. 'form')
                // or that select specific input elements (e.g. '#div1 [name]')
                // or both (e.g. 'form,#div1 [name]')
                return $( params.form ).find( ':input' ).add( $( params.form ).filter( ':input' ) );
            }
            // only a submit button can submit an enclosing form
            if ( $( params.source ).is( '[type=submit]' ) ) {
                closest = $( params.source ).closest( 'form,' + lojax.select.model );
                if ( closest.is( 'form' ) ) {
                    return closest;
                }
            }
            // check for a form or a single named input with a trigger
            if ( $( params.source ).is( 'form' )
                || $( params.source ).is( lojax.select.inputTriggerChangeOrEnter ) ) {
                return params.source;
            }
            return null;
        },
        resolveTarget: function ( params ) {
            if ( priv.hasValue( params.target ) ) {
                return $( params.target );
            }
            return null;
        },
        resolveTransition: function ( request, target ) {
            // check for a transition in the request first
            if ( request.transition ) {
                return lojax.Transitions[request.transition] || lojax.Transitions[lojax.config.transition];
            }
            else {
                // check for a transition on the target
                return lojax.Transitions[priv.attr( target, 'transition' )] || lojax.Transitions[lojax.config.transition];
            }
        },
        formFromInputs: function ( forms, action, method ) {
            // Trying to use jQuery's clone function here fails for select elements.
            // The clone function doesn't preserve select element values.
            // So copy everything manually instead.
            if ( $( forms ).length ) {
                action = action || window.location.href;
                method = method || 'POST';
                var form = $( "<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>" );
                var inputs = $( forms ).serializeArray();
                inputs.forEach( function ( input ) {
                    $( "<input type='hidden' />" ).appendTo( form ).prop( 'name', input.name ).val( input.value );
                } );
                return form;
            }
            return forms;
        },
        triggerEvent: function ( name, arg, src ) {
            try {
                $.event.trigger( {
                    type: name,
                    source: src || arg
                }, arg );
            }
            catch ( ex ) {
                if ( console && console.error ) {
                    console.error( ex );
                }
            }
        },
        beforeRequest: function ( arg, suppress ) {
            if ( !suppress ) priv.triggerEvent( lojax.events.beforeRequest, arg );
        },
        afterRequest: function ( arg, suppress ) {
            if ( !suppress ) priv.triggerEvent( lojax.events.afterRequest, arg );
        },
        hasHash: function ( url ) {
            url = url || window.location.href;
            return rexp.hash.test( url );
        },
        standardDateFormat: function ( date ) {
            if ( !priv.hasValue( date ) || date == '' ) return date;
            if ( typeof date === 'string' ) {
                return date.substring( 0, 10 );
            }
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var d = date.getDate();
            var out = [];
            out.push( y );
            out.push( '-' );
            if ( m < 10 )
                out.push( '0' );
            out.push( m );
            out.push( '-' );
            if ( d < 10 )
                out.push( '0' );
            out.push( d );
            return out.join( '' );
        },
        callIn: function ( panel, context ) {
            if ( panel && instance.in ) {
                instance.in.call( panel, context );
            }
            // ensure in is called only once
            // and that calls to lojax.in outside of a container are ignored
            instance.in = null;
        },
        callOut: function ( panel ) {
            if ( panel && typeof panel[0].out == 'function' ) {
                panel[0].out.call( panel );
                panel[0].out = null;
            }
        },
        nonce: jQuery.now(),
        noCache: function ( url ) {
            var a = ( url.indexOf( '?' ) != -1 ? '&_=' : '?_=' ) + priv.nonce++;
            var s = url.match( /\?.+(?=#)|\?.+$|.+(?=#)|.+/ );
            return url.replace( s, s + a );
        }
    
    } );
    
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
        if (priv.resolveModel) this.model = priv.resolveModel( obj );
        this.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
        this.transition = obj.transition;
        this.target = priv.resolveTarget( obj );
        this.data = this.getData( obj );
        this.source = obj.source;
        this.preload = 'preload' in obj;
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
    
    
    /***********\
     Transitions
    \***********/
    
    lojax.extend( lojax.Transitions, {
    
        'swap-content': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.empty().append( $new.contents() );
            return $old;
        },
        'fade-in': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.fadeOut( 0 ).empty().append( $new.contents() ).fadeIn();
            return $old;
        },
        'replace': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.replaceWith( $new );
            return $new;
        },
        'append': function ( oldNode, newNode ) {
            // useful for endless scrolling
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.append( $new );
            return $new;
        },
        'prepend': function ( oldNode, newNode ) {
            // useful for adding new rows to tables
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.prepend( $new );
            return $new;
        }
    
    } );
	
	/***********\
	json modeling
	\***********/
	
	// bind an element to a JSON model
	lojax.bind = function ( elem, model ) {
	    var $elem = $( elem );
	    $elem.data( 'model', model );
	    priv.setElementsFromModel( $elem, model );
	    return model;
	};
	
	lojax.bindAllModels = function ( context ) {
	    modeler.bindToModels(null, context);
	};
	
	lojax.extend( rexp, {
	    segments: /[^\[\]\.\s]+|\[\d+\]/g,
	    indexer: /\[\d+\]/,
	    json: /^\{.*\}$|^\[.*\]$/
	} );
	
	var modeler = {
	
	    init: function () {
	        modeler.bindToModels();
	        $( document )
	            .off( 'change', lojax.select.model, modeler.updateModel )
	            .off( lojax.events.afterInject, modeler.bindToModels );
	        $( document )
	            .on( 'change', lojax.select.model, modeler.updateModel )
	            .on( lojax.events.afterInject, modeler.bindToModels );
	    },
	    bindToModels: function ( evt, context ) {
	        context = context || document;
	        var $this, models = [];
	        var dataModels = $( context ).find( lojax.select.model ).add( context ).filter( lojax.select.model );
	
	        lojax.log( 'bindToModels: dataModels:' ).log( dataModels );
	
	        // iterate over the models in context
	        dataModels.each( function () {
	            $this = $( this );
	            // grab the data-model
	            model = priv.getModel( $this );
	            if ( !priv.hasValue( model ) || model === '' ) {
	                // empty model, so create one from its inputs
	                model = priv.buildModelFromElements( $this );
	            }
	            else {
	                priv.setElementsFromModel( $this, model );
	            }
	            $this.data( 'model', model );
	            lojax.log( 'bindToModels: model:' ).log( model );
	        } );
	    },
	
	    updateModel: function ( evt ) {
	        var name = evt.target.name;
	        if ( !priv.hasValue( name ) || name == '' ) return;
	        // model's change handler 
	        // provides simple one-way binding from HTML elements to a model
	        // 'this' is the element with jx-model attribute
	        var $this = $( this );
	        // $target is the element that triggered the change event
	        var $target = $( evt.target );
	        var model = priv.getModel( $this );
	        var elems = $this.find( '[name="' + name + '"]' );
	
	        var o = {
	            target: evt.target,
	            name: name,
	            value: $target.val(),
	            model: model,
	            cancel: false
	        };
	
	        lojax.log( 'updateModel: o:' ).log( o );
	
	        priv.triggerEvent( lojax.events.beforeUpdateModel, o, $this );
	        if ( o.cancel ) return;
	
	        lojax.log( 'updateModel: o.model: before:' ).log( o.model );
	
	        priv.setModelProperty( $this, o.model, elems );
	        // TODO: set an isDirty flag without corrupting the model
	        // maybe use a wrapper class to observe the model
	        priv.triggerEvent( lojax.events.afterUpdateModel, o, $this );
	
	        lojax.log( 'updateModel: o.model: after:' ).log( o.model );
	
	        priv.propagateChange( model, $target );
	    }
	};
	
	
	lojax.extend( lojax.priv, {
	
	    getModel: function ( elem ) {
	        var $elem = $( elem );
	        var model = $elem.data( 'model' );
	        if ( !priv.hasValue( model ) && $( elem ).is( lojax.select.jxModelAttribute ) ) {
	            model = $elem.attr( lojax.select.jxModel );
	
	            if ( !model ) return null;
	
	            if ( priv.isJSON( model ) ) {
	                model = JSON.parse( model );
	            }
	            else {
	                // it's a URL, create a new request
	                model = new lojax.Request( {
	                    action: model,
	                    method: 'ajax-get'
	                } );
	            }
	            // store model in jQuery's data object
	            // reference it there from now on
	            $elem.data( 'model', model );
	        }
	        return model;
	    },
	    resolveModel: function ( params ) {
	        lojax.log( 'resolveModel: params:' ).log( params );
	        var closest, model;
	        if ( priv.hasValue( params.model ) ) model = params.model;
	
	        else if ( priv.hasValue( params.source ) && $( params.source ).is( lojax.select.model ) ) {
	            model = priv.getModel( params.source );
	        }
	
	            // only a submit button can submit an enclosing model
	        else if ( $( params.source ).is( 'input[type=submit],button[type=submit]' ) ) {
	            // don't return anything if closest is form
	            closest = $( params.source ).closest( 'form,' + lojax.select.model );
	            if ( closest.is( lojax.select.model ) ) {
	                model = priv.getModel( closest );
	            }
	        }
	
	        if ( typeof model === 'string' && model.length ) {
	            if ( priv.isJSON( model ) ) {
	                model = JSON.parse( model );
	            }
	            else {
	                // it's a URL, create a new request
	                model = new lojax.Request( {
	                    action: model,
	                    method: 'ajax-get'
	                } );
	            }
	        }
	
	        if ( params.source && model ) {
	            // store model in jQuery's data object
	            // reference it there from now on
	            $( params.source ).data( 'model', model );
	        }
	
	        return model;
	    },
	    formFromModel: function ( model, method, action, rootName, form ) {
	        var t, i, props, name;
	
	        lojax.log( 'formFromModel: model:' ).log( model );
	
	        if ( !priv.hasValue( form ) ) {
	            // first time through
	            method = method || 'POST';
	            action = action || window.location.href;
	            form = $( "<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>" );
	            rootName = '';
	        }
	
	        // this is a recursive function
	        // so we have to detect the type on every iteration
	        t = $.type( model );
	        switch ( t ) {
	            case 'null':
	            case 'undefined':
	                $( "<input type='hidden' />" ).appendTo( form ).prop( 'name', rootName );
	                break;
	            case 'date':
	                $( "<input type='hidden' />" ).appendTo( form ).prop( 'name', rootName ).val( model.toISOString() );
	                break;
	            case 'array':
	                model.forEach( function ( item ) {
	                    priv.formFromModel( item, method, action, rootName, form );
	                } );
	                break;
	            case 'object':
	                props = Object.getOwnPropertyNames( model );
	                props.forEach( function ( prop ) {
	                    name = rootName === '' ? prop : rootName + '.' + prop;
	                    priv.formFromModel( model[prop], method, action, name, form );
	                } );
	                break;
	            default:
	                $( "<input type='hidden' />" ).appendTo( form ).prop( 'name', rootName ).val( model.toString() );
	        }
	        return form;
	    },
	    getPathSegments: function ( path ) {
	        return path.match( rexp.segments );
	    },
	    resolvePathSegment: function ( segment ) {
	        // is this segment an array index?
	        if ( rexp.indexer.test( segment ) ) {
	            return parseInt( /\d+/.exec( segment ) );
	        }
	        return segment;
	    },
	    getObjectAtPath: function ( root, path, forceArray ) {
	        // o is our placeholder
	        var o = root, segment, paths = Array.isArray( path ) ? path : priv.getPathSegments( path );
	
	        for ( var i = 0; i < paths.length; i++ ) {
	            segment = priv.resolvePathSegment( paths[i] );
	
	            // don't overwrite previously defined properties
	            if ( o[segment] === undefined ) {
	                // if it's not the last one, we need to look ahead to see if this is supposed to be an array
	                if ( i < paths.length - 1 && rexp.indexer.test( paths[i + 1] ) ) {
	                    o[segment] = [];
	                }
	                else if ( i === paths.length - 1 && forceArray ) {
	                    // forceArray is for arrays of varying length (list of checkboxes)
	                    o[segment] = [];
	                }
	                else if ( i < paths.length - 1 ) {
	                    // if it's not the last one, create an object for the next iteration
	                    o[segment] = {};
	                }
	                else {
	                    // last one, set to null
	                    o[segment] = null;
	                }
	            }
	
	            // 3 possibilities:
	            // 1: last segment is a property name
	            // 2: last segment is an array index
	            // 3: last segment is an array
	
	            // we don't want to return the first two
	            // so if this is the last one and it's a property name or array index then return early
	            // else keep going
	            if ( i === paths.length - 1 && ( rexp.indexer.test( segment ) || Array.isArray( o[segment] ) === false ) ) {
	                return o;
	            }
	
	            o = o[segment];
	        }
	
	        return o;
	    },
	    setModelProperty: function ( context, model, elems ) {
	        var obj,
	            prop,
	            type,
	            val,
	            segments;
	
	        lojax.log( 'setModelProperty: elems.length:' ).log( elems.length );
	
	        // derive an object path from the input name
	        segments = priv.getPathSegments( $( elems ).attr( 'name' ) );
	
	        // get the raw value
	        val = priv.getValue( elems );
	
	        lojax.log( 'setModelProperty: val:' ).log( val );
	
	        // grab the object we're setting
	        obj = priv.getObjectAtPath( model, segments, Array.isArray( val ) );
	
	        // grab the object property
	        prop = priv.resolvePathSegment( segments[segments.length - 1] );
	
	        // attempt to resolve the data type in the model
	        // if we can't get a type from the model
	        // rely on the server to resolve it
	        if ( prop in obj ) {
	            type = $.type( obj[prop] );
	        }
	        else if ( Array.isArray( obj ) && obj.length ) {
	            type = $.type( obj[0] );
	        }
	
	        // cast the raw value to the appropriate type
	        val = priv.castValues( val, type );
	
	        if ( Array.isArray( val ) && Array.isArray( obj ) ) {
	            // preserve the object reference in case it's referenced elsewhere
	            // clear out the array and repopulate it
	            obj.splice( 0, obj.length );
	            val.forEach( function ( v ) {
	                obj.push( v );
	            } );
	        }
	        else {
	            obj[prop] = val;
	        }
	    },
	    buildModelFromElements: function ( context ) {
	        var model = {};
	
	        lojax.log( 'buildModelFromElements: context:' ).log( context );
	
	        // there may be multiple elements with the same name
	        // so build a dictionary of names and elements
	        var names = {};
	        var elems = $( context ).find( '[name]' );
	        elems.each( function () {
	            var name = $( this ).attr( 'name' );
	            if ( !( name in names ) ) {
	                names[name] = $( context ).find( '[name="' + name + '"]' );
	            }
	        } );
	
	        Object.getOwnPropertyNames( names ).forEach( function ( name ) {
	            priv.setModelProperty( context, model, names[name] );
	        } );
	
	        lojax.log( 'buildModelFromElements: model:' ).log( model );
	
	        return model;
	    },
	    setElementsFromModel: function ( context, model ) {
	        var value,
	            type,
	            name,
	            $this = $( context );
	
	        lojax.log( 'setELementsFromModel: model:' ).log( model );
	
	        // set the inputs to the model
	        $this.find( '[name]' ).each( function () {
	            name = this.name || $( this ).attr( 'name' );
	            value = priv.getModelValue( model, name );
	            type = $.type( value );
	            // lojax assumes ISO 8601 date serialization format
	            // ISO 8601 is easy to parse
	            // making it possible to skip the problem of converting 
	            // date strings to Date objects and back again in most cases
	            if ( type === 'date' && this.type === 'date' ) {
	                // date inputs expect yyyy-MM-dd
	                // keep in mind that some browsers (e.g. IE9) don't support the date input type
	                $( this ).val( priv.standardDateFormat( value ) );
	            }
	            else if ( type === 'boolean' && this.type === 'checkbox' ) {
	                this.checked = value;
	            }
	            else if ( this.type === 'radio' ) {
	                this.checked = ( this.value == value );
	            }
	            else if ( this.value !== undefined ) {
	                $( this ).val( value );
	            }
	            else if ( this.innerHTML !== undefined ) {
	                $( this ).html( value == null ? '' : value.toString() );
	            }
	        } );
	    },
	    getModelValue: function ( root, path ) {
	        var obj,
	            segments = priv.getPathSegments( path ),
	            prop = priv.resolvePathSegment( segments[segments.length - 1] );
	
	        try {
	            obj = priv.getObjectAtPath( root, segments );
	            if ( obj[prop] !== undefined )
	                return obj[prop];
	            return obj;
	        }
	        catch ( err ) {
	            if ( console && console.error ) {
	                console.error( 'Could not resolve object path: ' + path );
	                console.error( err );
	            }
	        }
	    },
	    getValue: function ( elems ) {
	        if ( elems.length === 0 ) return null;
	        var val;
	        var type = elems[0].type;
	        // it's supposed to be an array if they're all the same type and they're not radios
	        var isArray = elems.length > 1
	            && type !== 'radio'
	            && elems.filter( '[type="' + type + '"]' ).length === elems.length;
	        if ( type === 'checkbox' ) {
	            if ( isArray ) {
	                // this will only include checked boxes
	                val = elems.serializeArray().map( function ( nv ) { return nv.value; } );
	            }
	            else {
	                // this returns the checkbox value, not whether it's checked
	                val = elems.val();
	                // check for boolean, otherwise return val if it's checked, null if not checked
	                if ( val.toLowerCase() == 'true' ) val = ( elems[0].checked ).toString();
	                else if ( val.toLowerCase() == 'false' ) val = ( !elems[0].checked ).toString();
	                else val = elems[0].checked ? val : null;
	            }
	        }
	        else if ( type === 'radio' ) {
	            val = elems.serializeArray()[0].value;
	        }
	        else {
	            val = ( isArray ) ? elems.serializeArray().map( function ( nv ) { return nv.value; } ) : elems.val();
	        }
	        if ( !isArray && val === '' ) return null;
	        return val;
	    },
	    castValues: function ( val, type ) {
	        var isArray = Array.isArray( val );
	        var arr = isArray ? val : [val];
	        switch ( type ) {
	            case 'number':
	                arr = arr.filter( $.isNumeric ).map( parseFloat );
	                break;
	            case 'boolean':
	                arr = arr.map( function ( v ) {
	                    return v.toLowerCase() == 'true';
	                } );
	                break;
	            case 'null':
	            case 'undefined':
	                arr = arr.map( function ( v ) {
	                    if ( /true|false/i.test( v ) ) {
	                        // assume boolean
	                        return v.toLowerCase() === 'true';
	                    }
	                    return v === '' ? null : v;
	                } );
	                break;
	            default:
	                arr = arr.map( function ( v ) {
	                    return v === '' ? null : v;
	                } );
	                break;
	        }
	        return isArray ? arr : arr[0];
	    },
	    propagateChange: function ( model, elem ) {
	        var $e = $( elem );
	        var closest = $e.closest( lojax.select.model );
	        // find elements that are bound to the same model
	        $( document ).find( lojax.select.model ).not( closest ).each( function () {
	            var m = $( this ).data( 'model' );
	            if ( m === model ) {
	                priv.setElementsFromModel( this, model );
	            }
	        } );
	    },
	    isJSON: function ( str ) {
	        return rexp.json.test( str );
	    },
	
	} );
	
	$( modeler.init );

	lojax.Controller.init();

})(jQuery, lojax);

