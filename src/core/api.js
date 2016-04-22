// prevent this script from running more than once
if ( jx.Controller ) return;

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

Object.getOwnPropertyNames( jx.events ).forEach( function ( prop ) {
    jx[prop] = function ( handler ) {
        if ( typeof handler == 'function' ) {
            $( document ).on( lojax.events[prop], handler );
        }
    };
} );

jx.config = {
    prefix: 'jx-',
    transition: 'fade-in',
    navHistory: false,
    setNavHistory: function(b) {
        jx.config.navHistory = b;
        b ? window.addEventListener( "hashchange", jx.Controller.handleHash, false )
          : window.removeEventListener( "hashchange", jx.Controller.handleHash, false );
    },
    // This action is executed when a browser nav button is clicked
    // which changes window.location.hash to an empty string.
    // This can be a url, a config object for creating a new request, 
    // or a function which returns a url or config object.
    emptyHashAction: null
};

jx.select = {
    methodOrRequest: '[data-request],[jx-request],[data-method]:not([data-trigger]),[jx-method]:not([jx-trigger])',
    methodWithChange: '[data-method][data-trigger*=change],[jx-method][jx-trigger*=change]',
    methodWithEnterOrModel: '[data-method][data-trigger*=enter],[jx-method][jx-trigger*=enter],[data-model],[jx-model]',
    formWithMethod: 'form[data-method],form[jx-method]',
    model: '[data-model],[jx-model]',
    panel: function ( id ) {
        return '[' + lojax.config.prefix + 'panel="' + id + '"],[data-panel="' + id + '"]';
    },
    src: '[data-src],[jx-src]',
    preload: '[data-preload],[jx-preload]',
    jxModelAttribute: '[jx-model]',
    jxModel: 'jx-model',
    inputTriggerChangeOrEnter: ':input[name][jx-trigger*=change],:input[name][data-trigger*=change],:input[name][jx-trigger*=enter],:input[name][data-trigger*=enter]'
};
