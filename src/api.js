/***********\
    API
\***********/

// handle an arbitrary event and execute a request
lojax.on = function ( event, params ) {
    $( document ).on( event, function () {
        instance.executeRequest( params );
    } );
};

lojax.off = function ( event ) {
    $( document ).off( event );
};

lojax.get = function ( params ) {
    instance.executeRequest( params );
};

lojax.in = function ( callback ) {
    instance.in = callback;
};

// this can be called explicitly when the server returns a success 
// response from a form submission that came from a modal
lojax.closeModal = function () {
    if ( priv.hasValue( instance.modal ) ) {
        if ( $.fn.modal ) {
            instance.modal.modal( 'hide' );
        }
        else if ( $.fn.kendoWindow ) {
            instance.modal.data( 'kendoWindow' ).close();
        }
    }
}

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
        }
    }
    catch ( ex ) { }
    return lojax;
};

