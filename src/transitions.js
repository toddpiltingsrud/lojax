/***********\
 Transitions
\***********/

lojax.Transitions = {
    'replace': function ( oldPanel, newPanel ) {
        $( oldPanel ).replaceWith( newPanel );
        return newPanel;
    },
    'fade-in': function ( oldPanel, newPanel ) {
        oldPanel.fadeOut( 0 ).empty().append( $( newPanel ).contents() ).fadeIn();
        return oldPanel;
    },
    'flip-horizontal': function ( oldPanel, newPanel ) {
        var parent = $( oldPanel ).parent().addClass( 'flip-horizontal' ).css( 'position', 'relative' );
        $( oldPanel ).addClass( 'front' );
        $( newPanel ).addClass( 'back' ).width( oldPanel.width() ).appendTo( parent );
        setTimeout( function () {
            parent.addClass( 'flip' );
        }, 100 );
        setTimeout( function () {
            $( oldPanel ).remove();
            parent.removeClass( 'flip' ).removeClass( 'flip-horizontal' );
            $( newPanel ).removeClass( 'back' ).css( 'width', '' );
        }, 1000 );
        return newPanel;
    },
    'flip-vertical': function ( oldPanel, newPanel ) {
        var parent = $( oldPanel ).parent().addClass( 'flip-vertical' ).css( 'position', 'relative' );
        oldPanel.addClass( 'front' );
        $( newPanel ).addClass( 'back' ).css( 'width', oldPanel.width() ).appendTo( parent );
        setTimeout( function () {
            parent.addClass( 'flip' );
        }, 100 );
        setTimeout( function () {
            oldPanel.remove();
            parent.removeClass( 'flip' ).removeClass( 'flip-vertical' );
            $( newPanel ).removeClass( 'back' ).css( 'width', '' );
        }, 1000 );
        return newPanel;
    },
    'slide-left': function ( oldPanel, newPanel ) {
        var parent = oldPanel.parent().addClass( 'slide-left' ).css( 'position', 'relative' );
        $( oldPanel ).addClass( 'left' );
        $( newPanel ).addClass( 'right' ).appendTo( parent );
        setTimeout( function () {
            parent.addClass( 'slide' );
        }, 100 );
        setTimeout( function () {
            oldPanel.remove();
            parent.removeClass( 'slide' ).removeClass( 'slide-left' );
            $( newPanel ).removeClass( 'right' );
        }, 800 );
        return newPanel;
    },
    'append': function ( oldPanel, newPanel ) {
        // useful for paging
        $( oldPanel ).append( newPanel );
        return newPanel;
    },
    'prepend': function ( oldPanel, newPanel ) {
        $( oldPanel ).prepend( newPanel );
        return newPanel;
    }
};

