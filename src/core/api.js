var priv = {};
var rexp = {};
jx.Controller = {};
jx.Transitions = {};
var instance = jx.Controller;
jx.priv = priv;


/***********\
    API
\***********/

// handle an arbitrary event and execute a request
jx.on = function ( event, params ) {
    $( document ).on( event, function () {
        instance.executeRequest( params );
    } );
};

// remove event handler
jx.off = function ( event ) {
    $( document ).off( event );
};

// execute a request
jx.exec = function ( params ) {
    instance.executeRequest( params );
};

// call this from a script that is located inside a jx-panel, div[data-src] or .modal
// executes a callback with the context set to the injected node
jx.in = function ( callback ) {
    jx.info( 'jx.in called' );
    instance.in = callback;
};

jx.out = function ( callback ) {
    jx.info( 'jx.out called' );
    instance.out = callback;
};

jx.createModal = function ( content ) {
    jx.closeModal();
    instance.modal = $( content ).modal( {
        show: true,
        keyboard: true
    } );
    instance.modal.on( 'hidden.bs.modal', function () {
        if ( priv.hasValue( instance.modal ) ) {
            instance.modal.off( 'hidden.bs.modal', instance.onModalClose );
            instance.modal.modal( 'hide' );
            instance.modal = null;
        }
    } );
};

jx.closeModal = function () {
    if ( priv.hasValue( instance.modal ) ) {
        if ( $.fn.modal ) {
            instance.modal.modal( 'hide' );
        }
        else if ( $.fn.kendoWindow ) {
            instance.modal.data( 'kendoWindow' ).close();
        }
        // don't set instance.modal to null here or the close handlers in controller won't fire
    }
};

jx.events = {
    beforeSubmit: 'beforeSubmit',
    beforeRequest: 'beforeRequest',
    afterRequest: 'afterRequest',
    beforeUpdateModel: 'beforeUpdateModel',
    afterUpdateModel: 'afterUpdateModel',
    beforeInject: 'beforeInject',
    afterInject: 'afterInject',
    ajaxError: 'ajaxError'
};

jx.config = {
    prefix: 'jx-',
    transition: 'fade-in',
    navHistory: false,
    // This action is executed when a browser nav button is clicked
    // which changes window.location.hash to an empty string.
    // This can be a url, a config object for creating a new request, 
    // or a function which returns a url or config object.
    emptyHashAction: null
};

jx.select = {
    methodOrRequest: [
        '[data-request]:not([disabled])',
        '[data-method][data-trigger*=change]:not([disabled])',
        '[jx-request]:not([disabled])',
        '[data-method]:not([data-trigger],[disabled])',
        '[jx-method]:not([jx-trigger],[disabled])'
    ].join( ',' ),
    methodWithChange: ',[jx-method][jx-trigger*=change]:not([disabled]',
    methodWithEnterOrModel: [
        '[data-method][data-trigger*=enter]:not([disabled])',
        '[jx-method][jx-trigger*=enter]:not([disabled])',
        '[data-model]:not([disabled])',
        '[jx-model]:not([disabled])',
    ].join( ',' ),
    formWithMethod: 'form[data-method],form[jx-method]',
    model: '[data-model],[jx-model]',
    src: '[data-src],[jx-src]',
    preload: '[data-preload],[jx-preload]',
    jxModelAttribute: '[jx-model]',
    jxModel: 'jx-model',
    inputTriggerChangeOrEnter: [
        ':input[name][jx-trigger*=change]',
        ':input[name][data-trigger*=change]',
        ':input[name][jx-trigger*=enter]',
        ':input[name][data-trigger*=enter]'
    ].join( ',' ),
    panel: function ( id ) {
        return '[' + jx.config.prefix + 'panel="' + id + '"],[data-panel="' + id + '"]';
    }
};
