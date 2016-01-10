
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

