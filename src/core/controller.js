
/***********\
 Controller
\***********/

$.extend( jx.Controller, {

    init: function () {
        var self = this;
        this.div = null;
        this.modal = null;
        this.currentTransition = null;
        this.currentPanel = null;
        this.cache = {};
        this.isControl = false;

        $( function () {
            self.div = $( '<div style="display:none"></div>' ).appendTo( 'body' );

            self.removeHandlers();
            self.addHandlers();
            self.loadSrc();
            self.preloadAsync();

            // check window.location.hash for valid hash
            if ( jx.config.navHistory && priv.hasHash() ) {
                setTimeout( self.handleHash );
            }
        } );
    },

    addHandlers: function () {
        $( document )
            .on( 'click', jx.select.methodOrRequest, this.handleRequest )
            .on( 'change', jx.select.methodWithChange, this.handleRequest )
            // allows executing a request on a single input element without wrapping it in a form (e.g. data-trigger="change enter")
            // also submits an element with a model attribute if enter key is pressed
            .on( 'keydown', jx.select.methodWithEnterOrModel, this.handleEnterKey )
            .on( 'submit', jx.select.formWithMethod, this.handleRequest )
            // handle the control key
            .on( 'keydown', this.handleControlKey )
            .on( 'keyup', this.handleControlKey )
            .on( lojax.events.beforeRequest, this.disableButton )
            .on( lojax.events.afterRequest, this.enableButton );
        if ( jx.config.navHistory ) {
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
            .off( 'keyup', this.handleControlKey )
            .off( lojax.events.beforeRequest, this.disableButton )
            .off( lojax.events.afterRequest, this.enableButton );
        if ( jx.config.navHistory ) {
            window.removeEventListener( "hashchange", this.handleHash, false );
        }
    },

    disableButton: function ( evt, arg ) {
        // prevent users from double-clicking, timeout of 30 seconds
        if ( arg.eventType == 'click' ) {
            priv.disable( arg.source, 30 )
            $( arg.source ).addClass( 'busy' );
        };
    },

    enableButton: function ( evt, arg ) {
        priv.enable( arg.source );
    },

    handleRequest: function ( evt ) {
        evt.stopPropagation();

        // handles click, change, submit, keydown (enter)
        // 'this' will be the element that was clicked, changed, submitted or keydowned
        var params = priv.getConfig( this ),
            $this = $( this );

        // preserve the event type so we can disable buttons
        params.eventType = evt.type;

        var request = new jx.Request( params );

        try {
            // delegate hashes to handleHash
            if ( request.isNavHistory ) {

                // if the control key is down and this is a hash url, let the browser handle it
                if ( instance.isControl ) {
                    priv.enable( $this );
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
            priv.enable( $this );
            priv.error( ex );
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
        // grab the current hash and request it with ajax-get
        var handler, request, hash = window.location.hash;

        // ignore the hash change if navHistory is not turned on
        if ( !jx.config.navHistory ) return;

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
        else if ( hash === '' && jx.emptyHashAction ) {
            // we got here because a browser navigation button
            // was clicked which changed the hash to an empty string
            // so execute the configured action if present, else do nothing
            instance.executeRequest( jx.emptyHashAction );
        }
    },

    executeRequest: function ( request ) {
        var req,
            copyProps;

        if ( !( request instanceof jx.Request ) ) {
            request = new jx.Request( request );
        }

        // no action? we're done here
        // this check must be done after the Request constructor executes priv.resolveAction
        if ( request.action === null ) return;

        // check for caching
        if ( request.action in this.cache ) {
            req = this.cache[request.action];
            // copy properties that were likely not included in the preloaded version
            copyProps = 'isNavHistory transition source before callbacks suppressEvents eventType'.split( ' ' );
            copyProps.forEach( function ( prop ) {
                req[prop] = req[prop] || request[prop];
            } );
            delete this.cache[req.action];
        }
        else {
            req = request;
            // if we got here by through lojax.exec
            // the source won't be disabled by the event handlers
            if ( req.source && $( req.source ).is( ':button,a' ) ) {
                priv.disable( req.source, 30 );
            }
            request.exec();
        }

        req
            .then( function ( response ) {
                instance.injectContent( req, response );
                // if the request has a poll interval, handle it after the request has been processed
                instance.handlePolling( req );
                priv.enable( $( req.source ) );
            } )
            .catch( function ( e ) {
                priv.enable( $( req.source ) );
                if ( typeof req.callbacks['catch'] !== 'function' ) {
                    instance.handleError( e, req );
                }
                // handle polling even if there was an error
                instance.handlePolling( req );
            } )
            .then( req.callbacks.then, req.callbacks['catch'] );
    },

    injectContent: function ( request, response ) {
        var id, target, transition, $node, result, root, handled;

        // ensure any loose calls to jx.in are ignored
        instance.in = null;

        var swapPanel = function ( panel, root ) {
            root = root || document;
            var node = $( panel );
            // match up with panels on the page
            id = priv.attr( node, 'panel' );
            target = request.target || $( root ).find( jx.select.panel( id ) ).first();

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
            swapPanel( $( response ) );
        }
        else {
            // create a list of nodes from the response
            var nodes = $.parseHTML( response, true );

            if ( !nodes ) return;

            for ( var i = 0; i < nodes.length; i++ ) {
                $node = $( nodes[i] );

                root = document;

                priv.triggerEvent( jx.events.beforeInject, nodes, $node );

                // check for a handler module
                handled = this.checkForModule( $node, request );

                if ( handled ) {
                    continue;
                }

                // find all the panels in the new content
                if ( request.target || $node.is( priv.attrSelector( 'panel' ) ) ) {
                    swapPanel( $node, root );
                }
                else {
                    // iterate through the panels
                    $( nodes[i] ).find( priv.attrSelector( 'panel' ) ).each( function () {
                        swapPanel( this, root );
                    } );
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

    checkForModule: function(node, request) {
        var module;
        for ( var i = 0; i < jx.modules.length; i++ ) {
            if ( jx.modules[i]( node, request ) ) {
                return true;
            }
        }
        return false;
    },

    // an AJAX alternative to iframes
    loadSrc: function ( root ) {
        root = root || document;
        $( root ).find( jx.select.src ).each( function () {
            var $this = $( this );
            var url = priv.attr( $this, 'src' );
            var config = priv.getConfig( $this );
            config.action = priv.noCache( config.src );
            config.method = config.method || 'ajax-get';
            config.target = $this;
            config.transition = config.transition || 'empty-append-node';
            config.suppressEvents = true;
            instance.executeRequest( config );
        } );
    },

    preloadAsync: function ( root ) {
        // do this after everything else
        setTimeout( function () {
            var config, requests = [];
            root = root || document;
            // find elements that are supposed to be pre-loaded
            $( root ).find( jx.select.preload ).each( function () {
                config = priv.getConfig( this );
                config.method = config.method || 'ajax-get';
                config.suppressEvents = true;
                requests.push( config );
            } );
            if ( requests.length ) {
                jx.preload( requests );
            }
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
        priv.triggerEvent( jx.events.afterInject, context, source );
        priv.callIn( context, request );
        if ( priv.hasValue( request ) ) {
            context.refresh = request.exec.bind( request );
        }
        instance.loadSrc( context );
        instance.preloadAsync( context );
    },

    handleError: function ( response, request ) {
        priv.triggerEvent( jx.events.ajaxError, response );
        if ( response.handled ) return;
        // filter out authentication errors, those are usually handled by the browser
        if ( response.status
            && (/^(4\d\d|5\d\d)/).test( response.status )
            && (/401|403|407/).test( response.status ) == false ) {
            if ( !request || !request.suppressEvents ) {
                alert( 'An error occurred while processing your request.' );
            }
            priv.error( response );
        }
    }

} );

