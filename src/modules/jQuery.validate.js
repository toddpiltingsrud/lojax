
/***************\
 jQuery validate
\***************/

$( function () {

    var canValidate = $.validator
        && $.validator.unobtrusive
        && $.validator.unobtrusive.parse;

    function addRules( evt, context ) {
        context.filter( 'form' ).add(context.find('form')).each( function () {
            $.validator.unobtrusive.parse( this );
        } );
    }

    function validate( evt, request ) {
        request.form.filter( 'form' ).add( request.form.find( 'form' ) ).each( function () {
            $( this ).validate();
            if ( $( this ).valid() == false ) {
                request.cancel = true;
            }
        } );
    }

    if ( canValidate ) {
        $( document ).off( lojax.events.afterInject, addRules );
        $( document ).on( lojax.events.afterInject, addRules );
        $( document ).off( lojax.events.beforeRequest, validate );
        $( document ).on( lojax.events.beforeRequest, validate );
    }

} );