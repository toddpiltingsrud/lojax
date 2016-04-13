
/***********\
 Transitions
\***********/

$.extend( jx.Transitions, {

    'empty-append-node': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.empty().append( $new );
        return $old;
    },
    'empty-append-children': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.empty().append( $new.contents() );
        return $old;
    },
    'append-node': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.append( $new );
        return $new;
    },
    'prepend-node': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.prepend( $new );
        return $new;
    },
    'fade-in': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.fadeOut( 0 ).empty().append( $new.contents() ).fadeIn();
        return $old;
    },
    'replace': function ( oldNode, newNode ) {
        // completely replace old node with new node
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.replaceWith( $new );
        return $new;
    }

} );