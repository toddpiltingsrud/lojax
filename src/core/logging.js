
/***********\
   logging
\***********/

( function (context) {

    var _logging = 'info';

    Object.defineProperty( context, 'logging', {
        get: function () {
            return _logging;
        },
        set: function ( val ) {
            if ( val === true ) val = 'info';
            _logging = val;
            if ( val && console ) {
                context.log = console.log.bind( console );
                context.info = /info/.test( val ) && console.info ? console.info.bind( console ) : function () { };
                context.warn = /info|warn/.test( val ) && console.warn ? console.warn.bind( console ) : function () { };
                context.debug = /info|warn|debug/.test( val ) && console.debug ? console.debug.bind( console ) : function () { };
            }
            else {
                context.log = context.info = context.warn = context.debug = function () { };
            }
        }
    } );

    // create context.log
    context.logging = 'info';

    context.error = function ( e ) {
        if ( console && console.error ) {
            console.error( e );
        }
    };

} )(lojax);