
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
    'flip-horizontal': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        var parent = $old.parent().addClass( 'flip-horizontal' ).css( 'position', 'relative' );
        $old.addClass( 'front' );
        $new.addClass( 'back' ).width( $old.width() ).appendTo( parent );
        setTimeout( function () {
            parent.addClass( 'flip' );
        }, 100 );
        setTimeout( function () {
            $old.remove();
            parent.removeClass( 'flip' ).removeClass( 'flip-horizontal' );
            $new.removeClass( 'back' ).css( 'width', '' );
        }, 1000 );
        return $new;
    },
    'flip-vertical': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        var parent = $old.parent().addClass( 'flip-vertical' ).css( 'position', 'relative' );
        $old.addClass( 'front' );
        $new.addClass( 'back' ).css( 'width', $old.width() ).appendTo( parent );
        setTimeout( function () {
            parent.addClass( 'flip' );
        }, 100 );
        setTimeout( function () {
            $old.remove();
            parent.removeClass( 'flip' ).removeClass( 'flip-vertical' );
            $new.removeClass( 'back' ).css( 'width', '' );
        }, 1000 );
        return $new;
    },
    'slide-left': function ( oldNode, newNode ) {
        var $old = $( oldNode ),
            $new = $( newNode );
        var parent = $old.parent().addClass( 'slide-left' ).css( 'position', 'relative' );
        $old.addClass( 'left' );
        $new.addClass( 'right' ).appendTo( parent );
        setTimeout( function () {
            parent.addClass( 'slide' );
        }, 100 );
        setTimeout( function () {
            $old.remove();
            parent.removeClass( 'slide' ).removeClass( 'slide-left' );
            $new.removeClass( 'right' );
        }, 800 );
        return $new;
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

