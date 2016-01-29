﻿
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
lojax.exec = function ( params ) {
    instance.executeRequest( params );
};

// call this from a script that is located inside a jx-panel or div[data-src]
// executes a callback with the context set to the injected content
lojax.onLoad = function ( callback ) {
    instance.onLoad = callback;
};

lojax.onUnload = function ( callback ) {
    lojax.log( 'lojax.onUnload called' );
    instance.onUnload = callback;
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
    $elem.data( 'model', model );
    priv.setElementsFromModel( $elem, model );
    return model;
};

// This action is executed when a browser nav button is clicked
// which changes window.location.hash to an empty string.
// This can be a url, a config object for creating a new request, 
// or a function which returns a url or config object.
lojax.emptyHashAction = null;

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
        log: function () { }
    };
};

lojax.error = ( console && console.error ) ? console.error : function () { };

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

