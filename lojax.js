
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
        instance.in = callback;
    };
    
    lojax.out = function ( callback ) {
        instance.out = callback;
    };
    
    lojax.closeModal = function () {
        if ( priv.hasValue( instance.modal ) ) {
            if ( $.fn.modal ) {
                instance.modal.modal( 'hide' );
            }
            else if ( $.fn.kendoWindow ) {
                instance.modal.data( 'kendoWindow' ).close();
            }
            instance.modal = null;
        }
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
    
    
            var request = new lojax.Request( params );
    
    
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
    
    
            if ( !lojax.config.navHistory ) return;
    
            // grab the current hash and request it with ajax-get
    
            var handler, request, hash = window.location.hash;
    
    
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
    
    
            // no action? we're done here
            if ( request.action === null ) return;
    
            // check for caching
            if ( request.action in this.cache ) {
                request = this.cache[request.action];
                delete this.cache[request.action];
            }
            else {
                request.exec();
            }
    
            request
                .then( function ( response ) {
                    instance.injectContent( request, response );
                    // if the request has a poll interval, handle it after the request has been successfully processed
                    instance.handlePolling( request );
                } )
                .catch( instance.handleError );
        },
    
        injectContent: function ( request, response ) {
            var id, target, newModal, transition, $node, result;
    
            // ensure any loose calls to lojax.in are ignored
            instance.in = null;
    
            var doPanel = function () {
                var node = $( this );
                // match up with panels on the page
                id = priv.attr( node, 'panel' );
                target = request.target || $( lojax.select.panel( id ) ).first();
    
                if ( target.length ) {
    
                    transition = priv.resolveTransition( request, node );
                    priv.callOut( target );
                    // swap out the content
                    result = transition( target, node );
                    // perform post-inject chores
                    instance.postInject( result, node, request );
                }
            };
    
            if ( request.target ) {
                // inject the entire response into the specified target
                doPanel.call( $( response ) );
            }
            else {
                // create a list of nodes from the response
                var nodes = $.parseHTML( response, true );
    
                if ( !nodes ) return;
    
    
                for ( var i = 0; i < nodes.length; i++ ) {
                    $node = $( nodes[i] );
    
                    priv.triggerEvent( lojax.events.beforeInject, nodes, $node );
    
    
                    // don't create more than one modal at a time
                    if ( instance.modal === null && $node.is( '.modal' ) ) {
                        instance.createModal( $node, request );
                        continue;
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
    
                // process any loose script or style nodes
                instance.div.empty();
                nodes.forEach( function ( node ) {
                    $node = $( node );
                    if ( $node.is( 'script,style' ) ) {
                        instance.div.append( $node );
                    }
                } );
            }
        },
    
        createModal: function ( content, request ) {
            // injectContent delegates modals here
    
    
            // check for bootstrap
            if ( $.fn.modal ) {
                instance.modal = $( content ).appendTo( 'body' ).modal( {
                    show: true,
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
                config.transition = config.transition || 'replace-content';
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
                    }
                } );
            } );
        },
    
        handlePolling: function ( request ) {
            // for polling to work, we must have a target and a numeric polling interval greater than 0
            if ( !request.target || !$.isNumeric( request.poll ) || request.poll <= 0 ) return;
    
            // and the target still has to exist on the page
            var target = $( request.target )[0];
            var exists = target.ownerDocument.body.contains( target );
    
            if ( exists ) {
                setTimeout( function () {
                    instance.executeRequest( request );
                }, request.poll * 1000 );
            }
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
        }
    
    } );
    
    
    /***********\
       logging
    \***********/
    
    ( function (context) {
    
        if ( !'logging' in context ) {
            var _logging = 'info';
    
            Object.defineProperty( context, 'logging', {
                get: function () {
                    return _logging;
                },
                set: function ( val ) {
                    if ( val === true ) val = 'info';
                    _logging = val;
                    if ( val && window.console != undefined ) {
                        context.log = console.log.bind( console );
                        context.info = /info/.test( val ) && console.info ? console.info.bind( console ) : function () { };
                        context.warn = /info|warn/.test( val ) && console.warn ? console.warn.bind( console ) : function () { };
                        context.debug = /info|warn|debug/.test( val ) && console.debug ? console.debug.bind( console ) : function () { };
                    }
                    else {
                        context.log = context.info = context.warn = context.debug = function () { };
                    }
                }
            } );
        }
    
        // create context.log
        context.logging = 'info';
    
        context.error = function ( e ) {
            if ( console && console.error ) {
                console.error( e );
            }
        };
    
    } )(lojax);
    
    /***************\
    private functions
    \***************/
    
    lojax.extend(rexp, {
        search: /\?.+(?=#)|\?.+$/,
        hash: /#((.*)?[a-z]{2}(.*)?)/i,
        json: /^\{.*\}$|^\[.*\]$/
    } );
    
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
        attributes: 'method action transition target form model preload src poll'.split( ' ' ),
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
        resolveModel: function ( params ) {
            var closest, model;
            if ( priv.hasValue( params.model ) ) {
                model = params.model;
            }
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
        resolvePoll: function ( params ) {
            if ( $.isNumeric( params.poll ) ) {
                return parseInt( params.poll );
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
        formFromModel: function ( model, method, action, rootName, form ) {
            var t, i, props, name;
    
    
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
        },
        isJSON: function ( str ) {
            return rexp.json.test( str );
        }
    
    } );
    
    /***********\
       Request
    \***********/
    
    lojax.Request = function ( obj ) {
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
    
    
            if ( !priv.hasValue( this.methods[this.method] ) ) throw 'Unsupported method: ' + this.method;
    
            if ( priv.hasValue( this.action ) && this.action !== '' ) {
                priv.beforeRequest( this, this.suppressEvents );
                if ( !this.cancel ) {
                    // execute the method function
                    this.methods[this.method].bind( this )();
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
    
        'replace-content': function ( oldNode, newNode ) {
            // empty->append->new
            // inject newNode into oldNode
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.empty().append( $new );
            return $old;
        },
        'swap-content': function ( oldNode, newNode ) {
            // empty->append->new.contents
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.empty().append( $new.contents() );
            return $old;
        },
        'fade-in': function ( oldNode, newNode ) {
            // fadeOut->empty->append->new.contents->fadeIn
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.fadeOut( 0 ).empty().append( $new.contents() ).fadeIn();
            return $old;
        },
        'replace': function ( oldNode, newNode ) {
            // old.replaceWidth(new)
            // completely replace old node with new node
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.replaceWith( $new );
            return $new;
        },
        'append': function ( oldNode, newNode ) {
            // old.append->new
            // append new node to old node
            // useful for endless scrolling
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.append( $new );
            return $new;
        },
        'prepend': function ( oldNode, newNode ) {
            // old.prepend->new
            // prepend new node to old node
            // useful for adding new rows to tables
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.prepend( $new );
            return $new;
        }
    
    } );

	lojax.Controller.init();

})(jQuery, lojax);

