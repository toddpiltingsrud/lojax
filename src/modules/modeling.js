
/***********\
  modeling
\***********/

// bind an element to a JSON model
lojax.bind = function ( elem, model ) {
    var $elem = $( elem );
    $elem.data( 'model', model );
    priv.setElementsFromModel( $elem, model );
    return model;
};

lojax.bindAllModels = function ( context ) {
    modeler.bindToModels(null, context);
};

lojax.extend( rexp, {
    segments: /[^\[\]\.\s]+|\[\d+\]/g,
    indexer: /\[\d+\]/,
    json: /^\{.*\}$|^\[.*\]$/
} );

var modeler = {

    init: function () {
        modeler.bindToModels();
        $( document )
            .off( 'change', lojax.select.model, modeler.updateModel )
            .off( lojax.events.afterInject, modeler.bindToModels );
        $( document )
            .on( 'change', lojax.select.model, modeler.updateModel )
            .on( lojax.events.afterInject, modeler.bindToModels );
    },
    bindToModels: function ( evt, context ) {
        context = context || document;
        var $this, models = [];
        var dataModels = $( context ).find( lojax.select.model ).add( context ).filter( lojax.select.model );

        lojax.log( 'bindToModels: dataModels:' , dataModels );

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
            lojax.log( 'bindToModels: model:' , model );
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

        lojax.log( 'updateModel: o:' , o );

        priv.triggerEvent( lojax.events.beforeUpdateModel, o, $this );
        if ( o.cancel ) return;

        lojax.log( 'updateModel: o.model: before:' , o.model );

        priv.setModelProperty( $this, o.model, elems );
        // TODO: set an isDirty flag without corrupting the model
        // maybe use a wrapper class to observe the model
        priv.triggerEvent( lojax.events.afterUpdateModel, o, $this );

        lojax.log( 'updateModel: o.model: after:' , o.model );

        priv.propagateChange( model, $target );
    }
};


lojax.extend( lojax.priv, {

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
    resolveModel: function ( params ) {
        lojax.log( 'resolveModel: params:' , params );
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
    formFromModel: function ( model, method, action, rootName, form ) {
        var t, i, props, name;

        lojax.log( 'formFromModel: model:' , model );

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

        lojax.log( 'setModelProperty: elems.length:' , elems.length );

        // derive an object path from the input name
        segments = priv.getPathSegments( $( elems ).attr( 'name' ) );

        // get the raw value
        val = priv.getValue( elems );

        lojax.log( 'setModelProperty: val:' , val );

        // grab the object we're setting
        obj = priv.getObjectAtPath( model, segments, Array.isArray( val ) );

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
        val = priv.castValues( val, type );

        if ( Array.isArray( val ) && Array.isArray( obj ) ) {
            // preserve the object reference in case it's referenced elsewhere
            // clear out the array and repopulate it
            obj.splice( 0, obj.length );
            val.forEach( function ( v ) {
                obj.push( v );
            } );
        }
        else {
            obj[prop] = val;
        }
    },
    buildModelFromElements: function ( context ) {
        var model = {};

        lojax.log( 'buildModelFromElements: context:' , context );

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

        lojax.log( 'buildModelFromElements: model:' , model );

        return model;
    },
    setElementsFromModel: function ( context, model ) {
        var value,
            type,
            name,
            $this = $( context );

        lojax.log( 'setELementsFromModel: model:' , model );

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
            else if ( this.type === 'radio' ) {
                this.checked = ( this.value == value );
            }
            else if ( this.value !== undefined ) {
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
    getValue: function ( elems ) {
        if ( elems.length === 0 ) return null;
        var val;
        var type = elems[0].type;
        // it's supposed to be an array if they're all the same type and they're not radios
        var isArray = elems.length > 1
            && type !== 'radio'
            && elems.filter( '[type="' + type + '"]' ).length === elems.length;
        if ( type === 'checkbox' ) {
            if ( isArray ) {
                // this will only include checked boxes
                val = elems.serializeArray().map( function ( nv ) { return nv.value; } );
            }
            else {
                // this returns the checkbox value, not whether it's checked
                val = elems.val();
                // check for boolean, otherwise return val if it's checked, null if not checked
                if ( val.toLowerCase() == 'true' ) val = ( elems[0].checked ).toString();
                else if ( val.toLowerCase() == 'false' ) val = ( !elems[0].checked ).toString();
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
    },
    isJSON: function ( str ) {
        return rexp.json.test( str );
    },

} );

$( modeler.init );