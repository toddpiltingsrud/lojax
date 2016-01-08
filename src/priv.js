
/***************\
private functions
\***************/

var rexp = {
    segments: /'.+'|".+"|[\w\$]+|\[\d+\]/g,
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
            config = JSON.parse( priv.attr( 'request' ).replace( /'/g, '"' ) );
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

        if ( typeof model === 'string' ) {
            model = JSON.parse( model );
        }

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
            lojax.log( 'Could not resolve object path: ' + path );
            lojax.log( err );
        }
    },
    triggerEvent: function ( name, arg, src ) {
        try {
            lojax.log( 'triggerEvent: name:' ).log( name );
            lojax.log( 'triggerEvent: src:' ).log( src );
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
    callIn: function ( panel ) {
        if ( panel && instance.in ) {
            instance.in.call( panel );
        }
        // ensure in is called only once
        // and that calls to lojax.in outside of a container are ignored
        instance.in = null;
    },
    nonce: jQuery.now(),
    cacheProof: function ( url ) {
        var nocache = url;
        nocache += ( url.indexOf( '?' ) === -1 ) ? '?' : '&';
        nocache = nocache + '_=' + ( priv.nonce++ );
        return nocache;
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
