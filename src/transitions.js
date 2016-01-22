
/***********\
 Transitions
\***********/

lojax.Transitions = {
    'replace': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.replaceWith( $new );
        return $new;
    },
    'fade-in': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.fadeOut( 0 ).empty().append( $new.contents() ).fadeIn();
        return $old;
    },
    'append': function ( oldNode, newNode ) {
        // useful for paging
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.append( $new );
        return $new;
    },
    'prepend': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.prepend( $new );
        return $new;
    }
};

