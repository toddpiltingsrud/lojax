
// namespace
var lojax = lojax || {};

(function($, lojax) { 
    
    /***********\
        API
    \***********/
    
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
    lojax.get = function ( params ) {
        instance.executeRequest( params );
    };
    
    // call this from a script that is located inside a jx-panel or div[data-src]
    // executes a callback with the context set to the injected content
    lojax.onLoad = function ( callback ) {
        instance.onLoad = callback;
    };
    
    lojax.closeModal = function () {
        if ( priv.hasValue( instance.modal ) ) {
            if ( $.fn.modal ) {
                instance.modal.modal( 'hide' );
            }
            else if ( $.fn.kendoWindow ) {
                instance.modal.data( 'kendoWindow' ).close();
            }
        }
    };
    
    // bind an element to a JSON model
    lojax.bind = function ( elem, model ) {
        var $elem = $( elem );
        if ( !priv.hasValue( model ) || model === '' ) {
            // empty model, so create one from its inputs
            model = priv.buildModelFromElements( $elem );
        }
        else {
            priv.setElementsFromModel( $elem, model );
        }
        $elem.data( 'model', model );
        return model;
    };
    
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
            log: priv.noop
        };
    };
    
    
    /***********\
       Cache
    \***********/
    
    lojax.Cache = function () {
        this.store = {};
    };
    
    lojax.Cache.prototype = {
        add: function ( request ) {
            this.remove( request.action );
            this.store[request.action] = request;
            if ( request.expire ) {
                this.setTimeout( request );
            }
        },
        remove: function ( action ) {
            var request = this.store[action];
            if ( request ) {
                if ( request.timeout ) {
                    clearTimeout( request.timeout );
                }
                delete this.store[action];
            }
        },
        get: function ( action ) {
            var request = this.store[action];
            if ( request ) {
                if ( request.renew === 'sliding' && request.timeout ) {
                    this.setTimeout( request );
                }
                return this.store[action];
            }
        },
        setTimeout: function ( request ) {
            var self = this;
            if ( request.timeout ) {
                clearTimeout( request.timeout );
            }
            request.timeout = setTimeout( function () {
                self.expire( request );
            }, request.expire * 1000 );
        },
        expire: function ( request ) {
            if ( request.renew === 'auto' ) {
                request.exec();
                this.setTimeout( request );
            }
            else {
                this.remove( request.action );
            }
        },
        clear: function () {
            var self = this;
            var actions = Object.getOwnPropertyNames( this.store );
            actions.forEach( function ( action ) {
                self.remove( action );
            } );
        },
        contains: function ( action ) {
            return ( action in this.store );
        }
    };
    
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
            // allows executing a request on a single input element without wrapping it in a form (e.g. data-trigger="change enter")
            // also submits an element with a model attribute if enter key is pressed
            $( document ).on( 'keydown', '[data-method][data-trigger*=enter],[jx-method][jx-trigger*=enter],' + priv.attrSelector( 'model' ), self.handleEnterKey );
            $( document ).on( 'submit', 'form[data-method],form[jx-method]', self.handleRequest );
            $( document ).on( 'change', priv.attrSelector( 'model' ), self.updateModel );
    
            if ( lojax.config.hash ) {
                window.addEventListener( "hashchange", self.handleHash, false );
            }
    
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
            // handles click, change, submit, keydown (enter)
            // 'this' will be the element that was clicked, changed, submitted or keydowned
            var params = priv.getConfig( this ),
                $this = $( this );
            // beforeRequest and afterRequest events are triggered in response to user action
            params.beforeRequest = instance.beforeRequest;
            params.afterRequest = instance.afterRequest;
    
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
    
        handleEnterKey: function ( evt ) {
            if ( evt.which === 13 ) {
                instance.handleRequest.call( this, evt );
            }
        },
    
        handleHash: function () {
            if ( !lojax.config.hash ) return;
    
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
                    lojax.log( 'executeRequest: retrieved from cache' );
                }
                else {
                    this.cache.add( request );
                    lojax.log( 'executeRequest: added to cache' );
                }
            }
    
            request
                .exec()
                .then( function ( response ) {
                    instance.injectContent( request, response );
                } )
                .catch( instance.handleError );
        },
    
        bindToModels: function ( context ) {
            context = context || document;
            var model, $this, models = [];
            var dataModels = $( context ).find( priv.attrSelector('model') ).add( context ).filter( priv.attrSelector('model') );
    
            lojax.log( 'bindToModels: dataModels:' ).log( dataModels );
    
            // iterate over the models in context
            dataModels.each( function () {
                $this = $( this );
                // grab the data-model
                model = priv.getModel( $this );
                model = lojax.bind( $this, model );
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
    
            // empty response?
            if ( !priv.hasValue( response ) ) return;
    
            // ensure any loose calls to lojax.onLoad are ignored
            instance.onLoad = null;
    
            var doPanel = function () {
                var node = $( this );
                // match up with panels on the page
                id = priv.attr( node, 'panel' );
                target = request.target || $( '[jx-panel="' + id + '"],[data-panel="' + id + '"]' ).first();
    
                if ( target.length ) {
                    lojax.log( 'injectContent: jx-panel: ' + id );
                    transition = priv.resolveTransition( request, node );
                    result = transition( target, node );
                    if ( priv.hasValue( request ) ) {
                        result.refresh = request.exec.bind( request );
                    }
                    priv.triggerEvent( lojax.events.afterInject, result, node );
                    instance.bindToModels( result );
                    priv.callOnLoad( result );
                    instance.loadDataSrcDivs( result );
                    instance.prefetchAsync( result );
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
                priv.callOnLoad( instance.modal );
                instance.loadDataSrcDivs( instance.modal );
                instance.prefetchAsync( instance.modal );
            }
        },
    
        // an AJAX alternative to iframes
        loadDataSrcDivs: function ( root ) {
            root = root || document;
            $( root ).find( 'div[data-src],div[jx-src]' ).each( function () {
                var $this = $( this );
                var url = priv.attr( $this, 'src' );
                instance.executeRequest( {
                    action: priv.noCache( url ),
                    method: 'ajax-get',
                    target: $this,
                    source: $this,
                    transition: priv.attr($this, 'transition') || 'append'
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
        },
    
        beforeRequest: function ( request ) {
            priv.triggerEvent( lojax.events.beforeRequest, request, request.source );
        },
        afterRequest: function ( request ) {
            priv.triggerEvent( lojax.events.afterRequest, request, request.source );
        }
    };
    
    
    /***************\
    private functions
    \***************/
    
    var rexp = {
        segments: /[^\[\]\.\s]+|\[\d+\]/g,
        indexer: /\[\d+\]/,
        quoted: /'.+'|".+"/,
        search: /\?.+(?=#)|\?.+$/,
        hash: /#((.*)?[a-z]{2}(.*)?)/i
    };
    
    var priv = {
        noop: function () { },
        hasValue: function ( val ) {
            return val !== undefined && val !== null;
        },
        attr: function(elem, name) {
            return $( elem ).attr( 'data-' + name ) || $( elem ).attr( lojax.config.prefix + name );
        },
        attrSelector: function ( name ) {
            return '[data-' + name + '],[' + lojax.config.prefix + name + ']';
        },
        attributes: 'method action transition target form model cache expire renew'.split( ' ' ),
        getConfig: function ( elem ) {
            var name, config, $this = $( elem );
    
            if ( $this.is( priv.attrSelector('request') ) ) {
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
            // if there's an action in the params, return it
            if ( priv.hasValue( params.action ) && params.action.length ) {
                return params.action;
            }
            // check for a valid href
            if ( priv.hasValue( params.source )
                && priv.hasValue( params.source.href )
                && params.source.href.length
                && params.source.href.substr( params.source.href.length - 1, 1 ) !== '#'
                && params.source.href.substr( 0, 11 ) !== 'javascript:' ) {
                return params.source.href;
            }
            // if this is a submit button check for a form
            if ( $( params.source ).is( '[type=submit]' ) ) {
                var closest = $( params.source ).closest( 'form,' + priv.attrSelector('model') );
                // is submit button inside a form?
                if ( closest.is( 'form' ) ) {
                    // post to form.action or current page
                    return closest.attr('action') || window.location.href;
                }
            }
            // if this is a form use form.action or current page
            if ( $( params.source ).is( 'form' ) ) {
                return $( params.source ).attr( 'action' ) || window.location.href;
            }
            return null;
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
                closest = $( params.source ).closest( 'form,' + priv.attrSelector('model') );
                if ( closest.is( 'form' ) ) {
                    return closest;
                }
            }
            if ( $( params.source ).is( 'form' ) ) {
                return params.source;
            }
            return null;
        },
        resolveModel: function ( params ) {
            lojax.log( 'resolveModel: params:' ).log( params );
            var closest;
            if ( typeof params.model === 'object' ) {
                return params.model;
            }
            if ( priv.hasValue( params.source )
                && priv.hasValue( priv.getModel(params.source) ) ) {
                return priv.getModel( params.source );
            }
            // only a submit button can submit an enclosing model
            if ( $( params.source ).is( '[type=submit]' ) ) {
                // don't return anything if closest is form
                closest = $( params.source ).closest( 'form,' + priv.attrSelector('model') );
                if ( closest.is( priv.attrSelector( 'model' ) ) ) {
                    return priv.getModel( closest );
                }
            }
            return null;
        },
        getModel: function ( elem ) {
            var model = $( elem ).data( 'model' );
            if ( model === undefined && $( elem ).is( '[jx-model]' ) ) {
                model = JSON.parse( $( elem ).attr( 'jx-model' ) );
                // store model in jQuery's data object
                // reference it there from now on
                $( elem ).data( 'model', model );
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
                return lojax.Transitions[priv.attr(target, 'transition')] || lojax.Transitions[lojax.config.transition];
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
        setModelProperty: function ( context, model, elem ) {
            var obj,
                prop,
                type,
                isArray,
                segments;
    
            // derive an object path from the input name
            segments = priv.getPathSegments( elem[0].name );
    
            // if there's more than one checkbox with this name, assume an array
            isArray = ( elem.length > 1 && elem[0].type === 'checkbox' );
    
            prop = priv.resolvePathSegment( segments[segments.length - 1] );
    
            obj = priv.getObjectAtPath( model, segments, isArray );
    
            // attempt to resolve the data type in the model
            // if we can't get a type from the model
            // rely on the server to resolve it
            if ( prop in obj ) {
                type = $.type( obj[prop] );
            }
            else if ( Array.isArray( obj ) && obj.length ) {
                type = $.type( obj[0] );
            }
    
            if ( Array.isArray( obj ) && isArray ) {
                // clear out the array and repopulate it
                // but preserve the object reference in case it's referenced elsewhere
                obj.splice( 0, obj.length );
                $(elem).serializeArray().forEach(function(e){
                    obj.push( priv.castValue( e.value, type ) );
                });
            }
            else {
                // there should only be one element
                $(elem).serializeArray().forEach(function(e){
                    obj[prop] = priv.castValue( e.value, type );
                });
            }
        },
        buildModelFromElements: function ( context ) {
            var model = {};
    
            // there may be multiple elements with the same name
            // so build a dictionary of names and elements
            var names = {};
            var elems = $( context ).find( '[name]' );
            elems.each( function () {
                if ( !( this.name in names ) ) {
                    names[this.name] = $( context ).find( '[name="' + this.name + '"]' );
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
                $this = $( context );
    
            lojax.log( 'setELementsFromModel: model:' ).log( model );
    
            // set the inputs to the model
            $this.find( '[name]' ).each( function () {
                value = priv.getModelValue( model, this.name );
                type = $.type( value );
                // lojax assumes ISO 8601 date serialization format
                // http://www.hanselman.com/blog/OnTheNightmareThatIsJSONDatesPlusJSONNETAndASPNETWebAPI.aspx
                // ISO 8601 is easy to parse
                // making it possible to skip the problem of converting date strings to JS Date objects in most cases
                if ( type === 'date' || this.type === 'date' ) {
                    // date inputs expect yyyy-MM-dd
                    $( this ).val( priv.standardDateFormat( value ) );
                }
                else if ( type === 'boolean' && this.type === 'checkbox' ) {
                    this.checked = value;
                }
                else if (this.type === 'radio') {
                    this.checked = ( this.value == value );
                }
                else {
                    $( this ).val( value );
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
        callOnLoad: function ( panel ) {
            if ( panel && instance.onLoad ) {
                instance.onLoad.call( panel );
            }
            // ensure in is called only once
            // and that calls to lojax.onLoad outside of a container are ignored
            instance.onLoad = null;
        },
        nonce: jQuery.now(),
        noCache: function ( url ) {
            var a = ( url.indexOf( '?' ) != -1 ? '&_=' : '?_=' ) + priv.nonce++;
            var s = url.match( /\?.+(?=#)|\?.+$|.+(?=#)|.+/ );
            return url.replace( s, s + a );
        },
        castValue: function ( val, type ) {
            if ( !priv.hasValue( val ) || val === '' ) return null;
            switch ( type ) {
                case 'number':
                    if ( $.isNumeric( val ) ) {
                        return parseFloat( val );
                    }
                    return val;
                case 'boolean':
                    return val.toLowerCase() === 'true';
                case 'null':
                case 'undefined':
                    if ( /true|false/g.test(val.toLowerCase())) {
                        return val.toLowerCase() === 'true';
                    }
                    return val;
                default:
                    // don't attempt to convert dates
                    // let the server deserialize them
                    return val;
            }
        }
    };
    
    // for testing
    lojax.priv = priv;
    
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
    
    
    /***********\
     Transitions
    \***********/
    
    lojax.Transitions = {
        'replace': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.replaceWith( $new );
            return $new;
        },
        'fade-in': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.fadeOut( 0 ).empty().append( $new.contents() ).fadeIn();
            return $old;
        },
        'flip-horizontal': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            var parent = $old.parent().addClass( 'flip-horizontal' ).css( 'position', 'relative' );
            $old.addClass( 'front' );
            $new.addClass( 'back' ).width( $old.width() ).appendTo( parent );
            setTimeout( function () {
                parent.addClass( 'flip' );
            }, 100 );
            setTimeout( function () {
                $old.remove();
                parent.removeClass( 'flip' ).removeClass( 'flip-horizontal' );
                $new.removeClass( 'back' ).css( 'width', '' );
            }, 1000 );
            return $new;
        },
        'flip-vertical': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            var parent = $old.parent().addClass( 'flip-vertical' ).css( 'position', 'relative' );
            $old.addClass( 'front' );
            $new.addClass( 'back' ).css( 'width', $old.width() ).appendTo( parent );
            setTimeout( function () {
                parent.addClass( 'flip' );
            }, 100 );
            setTimeout( function () {
                $old.remove();
                parent.removeClass( 'flip' ).removeClass( 'flip-vertical' );
                $new.removeClass( 'back' ).css( 'width', '' );
            }, 1000 );
            return $new;
        },
        'slide-left': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            var parent = $old.parent().addClass( 'slide-left' ).css( 'position', 'relative' );
            $old.addClass( 'left' );
            $new.addClass( 'right' ).appendTo( parent );
            setTimeout( function () {
                parent.addClass( 'slide' );
            }, 100 );
            setTimeout( function () {
                $old.remove();
                parent.removeClass( 'slide' ).removeClass( 'slide-left' );
                $new.removeClass( 'right' );
            }, 800 );
            return $new;
        },
        'append': function ( oldNode, newNode ) {
            // useful for paging
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.append( $new );
            return $new;
        },
        'prepend': function ( oldNode, newNode ) {
            var $old = $( oldNode ),
                $new = $( newNode );
            $old.prepend( $new );
            return $new;
        }
    };
    

    lojax.config = {
        prefix: 'jx-',
		transition: 'fade-in',
		hash: true
    };

	// global
	lojax.instance = new lojax.Controller();

	// local
	var instance = lojax.instance;

})(jQuery, lojax);

