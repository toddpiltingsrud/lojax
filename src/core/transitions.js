
/***********\
 Transitions
\***********/

lojax.extend( lojax.Transitions, {

    'replace-content': function ( oldNode, newNode ) {
        // empty->append->new
        // inject newNode into oldNode
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.empty().append( $new );
        return $old;
    },
    'swap-content': function ( oldNode, newNode ) {
        // empty->append->new.contents
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.empty().append( $new.contents() );
        return $old;
    },
    'fade-in': function ( oldNode, newNode ) {
        // fadeOut->empty->append->new.contents->fadeIn
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.fadeOut( 0 ).empty().append( $new.contents() ).fadeIn();
        return $old;
    },
    'replace': function ( oldNode, newNode ) {
        // old.replaceWidth(new)
        // completely replace old node with new node
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.replaceWith( $new );
        return $new;
    },
    'append': function ( oldNode, newNode ) {
        // old.append->new
        // append new node to old node
        // useful for endless scrolling
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.append( $new );
        return $new;
    },
    'prepend': function ( oldNode, newNode ) {
        // old.prepend->new
        // prepend new node to old node
        // useful for adding new rows to tables
        var $old = $( oldNode ),
            $new = $( newNode );
        $old.prepend( $new );
        return $new;
    }

} );