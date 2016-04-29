
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
            self.div = $( "<div style='display:none'></div>" ).appendTo( 'body' );

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
            .on( 'keydown', this.handleControlKey ).on( 'keyup', this.handleControlKey )
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
        if ( arg.eventType == 'click' ) priv.disable( arg.source, 30 );
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
            jx.error( ex );
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

        if ( !jx.config.navHistory ) return;

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
        else if ( hash === '' && jx.emptyHashAction ) {
            // we got here because a browser navigation button 
            // was clicked which changed the hash to an empty string
            // so execute the configured action if present, else do nothing
            instance.executeRequest( jx.emptyHashAction );
        }
    },

    executeRequest: function ( request ) {

        if ( !( request instanceof jx.Request ) ) {
            request = new jx.Request( request );
        }

        jx.log( 'executeRequest: request: ' , request );

        // no action? we're done here
        if ( request.action === null ) return;

        // check for caching
        if ( request.action in this.cache ) {
            request = this.cache[request.action];
            delete this.cache[request.action];
            jx.info( 'executeRequest: retrieved from cache' );
        }
        else {
            request.exec();
        }

        request
            .then( function ( response ) {
                instance.injectContent( request, response );
                // if the request has a poll interval, handle it after the request has been successfully processed
                instance.handlePolling( request );
                priv.enable( $( request.source ) );
            } )
            .catch( function ( e ) {
                priv.enable( $( request.source ) );
                instance.handleError( e, request );
            } );
    },

    injectContent: function ( request, response ) {
        var id, target, transition, $node, result, root;

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

                // don't create more than one modal at a time
                if ( $node.is( '.modal' ) ) {
                    if ( instance.modal !== null ) {
                        // set the root to the current modal so its panels will be replaced
                        root = instance.modal;
                    }
                    else {
                        instance.createModal( $node, request );
                        continue;
                    }
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

    createModal: function ( content, request ) {
        // injectContent delegates modals here

        jx.info( 'createModal.content', content );

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
            instance.modal.find( '.modal-header' ).remove();
            instance.modal.data( 'kendoWindow' ).center();
            instance.modal.closest( '.k-window' ).css( { top: '20px', position: 'fixed' } );
            instance.modal.data( 'kendoWindow' ).open();
            // attach this handler to the top element in case the footer is replaced
            instance.modal.one( 'click', '[data-dismiss=modal]', function () {
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
        var self = this, config, request;
        root = root || document;
        // do this after everything else
        setTimeout( function () {
            // find elements that are supposed to be pre-loaded
            $( root ).find( jx.select.preload ).each( function () {
                config = priv.getConfig( this );
                config.method = config.method || 'ajax-get';
                config.suppressEvents = true;
                request = new jx.Request( config );
                // if it's got a valid action that hasn't already been cached, cache and execute
                if ( priv.hasValue( request.action ) && !self.cache[request.action] ) {
                    self.cache[request.action] = request;
                    request.exec();
                    jx.info( 'preloadAsync: request:' , request );
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
            && /^(4\d\d|5\d\d)/.test( response.status )
            && /401|403|407/.test( response.status ) == false ) {
            if ( !request || !request.suppressEvents ) {
                alert( 'An error occurred while processing your request.' );
            }
            if ( window.console && window.console.error ) window.console.error( response );
        }
    }

} );

