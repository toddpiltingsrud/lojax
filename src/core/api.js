
/***********\
    API
\***********/

var priv = {};
var rexp = {};
lojax.Controller = {};
lojax.Transitions = {};
var instance = lojax.Controller;
lojax.priv = priv;

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
lojax.exec = function ( params ) {
    instance.executeRequest( params );
};

// call this from a script that is located inside a jx-panel, div[data-src] or .modal
// executes a callback with the context set to the injected node
lojax.in = function ( callback ) {
    lojax.info( 'lojax.in called' );
    instance.in = callback;
};

lojax.out = function ( callback ) {
    lojax.info( 'lojax.out called' );
    instance.out = callback;
};

lojax.createModal = function ( content ) {
    lojax.closeModal();
    instance.modal = $( content ).modal( {
        show: true,
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
};

lojax.closeModal = function () {
        lojax.info( 'createModal: closeModal called' );
    if ( priv.hasValue( instance.modal ) ) {
        if ( $.fn.modal ) {
            instance.modal.modal( 'hide' );
        }
        else if ( $.fn.kendoWindow ) {
            instance.modal.data( 'kendoWindow' ).close();
        }
        instance.modal = null;
    }
};

// This action is executed when a browser nav button is clicked
// which changes window.location.hash to an empty string.
// This can be a url, a config object for creating a new request, 
// or a function which returns a url or config object.
lojax.emptyHashAction = null;

lojax.events = {
    beforeSubmit: 'beforeSubmit',
    beforeRequest: 'beforeRequest',
    afterRequest: 'afterRequest',
    beforeUpdateModel: 'beforeUpdateModel',
    afterUpdateModel: 'afterUpdateModel',
    beforeInject: 'beforeInject',
    afterInject: 'afterInject',
    ajaxError: 'ajaxError'
};

lojax.config = {
    prefix: 'jx-',
    transition: 'fade-in',
    navHistory: true
};

lojax.select = {
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

lojax.extend = function ( target, source ) {
    target = target || {};
    Object.getOwnPropertyNames( source ).forEach( function ( prop ) {
        target[prop] = source[prop];
    } );
    return target;
};
