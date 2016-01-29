﻿
/***************\
private functions
\***************/

var rexp = {
    segments: /[^\[\]\.\s]+|\[\d+\]/g,
    indexer: /\[\d+\]/,
    search: /\?.+(?=#)|\?.+$/,
    hash: /#((.*)?[a-z]{2}(.*)?)/i,
    json: /^\{.*\}$|^\[.*\]$/
};

var priv = {
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
    isJSON: function ( str ) {
        return rexp.json.test( str );
    },
    attributes: 'method action transition target form model preload src'.split( ' ' ),
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
        segments = priv.getPathSegments( $(elems).attr('name') );

        // get the raw value
        val = priv.getValue( elems );

        lojax.log( 'setModelProperty: val:' ).log( val );

        // grab the object we're setting
        obj = priv.getObjectAtPath( model, segments, Array.isArray(val) );

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
        val = priv.castValues(val, type);

        if ( Array.isArray( val ) && Array.isArray(obj)) {
            // preserve the object reference in case it's referenced elsewhere
            // clear out the array and repopulate it
            obj.splice( 0, obj.length );
            val.forEach(function(v){
                obj.push( v );
            });
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
            else if (this.type === 'radio') {
                this.checked = ( this.value == value );
            }
            else if (this.value !== undefined) {
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
    callOnLoad: function ( panel, context ) {
        if ( panel && instance.onLoad ) {
            instance.onLoad.call( panel, context );
        }
        // ensure in is called only once
        // and that calls to lojax.onLoad outside of a container are ignored
        instance.onLoad = null;
    },
    callOnUnload: function ( panel ) {
        if ( panel && typeof panel[0].onUnload == 'function' ) {
            panel[0].onUnload.call( panel );
            panel[0].onUnload = null;
        }
    },
    nonce: jQuery.now(),
    noCache: function ( url ) {
        var a = ( url.indexOf( '?' ) != -1 ? '&_=' : '?_=' ) + priv.nonce++;
        var s = url.match( /\?.+(?=#)|\?.+$|.+(?=#)|.+/ );
        return url.replace( s, s + a );
    },
    getValue: function ( elems ) {
        if (elems.length === 0) return null;
        var val;
        var type = elems[0].type;
        // it's supposed to be an array if they're all the same type and they're not radios
        var isArray = elems.length > 1
            && type !== 'radio'
            && elems.filter( '[type="'+type+'"]' ).length === elems.length;
        if ( type === 'checkbox' ) {
            if ( isArray ) {
                // this will only include checked boxes
                val = elems.serializeArray().map( function ( nv ) { return nv.value; } );
            }
            else {
                // this returns the checkbox value, not whether it's checked
                val = elems.val();
                // check for boolean, otherwise return val if it's checked, null if not checked
                if ( val.toLowerCase() == 'true' ) val = (elems[0].checked).toString();
                else if ( val.toLowerCase() == 'false' ) val = (!elems[0].checked).toString();
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
    }
};

// for testing
lojax.priv = priv;
