﻿
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
        lojax.log( 'resolveModel: params:', params );
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

        lojax.log( 'formFromModel: model:', model );

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
    beforeSubmit: function ( request ) {
        // if the request source is a submit button and the method is 'post' or 'ajax-post', raise a submit event
        if (priv.hasValue(request.source) 
            && $(request.source).is('[type=submit]') 
            && /post/.test( request.method ) ) {
            priv.triggerEvent( lojax.events.beforeSubmit, request );
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
        // ensure in is called only once
        // and that calls to lojax.in outside of a container are ignored
        var fn = instance.in;
        instance.in = null;
        if ( panel && fn ) {
            try {
                fn.call( panel, context );
            }
            catch (ex) {
                lojax.error( ex );
            }
        }
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