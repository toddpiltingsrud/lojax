/**
 * Created by kitntodd on 6/13/2015.
 */
xdescribe('injectContent', function(){

    it('should use fade-in as default transition', function(done){

        // create old content
        $('<div><p data-jaxpanel="panel1">This is a test</p></div>').appendTo('body');

        setTimeout(function() {
            var html = '<div><p data-jaxpanel="panel1">This is another test.</p></div>';

            jax.instance.injectContent(null, html);

            setTimeout(done, 1000);
        }, 1000);

    });

    it('should use the specified transition', function(done){

        // create old content
        $('<div><p data-jaxpanel="panel1">This is a test</p></div>').appendTo('body');

        setTimeout(function() {
            var html = '<div><p data-jaxpanel="panel1" data-transition="flip-horizontal">This is another test.</p></div>';

            jax.instance.injectContent(null, html);

            setTimeout(done, 1000);
        }, 1000);

    });

});