/***********\
 Controller
\***********/

lojax.Controller = function () {
    var self = this;
    this.div = null;
    this.modal = null;
    this.currentTransition = null;
    this.currentPanel = null;
    this.cache = new lojax.Cache();

    $( function () {
        self.div = $( "<div style='display:none'></div>" ).appendTo( 'body' );
        $( document ).on( 'click', '[data-request],[jx-request],[data-method]:not([data-trigger]),[jx-method]:not([jx-trigger])', self.handleRequest );
        $( document ).on( 'change', '[data-method][data-trigger*=change],[jx-method][jx-trigger*=change]', self.handleRequest );
        $( document ).on( 'keydown', '[data-method][data-trigger*=enter],[jx-method][jx-trigger*=enter]', self.handleEnterKey );
        $( document ).on( 'submit', 'form[data-method],form[jx-method]', self.handleRequest );
        $( document ).on( 'change', '[data-model],[jx-model]', self.updateModel );

        window.addEventListener( "hashchange", self.handleHash, false );

        self.loadDataSrcDivs();
        self.bindToModels();
        self.prefetchAsync();

        if ( priv.hasHash() ) {
            setTimeout( self.handleHash, 0 );
        }
    } );
};

lojax.Controller.prototype = {

    handleRequest: function ( evt ) {
        // handles click, change, submit
        // 'this' will be the element that was clicked, changed, or submitted
        var params = priv.getConfig( this ),
            $this = $( this );

        lojax.log( 'handleRequest: params: ' ).log( params );

        var request = new lojax.Request( params );

        // delegate hashes to handleHash
        if ( priv.hasHash( request.action ) && params.method === 'ajax-get' ) {

            var newHash = request.action.match( rexp.hash )[1];

            if ( request.data ) {
                newHash += '?' + request.data;
            }

            // store the request's transition so handleHash can pick it up
            instance.currentTransition = request.transition;

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

        evt.stopPropagation();

        evt.preventDefault();
    },

    handleHash: function () {
        // grab the current hash and request it with ajax-get

        var handler, request, hash = window.location.hash;

        lojax.log( 'handleHash: hash:' ).log( hash );

        if ( priv.hasHash() ) {

            // If there's no anchor with this name, handle with default settings.
            // We want to support url-only access, and we don't want to clutter 
            // the url with request settings like transition and target. That 
            // means that there must be enough information already in the page 
            // or response (jx-panel) to be able to properly handle the response.
            handler = $( 'a[name="' + hash.substr( 1 ) + '"]' );
            if ( handler.size() === 0 ) {
                instance.executeRequest( {
                    action: hash,
                    method: 'ajax-get',
                    transition: instance.currentTransition
                } );
            }
            instance.currentTransition = null;
        }
        else if ( hash === '' ) {
            // we got here because a browser navigation button 
            // was clicked which changed the hash to nothing
            // so load the current page via ajax
            instance.executeRequest( {
                action: window.location.href,
                method: 'ajax-get'
            } );
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
        if ( request.cache ) {
            if ( this.cache.contains( request.action ) ) {
                request = this.cache.get( request.action );
            }
            else {
                this.cache.add( request );
                request.exec();
            }
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

    handleEnterKey: function ( evt ) {
        if ( evt.which === 13 ) {
            instance.handleRequest.call( this, evt );
        }
    },

    bindToModels: function ( context ) {
        context = context || document;
        var model, $this, models = [];
        var dataModels = $( context ).find( '[data-model],[jx-model]' ).add( context ).filter( '[data-model],[jx-model]' );

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
            models.push( model );
            lojax.log( 'bindToModels: model:' ).log( model );
        } );
        // for testing
        return models;
    },

    updateModel: function ( evt ) {
        // model's change handler 
        // provides simple one-way binding from HTML elements to a model
        // 'this' is the element with data-model|jx-model attribute
        var $this = $( this );
        // $target is the element that triggered change event
        var $target = $( evt.target );
        var model = priv.getModel( $this );
        var name = evt.target.name;
        if ( !priv.hasValue( name ) ) return;
        var elems = $this.find( '[name="' + name + '"]' );

        var o = {
            target: evt.target,
            name: name,
            value: $target.val(),
            type: $.type( model[name] ),
            model: model,
            cancel: false
        };

        lojax.log( 'updateModel: o:' ).log( o );

        priv.triggerEvent( lojax.events.beforeUpdateModel, o, $this );
        if ( o.cancel ) return;

        lojax.log( 'updateModel: o.model' ).log( o.model );

        priv.setModelProperty( $this, o.model, elems );
        // TODO: set an isDirty flag without corrupting the model
        // maybe use a wrapper class to observe the model
        priv.triggerEvent( lojax.events.afterUpdateModel, o, $this );

        lojax.log( 'updateModel: afterUpdateModel raised' );

    },

    injectContent: function ( request, response ) {
        var id, target, newModal, transition, $node, result;
        // create a list of nodes from the response
        var nodes = $.parseHTML( response, true );
        lojax.log( 'injectContent: nodes:' ).log( nodes );

        // empty response?
        if ( nodes === null ) return;

        var doPanel = function () {
            var node = $( this );
            // match up with panels on the page
            id = node.attr( 'jx-panel' );
            target = request.target || $( '[jx-panel="' + id + '"]' );

            if ( target.size() > 0 ) {
                lojax.log( 'injectContent: jx-panel: ' + id );
                transition = priv.resolveTransition( request, node );
                result = transition( target, node );
                if ( priv.hasValue( request ) ) {
                    result.refresh = request.exec.bind( request );
                }
                priv.triggerEvent( lojax.events.afterInject, result, node );
                instance.bindToModels( result );
                priv.callIn( result );
                instance.loadDataSrcDivs( result );
                instance.prefetchAsync( result );
            }
        };

        // ensure any loose calls to lojax.in are ignored
        instance.in = null;

        for ( var i = 0; i < nodes.length; i++ ) {
            $node = $( nodes[i] );

            priv.triggerEvent( lojax.events.beforeInject, nodes, $node );

            // don't create more than one modal at a time
            if ( instance.modal === null ) {
                // check if the node is a modal
                if ( $node.is( '.modal' ) ) {
                    instance.createModal( $node );
                    continue;
                }
                else {
                    // check if the node contains a modal
                    newModal = $node.find( '.modal' );
                    if ( newModal.length ) {
                        instance.createModal( newModal );
                    }
                }
            }

            // find all the panels in the new content
            if ( request.target || $node.is( '[jx-panel]' ) ) {
                doPanel.call( $node );
            }
            else {
                // iterate through the panels
                $( nodes[i] ).find( '[jx-panel]' ).each( doPanel );
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

    createModal: function ( content ) {
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
            priv.callIn( instance.modal );
            instance.loadDataSrcDivs( instance.modal );
            instance.prefetchAsync( instance.modal );
        }
    },

    // an AJAX alternative to iframes
    loadDataSrcDivs: function ( root ) {
        root = root || document;
        $( root ).find( 'div[data-src]' ).each( function () {
            var $this = $( this );
            var url = $this.data( 'src' );
            instance.executeRequest( {
                action: priv.cacheProof( url ),
                method: 'ajax-get',
                target: $this,
                source: $this,
                transition: $this.data('transition') || 'append'
            } );
        } );
    },

    prefetchAsync: function ( root ) {
        var self = this, config, request;
        root = root || document;
        // do this after everything else
        setTimeout( function () {
            // find elements that are supposed to be pre-loaded
            $( root ).find( '[data-cache=prefetch],[jx-cache=prefetch]' ).each( function () {
                config = priv.getConfig( this );
                request = new lojax.Request( config );
                // if it's got a valid action that hasn't already been cached, cache and execute
                if ( request.action && !self.cache.contains( request.action ) ) {
                    self.cache.add( request );
                    request.exec();
                    lojax.log( 'prefetchAsync: request:' ).log( request );
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

