
/***********\
 Controller
\***********/

lojax.Controller = function () {
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
        self.bindToModels();
        self.preloadAsync();

        // check window.location.hash for valid hash
        if ( priv.hasHash() ) {
            setTimeout( self.handleHash );
        }
    } );
};

lojax.Controller.prototype = {

    addHandlers: function() {
        $( document )
            .on( 'click', lojax.select.methodOrRequest, this.handleRequest )
            .on( 'change', lojax.select.methodWithChange, this.handleRequest )
            // allows executing a request on a single input element without wrapping it in a form (e.g. data-trigger="change enter")
            // also submits an element with a model attribute if enter key is pressed
            .on( 'keydown', lojax.select.methodWithEnterOrModel, this.handleEnterKey )
            .on( 'submit', lojax.select.formWithMethod, this.handleRequest )
            .on( 'change', lojax.select.model, this.updateModel )
            // handle the control key
            .on( 'keydown', this.handleControlKey ).on( 'keyup', this.handleControlKey );
        if ( lojax.config.navHistory  ) {
            window.addEventListener( "hashchange", this.handleHash, false );
        }
    },

    removeHandlers: function() {
        $( document )
            .off( 'click', this.handleRequest )
            .off( 'change', this.handleRequest )
            .off( 'keydown', this.handleEnterKey )
            .off( 'submit', this.handleRequest )
            .off( 'change', this.updateModel )
            .off( 'keydown', this.handleControlKey )
            .off( 'keyup', this.handleControlKey );
        if ( lojax.config.navHistory  ) {
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

        if ( !lojax.config.navHistory  ) return;

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

    bindToModels: function ( context ) {
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
    },

    injectContent: function ( request, response ) {
        var id, target, newModal, transition, $node, result;

        // empty response?
        if ( !priv.hasValue( response ) ) return;

        // ensure any loose calls to lojax.onLoad are ignored
        instance.onLoad = null;

        var doPanel = function () {
            var node = $( this );
            // match up with panels on the page
            id = priv.attr( node, 'panel' );
            target = request.target || $( lojax.select.panel( id ) ).first();

            if ( target.length ) {

                lojax.log( 'injectContent: data-panel: ' + id );
                transition = priv.resolveTransition( request, node );
                priv.callOnUnload( target );
                result = transition( target, node );
                if ( priv.hasValue( request ) ) {
                    result.refresh = request.exec.bind( request );
                }
                priv.triggerEvent( lojax.events.afterInject, result, node );
                instance.bindToModels( result );
                if ( typeof instance.onUnload == 'function' ) {
                    $( result )[0].onUnload = instance.onUnload;
                    instance.onUnload = null;
                }
                priv.callOnLoad( result, request );
                instance.loadSrc( result );
                instance.preloadAsync( result );
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
                if ( request.target || $node.is( priv.attrSelector('panel') ) ) {
                    doPanel.call( $node );
                }
                else {
                    // iterate through the panels
                    $( nodes[i] ).find( priv.attrSelector('panel') ).each( doPanel );
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
            instance.bindToModels( instance.modal );
            priv.callOnLoad( instance.modal, request );
            instance.loadSrc( instance.modal );
            instance.preloadAsync( instance.modal );
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
                if ( priv.hasValue( request.action ) && !self.cache[ request.action ] ) {
                    self.cache[request.action] = request;
                    request.exec();
                    lojax.log( 'preloadAsync: request:' ).log( request );
                }
            } );
        } );
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

};

