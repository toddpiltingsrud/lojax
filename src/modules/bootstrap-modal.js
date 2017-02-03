
/****************\
 Bootstrap modal 
\****************/

( function ( jx ) {

    var bsModal = null;

    var module = {
        canHandle: function ( $node, request ) {
            // don't create more than one modal at a time
            if ( $.fn.modal && $node.is( '.modal' ) && bsModal == null ) {
                module.createModal( $node, request );
                return true;
            }
            return false;
        },
        createModal: function ( content, request ) {
            bsModal = $( content ).appendTo( 'body' ).modal( {
                show: true,
                keyboard: true
            } );
            bsModal.one( 'hidden.bs.modal', function () {
                if ( priv.hasValue( bsModal ) ) {
                    $( bsModal ).remove();
                    bsModal = null;
                }
            } );
            jx.Controller.postInject( bsModal, content, request );
        },
    };

    // add API functions
    jx.createModal = function ( content ) {
        jx.closeModal();
        bsModal = $( content ).modal( {
            show: true,
            keyboard: true
        } );
        bsModal.one( 'hidden.bs.modal', function () {
            if ( priv.hasValue( bsModal ) ) {
                bsModal.off( 'hidden.bs.modal', instance.onModalClose );
                bsModal = null;
            }
        } );
    };

    jx.closeModal = function ( onModalClose ) {
        if ( priv.hasValue( bsModal ) && $.fn.modal ) {
            if ( typeof onModalClose == 'function' ) {
                bsModal.one( 'hidden.bs.modal', onModalClose );
            }
            bsModal.modal( 'hide' );
            // don't set bsModal to null here or the close handlers won't fire
        }
    };

    // register
    jx.registerModule( module.canHandle );

} )( lojax );
