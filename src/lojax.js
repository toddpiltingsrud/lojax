/*
TODO: 
- Handle files?
- rewrite formFromModel to recurse through arrays
- refactor: diagram everything out and reorganize
- handle request timeouts
- use MutationObserver to detect creation of async elements: div[data-src]
- provide a mechanism for pre-loading resources and caching them on the client
- implement dependency declarations
- use config to specify a default transition
*/

/*
Dependencies:
jquery
*/

// namespace
var jax = jax || {};

( function ( $ ) {

    jax.Gator = function () {
        var self = this;
        this.div = null;
        this.modal = null;
        this.currentTransition = null;
        this.currentPanel = null;

        $( function () {
            self.div = $( "<div style='display:none'></div>" ).appendTo( 'body' );
            $( document ).on( 'click', '[data-request],[jx-request]', self.handleRequest );
            $( document ).on( 'click', '[data-method]:not([data-trigger]),[jx-method]:not([jx-trigger])', self.handleRequest );
            $( document ).on( 'change', '[data-method][data-trigger*=change],[jx-method][jx-trigger*=change]', self.handleRequest );
            $( document ).on( 'keydown', '[data-method][data-trigger*=enter],[jx-method][jx-trigger*=enter]', self.handleEnterKey );
            $( document ).on( 'submit', 'form[data-method]', self.handleRequest );
            $( document ).on( 'change', '[data-model]', self.updateModel );

            window.addEventListener( "hashchange", self.handleHash, false );

            self.loadAsyncContent();
            self.bindToModels();

            if ( priv.hasHash() ) {
                setTimeout( self.handleHash, 0 );
            }
        } );
    };

    jax.Gator.prototype = {

        handleRequest: function ( evt ) {
            // handles click, change, submit
            // 'this' will be the element that was clicked, changed, or submitted
            var params, $this = $( this );
            if ( $this.is( '[data-request]' ) ) {
                params = JSON.parse( $this.data( 'request' ).replace( /'/g, '"' ) );
            }
            else {
                params = $this.data();
            }
            params.source = this;

            jax.log( 'handleRequest: params: ' ).log( params );

            instance.executeRequest( params );

            evt.stopPropagation();

            evt.preventDefault();
        },

        executeRequest: function ( params ) {
            var request = new jax.Request( params );

            jax.log( 'executeRequest: request: ' ).log( request );

            // no action? we're done here
            if ( request.action === null ) return;

            if ( priv.hasHash( request.action ) && params.method === 'ajax-get' ) {

                // delegate hashes to handleHash

                var newHash = request.getHash();

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
                request.exec()
                    .then( function ( response ) {
                        instance.injectContent( request, response );
                    } )
                    .catch( instance.handleError );
                instance.currentTransition = null;
            }
        },

        handleEnterKey: function ( evt ) {
            if ( evt.which === 13 ) {
                instance.handleRequest.call( this, evt );
            }
        },

        handleHash: function () {
            // grab the current hash and request it with ajax-get

            var handler, request, hash = window.location.hash;

            jax.log( 'handleHash: hash:' ).log( hash );

            if ( priv.hasHash() ) {

                // If there's no anchor with this name, handle with default settings.
                // We want to support url-only access, and we don't want to clutter 
                // the url with request settings like transition and target. That 
                // means that there must be enough information already in the page 
                // or response (jx-panel) to be able to properly handle the response.
                handler = $( 'a[name="' + hash.substr( 1 ) + '"]' );
                if ( handler.size() === 0 ) {
                    request = new jax.Request( {
                        action: hash,
                        method: 'ajax-get',
                        transition: instance.currentTransition
                    } );
                    request.exec()
                        .then( function ( response ) {
                            instance.injectContent( request, response );
                        } )
                        .catch( instance.handleError );
                }
                instance.currentTransition = null;
            }
            else if (hash === '') {
                // we got here because a browser navigation button 
                // was clicked which changed the hash to nothing
                // so load the current page via ajax
                instance.executeRequest( {
                    action: window.location.href,
                    method: 'ajax-get'
                } );
            }
        },

        bindToModels: function ( context ) {
            context = context || document;
            var model, $this, models = [];
            var dataModels = $( context ).find( '[data-model]' ).add( context ).filter( '[data-model]' );

            jax.log( 'bindToModels: dataModels:' ).log( dataModels );

            // iterate over the data-models in context
            dataModels.each( function () {
                $this = $( this );
                // grab the data-model
                model = $this.data( 'model' );
                if ( !priv.hasValue( model ) || model === '' ) {
                    // empty model, so create one from its inputs
                    model = priv.buildModelFromElements( $this );
                }
                else {
                    priv.setElementsFromModel( $this, model );
                }
                // https://api.jquery.com/data/
                $this.data( 'model', model );
                models.push( model );
                jax.log( 'bindToModels: model:' ).log( model );
            } );
            // for testing
            return models;
        },

        updateModel: function ( evt ) {
            // model's change handler 
            // provides simple one-way binding from HTML elements to a model
            var $this = $( this );
            var $target = $( evt.target );
            var model = $this.data( 'model' );
            var name = evt.target.name;
            if ( !priv.hasValue( name ) ) return;

            var o = {
                target: evt.target,
                name: name,
                value: $target.val(),
                type: priv.getType( model[name] ),
                model: model,
                cancel: false
            };

            jax.log( 'updateModel: o:' ).log( o );

            priv.triggerEvent( jax.events.beforeUpdateModel, o );
            if ( o.cancel ) return;

            jax.log( 'updateModel: o.model' ).log( o.model );

            priv.setModelProperty( $this, o.model, evt.target );
            // TODO: set an isDirty flag without corrupting the model
            // maybe use a wrapper class to observe the model
            priv.triggerEvent( jax.events.afterUpdateModel, o );
        },

        injectContent: function ( request, response ) {
            var id, target, newModal, transition, $node, result;
            // create a list of nodes from the response
            var nodes = $.parseHTML( response, true );
            jax.log( 'injectContent: nodes:' ).log( nodes );

            // empty response?
            if ( nodes === null ) return;

            priv.triggerEvent( jax.events.beforeInject, nodes );

            var doPanel = function () {
                var node = $( this );
                // match up with panels on the page
                id = node.data( 'jaxpanel' );
                target = request.target || $( '[data-jaxpanel="' + id + '"]' );

                if ( target.size() > 0 ) {
                    jax.log( 'injectContent: data-jaxpanel: ' + id );
                    transition = priv.resolveTransition( request, node );
                    result = transition( target, node );
                    if ( priv.hasValue( request ) ) {
                        result.refresh = request.exec.bind( request );
                    }
                    priv.triggerEvent( jax.events.afterInject, result );
                    instance.bindToModels( result );
                    priv.callIn( result );
                    instance.loadAsyncContent( result );
                }
            };

            for ( var i = 0; i < nodes.length; i++ ) {
                $node = $( nodes[i] );
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
                if ( request.target || $node.is( '[data-jaxpanel]' ) ) {
                    doPanel.call( $node );
                }
                else {
                    // iterate through the panels
                    $( nodes[i] ).find( '[data-jaxpanel]' ).each( doPanel );
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
                instance.loadAsyncContent( instance.modal );
            }
        },

        // an AJAX alternative to iframes
        loadAsyncContent: function ( root ) {
            root = root || document;
            $( root ).find( 'div[data-src]' ).each( function () {
                var $this = $( this );
                var url = $this.data( 'src' );
                console.log( 'loadAsyncContent: url:' );
                console.log( url );
                instance.executeRequest( {
                    action: priv.cacheProof( url ),
                    method: 'ajax-get',
                    target: $this,
                    source: $this,
                    transition: $this.data('transition') || 'append'
                } );
            } );
        },

        handleError: function ( response ) {
            priv.triggerEvent( jax.events.ajaxError, response );
            if ( response.handled ) return;
            var error = [];
            Object.getOwnPropertyNames( response ).forEach( function ( name ) {
                if ( typeof response[name] !== 'function' ) {
                    error.push( response[name] );
                }
            } );
            jax.log( 'handleError: response: ' ).log( response );
        }
    };

    jax.Request = function ( params ) {
        this.method = params.method.toLowerCase();
        this.form = priv.resolveForm( params );
        this.action = priv.resolveAction( params );
        this.model = priv.resolveModel( params );
        this.contentType = priv.resolveContentType( params );
        this.transition = params.transition;
        this.target = priv.resolveTarget( params );
        this.cancel = false;
        this.resolve = null;
        this.reject = null;
        this.result = null;
        this.error = null;
    };

    jax.Request.prototype = {
        getSearch: function () {
            // used for both form encoding and url query strings
            var inputs, queryString = '';
            if ( priv.hasValue( this.form ) ) {
                inputs = priv.resolveInputs( this.form );
                queryString = priv.buildForm( inputs ).serialize();
            }
            else if ( priv.hasValue( this.model ) ) {
                queryString = $.param( this.model );
            }
            return queryString;
        },
        getForm: function ( method ) {
            var form = null;
            method = method || 'post';
            if ( priv.hasValue( this.form ) ) {
                form = priv.buildForm( this.form, this.action, method );
            }
            else if ( priv.hasValue( this.model ) ) {
                form = priv.formFromModel( this.model, method, this.action );
            }
            else {
                // if there's neither a form nor a model, return a blank form
                // it's the only way we can trigger a post from javascript
                form = priv.formFromModel( null, method, this.action );
            }
            return form;
        },
        getHash: function () {
            var hash = priv.checkHash( this.action );
            if ( hash !== null ) {
                var search = this.getSearch();
                return hash + ( search !== '' ? '?' + search : '' );
            }
            return null;
        },
        ajax: function ( type ) {
            var self = this,
                options = {
                    url: this.action,
                    type: type.toUpperCase()
                };

            if ( /POST|PUT/.test( options.type ) && this.model ) {
                options.data = JSON.stringify( this.model );
                options.contentType = 'application/json';
            }
            else {
                options.data = this.getSearch();
            }

            jax.log( 'ajax: options: ' + options );
            $.ajax( options )
                .done( self.done.bind( self ) )
                .fail( self.fail.bind( self ) );
        },
        done: function ( response ) {
            this.result = response;
            if ( priv.hasValue( this.resolve ) ) {
                this.resolve( response );
            }
            priv.triggerEvent( jax.events.afterRequest, this );
        },
        fail: function ( error ) {
            this.error = error;
            if ( priv.hasValue( this.reject ) ) {
                this.reject( error );
            }
            priv.triggerEvent( jax.events.afterRequest, this );
        },
        methods: {
            get: function () {
                var queryString = this.getSearch();
                var url = priv.checkHash( this.action );
                window.location = url + '?' + queryString;
                priv.triggerEvent( jax.events.afterRequest, this );
            },
            post: function () {
                var self = this;
                var form = this.getForm( type );
                form.appendTo( 'body' );
                form[0].submit();
                // in the case of downloading a file, the page is not refreshed
                // so we still need to clean up after ourselves
                setTimeout( function () {
                    form.remove();
                    priv.triggerEvent( jax.events.afterRequest, self );
                }, 0 );
            },
            'ajax-get': function () {
                var url = priv.checkHash( this.action );
                var search = this.getSearch();
                $.get( url, search )
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
                var queryString = this.getSearch();
                var url = priv.checkHash( this.action );
                var s = document.createElement( 'script' );
                s.type = 'text/javascript';
                s.src = url + '?' + queryString;
                document.body.appendChild( s );
                setTimeout( function () {
                    document.body.removeChild( s );
                    // we have no way of handling the response of JSONP
                    // but trigger the event anyway
                    priv.triggerEvent( jax.events.afterRequest, self );
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
                priv.triggerEvent( jax.events.beforeRequest, this );
                if ( !this.cancel ) {
                    // execute the method function
                    this.methods[this.method].bind( this )();
                }
                else {
                    // always trigger afterRequest even if there was no request
                    // it's typically used to turn off progress bars
                    priv.triggerEvent( jax.events.afterRequest, this );
                }
            }
            return this;
        },

        // fake promise
        then: function ( resolve, reject ) {
            if ( priv.hasValue( resolve ) ) {
                this.resolve = resolve;
                if ( this.result !== null ) {
                    // the response came before calling this function
                    this.resolve( this.result );
                }
            }
            if ( priv.hasValue( reject ) ) {
                this.reject = reject;
                if ( this.error !== null ) {
                    // the response came before calling this function
                    this.reject( this.error );
                }
            }
            return this;
        },

        // fake promise
        catch: function ( reject ) {
            return this.then( undefined, reject );
        }
    };

    jax.Transitions = {
        'replace': function ( oldPanel, newPanel ) {
            $( oldPanel ).replaceWith( newPanel );
            return newPanel;
        },
        'fade-in': function ( oldPanel, newPanel ) {
            oldPanel.fadeOut( 0 ).empty().append( $( newPanel ).contents() ).fadeIn();
            return oldPanel;
        },
        'flip-horizontal': function ( oldPanel, newPanel ) {
            var parent = $( oldPanel ).parent().addClass( 'flip-horizontal' ).css( 'position', 'relative' );
            $( oldPanel ).addClass( 'front' );
            $( newPanel ).addClass( 'back' ).width( oldPanel.width() ).appendTo( parent );
            setTimeout( function () {
                parent.addClass( 'flip' );
            }, 100 );
            setTimeout( function () {
                $( oldPanel ).remove();
                parent.removeClass( 'flip' ).removeClass( 'flip-horizontal' );
                $( newPanel ).removeClass( 'back' ).css( 'width', '' );
            }, 1000 );
            return newPanel;
        },
        'flip-vertical': function ( oldPanel, newPanel ) {
            var parent = $( oldPanel ).parent().addClass( 'flip-vertical' ).css( 'position', 'relative' );
            oldPanel.addClass( 'front' );
            $( newPanel ).addClass( 'back' ).css( 'width', oldPanel.width() ).appendTo( parent );
            setTimeout( function () {
                parent.addClass( 'flip' );
            }, 100 );
            setTimeout( function () {
                oldPanel.remove();
                parent.removeClass( 'flip' ).removeClass( 'flip-vertical' );
                $( newPanel ).removeClass( 'back' ).css( 'width', '' );
            }, 1000 );
            return newPanel;
        },
        'slide-left': function ( oldPanel, newPanel ) {
            var parent = oldPanel.parent().addClass( 'slide-left' ).css( 'position', 'relative' );
            $( oldPanel ).addClass( 'left' );
            $( newPanel ).addClass( 'right' ).appendTo( parent );
            setTimeout( function () {
                parent.addClass( 'slide' );
            }, 100 );
            setTimeout( function () {
                oldPanel.remove();
                parent.removeClass( 'slide' ).removeClass( 'slide-left' );
                $( newPanel ).removeClass( 'right' );
            }, 800 );
            return newPanel;
        },
        'append': function ( oldPanel, newPanel ) {
            // useful for paging
            $( oldPanel ).append( newPanel );
            return newPanel;
        },
        'prepend': function ( oldPanel, newPanel ) {
            $( oldPanel ).prepend( newPanel );
            return newPanel;
        }
    };

    var rexp = {
        segments: /'.+'|".+"|[\w\$]+|\[\d+\]/g,
        indexer: /\[\d+\]/,
        quoted: /'.+'|".+"/,
        search: /\?.+(?=#)|\?.+$/,
        hash: /#(.*)?[a-z]{2}(.*)?/i
    };

    // private functions
    var priv = {
        hasValue: function ( val ) {
            return val !== undefined && val !== null;
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
                var closest = $( params.source ).closest( 'form,[data-model]' );
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
                return $( params.form );
            }
            // only a submit button can submit an enclosing form
            if ( $( params.source ).is( '[type=submit]' ) ) {
                closest = $( params.source ).closest( 'form,[data-model]' );
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
            jax.log( 'resolveModel: params:' ).log( params );
            var closest;
            if ( priv.hasValue( params.source )
                && priv.hasValue( $( params.source ).attr( 'data-model' ) ) ) {
                params.model = $( params.source ).data( 'model' );
                return params.model;
            }
            if ( typeof params.model === 'object' ) {
                return params.model;
            }
            // only a submit button can submit an enclosing model
            if ( $( params.source ).is( '[type=submit]' ) ) {
                closest = $( params.source ).closest( 'form,[data-model]' );
                jax.log( 'resolveModel: closest:' ).log( closest );
                if ( closest.is( '[data-model]' ) ) {
                    return closest.data('model');
                }
            }
            return null;
        },
        resolveContentType: function ( params ) {
            return params.model ? 'application/json' : 'application/x-www-form-urlencoded; charset=UTF-8';
        },
        resolveTarget: function ( params ) {
            if ( priv.hasValue( params.target ) ) {
                return $( params.target );
            }
            return null;
        },
        resolveInputs: function ( form ) {
            // account for selectors that either select a top element with inputs inside (e.g. 'form')
            // or that select specific input elements (e.g. '#div1 [name]')
            // or both (e.g. 'form,#div1 [name]')
            return $( form ).find( ':input' ).add( $( form ).filter( ':input' ) );
        },
        resolveTransition: function ( request, target ) {
            // check for a transition in the request first
            if ( request.transition ) {
                return jax.Transitions[request.transition] || jax.Transitions['fade-in'];
            }
            else {
                // check for a transition on the target
                return jax.Transitions[$( target ).attr( 'data-transition' )] || jax.Transitions['fade-in'];
            }
        },
        buildForm: function ( forms, action, method ) {
            // Trying to use jQuery's clone function here fails for select elements.
            // The clone function doesn't preserve select element values.
            // So copy everything manually instead.
            if ( $( forms ).length ) {
                method = method || 'POST';
                var form = $( "<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>" );
                var inputs = priv.resolveInputs( forms ).serializeArray();
                inputs.forEach( function ( input ) {
                    $( "<input type='hidden' />" ).appendTo( form ).prop( 'name', input.name ).val( input.value );
                } );
                return form;
            }
            return forms;
        },
        formFromModel: function ( model, method, action, rootName, form ) {
            if ( !priv.hasValue( form ) ) {
                method = method || 'POST';
                action = action || '';
                form = $( "<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>" );
                rootName = '';
            }

            if ( priv.hasValue( model ) ) {
                // populate the form

                var type, names = Object.getOwnPropertyNames( model );

                names.forEach( function ( name ) {
                    type = priv.getType( model[name] );
                    switch ( type ) {
                        case 'array':
                            model[name].forEach( function ( val ) {
                                if ( priv.hasValue( val ) && val !== '' ) {
                                    // add hidden input to form
                                    $( "<input type='hidden' />" ).appendTo( form ).prop( 'name', rootName + name ).val( val );
                                }
                            } );
                            break;
                        case 'object':
                            // recurse through child objects
                            priv.formFromModel( model[name], method, action, rootName + name + '.', form );
                            break;
                        case 'function':
                        case null:
                            break;
                        default:
                            // add hidden input to form
                            $( "<input type='hidden' />" ).appendTo( form ).prop( 'name', rootName + name ).val( model[name].toString() );
                    }
                } );
            }

            jax.log( 'formFromModel: form: ' ).log( form );

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
            else if ( rexp.quoted.test( segment ) ) {
                return segment.slice( 1, -1 );
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
                val,
                isArray,
                segments;

            if ( !Array.isArray( elem ) ) {
                // find all the elements with this name
                elem = $( context ).find( '[name="' + elem.name + '"]' ).toArray();
            }

            // derive an object path from the input name
            segments = priv.getPathSegments( elem[0].name );

            isArray = ( elem.length > 1 );

            prop = priv.resolvePathSegment( segments[segments.length - 1] );

            obj = priv.getObjectAtPath( model, segments, isArray );

            // attempt to resolve the data type in the model
            // if we can't get a type from the model
            // rely on the server to resolve it
            if ( prop in obj ) {
                type = priv.getType( obj[prop] );
            }
            else if ( Array.isArray( obj ) && obj.length ) {
                type = priv.getType( obj[0] );
            }

            if ( Array.isArray( obj ) && isArray ) {
                // clear out the array and repopulate it
                // but preserve the object reference in case it's referenced elsewhere
                obj.splice( 0, obj.length );
                elem.forEach( function ( e ) {
                    e = $( e )[0];
                    if ( !( /radio|checkbox/.test( e.type ) ) || e.checked ) {
                        obj.push( priv.convertElementValue( e, type ) );
                    }
                } );
            }
            else {
                obj[prop] = priv.convertElementValue( elem[0], type );
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
                    names[this.name] = [];
                }
                // push all elements, even if they're not checked
                // that way setModelProperty will know whether to create arrays or not
                names[this.name].push( this );
            } );

            Object.getOwnPropertyNames( names ).forEach( function ( name ) {
                priv.setModelProperty( context, model, names[name] );
            } );

            jax.log( 'buildModelFromElements: model:' ).log( model );

            return model;
        },
        setElementsFromModel: function ( context, model ) {
            var value,
                type,
                $this = $( context );
            jax.log( 'setELementsFromModel: model:' ).log( model );

            // set the inputs to the model
            $this.find( '[name]' ).each( function () {
                value = priv.getModelValue( model, this.name );
                type = priv.getType( value );
                // lojax assumes ISO 8601 date serialization format
                // http://www.hanselman.com/blog/OnTheNightmareThatIsJSONDatesPlusJSONNETAndASPNETWebAPI.aspx
                // ISO 8601 is easy to parse
                // making it possible to skip the problem of converting date strings to JS Date objects
                if ( type === 'date' || this.type === 'date' ) {
                    // date inputs expect yyyy-MM-dd
                    $( this ).val( priv.standardDateFormat( value ) );
                }
                else if ( type === 'boolean' && this.type === 'checkbox' ) {
                    this.checked = value;
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
                jax.log( 'Could not resolve object path: ' + path );
                jax.log( err );
            }
        },
        getType: function ( a ) {
            if ( a === null ) {
                return null;
            }
            if ( a instanceof Date ) {
                return 'date';
            }
            if ( Array.isArray( a ) ) {
                return 'array';
            }
            // 'number','string','boolean','function','object','undefined'
            return typeof ( a );
        },
        triggerEvent: function ( name, arg ) {
            try {
                $.event.trigger( {
                    type: name,
                    source: arg
                }, arg );
            } catch ( ex ) {
                if ( console && console.log ) {
                    console.log( ex );
                }
            }
        },
        checkHash: function ( url ) {
            // return the hash portion if present
            var index = url.indexOf( '#' );
            if ( index !== -1 ) {
                return url.substring( index + 1 );
            }
            return url;
        },
        hasHash: function ( url ) {
            url = url || window.location.href;
            return rexp.hash.test( url );
        },
        standardDateFormat: function ( date ) {
            if ( priv.hasValue( date ) === false ) return;
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
        callIn: function ( panel ) {
            if ( panel && instance.in ) {
                instance.in.call( panel );
                // ensure in is called only once
                instance.in = null;
            }
        },
        nonce: jQuery.now(),
        cacheProof: function ( url ) {
            var nocache = url;
            nocache += ( url.indexOf( '?' ) === -1 ) ? '?' : '&';
            nocache = nocache + '_=' + ( priv.nonce++ );
            return nocache;
        },
        convertElementValue( elem, type ) {
            if ( !elem ) return elem;
            var val = elem.value === '' ? null : elem.value;
            switch ( type ) {
                case 'number':
                    if ( $.isNumeric( val ) ) {
                        return parseFloat( val );
                    }
                    return val;
                case 'boolean':
                    if ( elem.type === 'checkbox' ) {
                        return elem.checked;
                    }
                    return elem.value.toLowerCase() === 'true';
                case null:
                case undefined:
                    if ( elem.type === 'checkbox' && ( val === null || val.toLowerCase() === 'true' ) ) {
                        return elem.checked;
                    }
                    return val;
                default:
                    // don't attempt to convert dates
                    // let the server deserialize them
                    return val;
            }
        }
    };

    // handle an arbitrary event and execute a request
    jax.on = function ( event, params ) {
        $( document ).on( event, function () {
            instance.executeRequest( params );
        } );
    };

    jax.off = function ( event ) {
        $( document ).off( event );
    };

    jax.get = function ( params ) {
        instance.executeRequest( params );
    };

    jax.in = function ( callback ) {
        instance.in = callback;
    };

    // this can be called explicitly when the server returns a success 
    // response from a form submission that came from a modal
    jax.closeModal = function () {
        if ( priv.hasValue( instance.modal ) ) {
            if ( $.fn.modal ) {
                instance.modal.modal( 'hide' );
            }
            else if ( $.fn.kendoWindow ) {
                instance.modal.data( 'kendoWindow' ).close();
            }
        }
    }

    jax.events = {
        beforeRequest: 'beforeRequest',
        afterRequest: 'afterRequest',
        beforeUpdateModel: 'beforeUpdateModel',
        afterUpdateModel: 'afterUpdateModel',
        beforeInject: 'beforeInject',
        afterInject: 'afterInject',
        ajaxError: 'ajaxError'
    };

    jax.logging = false;

    jax.log = function ( arg ) {
        try {
            if ( jax.logging && console && console.log ) {
                console.log( arg );
            }
        }
        catch ( ex ) { }
        return jax;
    };

    // for testing
    jax.priv = priv;

    // global
    jax.instance = new jax.Gator();

    // local
    var instance = jax.instance;

} )( jQuery );