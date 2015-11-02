/**
 * Created by Todd Piltingsrud on 6/27/2015.
 */

var url = 'http://localhost:1338/';

describe('event handlers', function(){

    xit('should handle click', function(done){

        var element = $('<a href="' + url + '" data-method="ajax-get">ajax-get</a>').appendTo('body');

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual(url);
            element.remove();
            done();
        });

    });

    xit('data-action should set hash', function(done){

        var hash = '#test?id=1';

        var element = $('<button data-action="' + hash + '" data-method="ajax-get">ajax-get</button>').appendTo('body');

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual(hash);
            expect(window.location.hash).toEqual(hash);
            element.remove();
            done();
        });

    });

    xit('should handle hash change', function(done){

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual('#test');
            done();
        });

        window.location.hash = 'test';

    });

    xit('should handle input change event', function(done){

        var element = $('<div data-method="ajax-get" data-action="' + url + '" data-form="[name]" data-trigger="change" ><input type="text" name="test" /></div>').appendTo('body');

        $(document).one('afterRequest', function(evt, request){
            expect(request.action).toEqual(url);
            element.remove();
            done();
        });

    });

    xit('get should ', function(done){

        var hash = url + '#test?id=1';

        var element = $('<button data-method="get" data-action="' + hash + '">get</button>').appendTo('body');

        $(document).one('beforeRequest', function(evt, request){
            expect(request.action).toEqual(hash);
            element.remove();
            evt.cancel = true;
        });

    });

});