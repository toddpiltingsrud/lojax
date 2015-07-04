/**
 * Created by Todd Piltingsrud on 6/27/2015.
 */

var url = 'http://localhost:1338/';

fdescribe('event handlers', function(){

    it('should handle click', function(done){

        var element = $('<a href="' + url + '" data-method="ajax-get">ajax-get</a>').appendTo('body');

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual(url);
            element.remove();
            done();
        });

    });

    it('data-action should set hash', function(done){

        var hash = '#test?id=1';

        var element = $('<button data-action="' + hash + '" data-method="ajax-get">ajax-get</button>').appendTo('body');

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual(hash);
            expect(window.location.hash).toEqual(hash);
            element.remove();
            done();
        });

    });

    it('should handle hash change', function(done){

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual('#test');
            done();
        });

        window.location.hash = 'test';

    });

    it('should handle input change event', function(done){

        var element = $('<div data-method="ajax-get" data-action="' + url + '" data-form="[name]" data-trigger="change" ><input type="text" name="test" /></div>').appendTo('body');

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual(url);
            element.remove();
            done();
        });

    });

    fit('get should ', function(done){

        var hash = url + '#test?id=1';

        var element = $('<button data-method="get" data-action="' + hash + '">get</button>').appendTo('body');

        $(document).one('beforeRequest', function(evt, request){
            expect(request.action).toEqual(hash);
            element.remove();
            //evt.cancel = true;
        });

        $(document).one('afterRequest', function(evt, request){
            expect(window.location.href).toEqual(hash);
            done();
        });

    });

});