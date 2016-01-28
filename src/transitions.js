
/***********\
 Transitions
\***********/

lojax.Transitions = {
    'swap-content': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.empty().append( $new.contents() );
        return $old;
    },
    'fade-in': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.fadeOut( 0 ).empty().append( $new.contents() ).fadeIn();
        return $old;
    },
    'replace': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.replaceWith( $new );
        return $new;
    },
    'append': function ( oldNode, newNode ) {
        // useful for endless scrolling
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.append( $new );
        return $new;
    },
    'prepend': function ( oldNode, newNode ) {
        // useful for adding new rows to tables
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.prepend( $new );
        return $new;
    }
};

