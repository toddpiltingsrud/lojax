/**
 * Created by Todd Piltingsrud on 5/30/2015.
 */

var logError = function(err) {
    var error = [];
    Object.getOwnPropertyNames(err).forEach(function (name) {
        if (typeof err[name] !== 'function') {
            error.push(err[name]);
        }
    });
    console.log(error);
};

describe('Request', function () {

    it('getSearch should serialize inputs', function(){

        var arr = [1,2,3,4,5];

        arr.forEach(function(i) {
            $('<input type="hidden" name="input' + i + '" value="' + i + '" />').appendTo('body');
        });

        var req = new jax.Request({
            method:'ajax-get',
            action:'myurl/',
            form:':input'
        });

        var search = req.getSearch();

        expect(search).toEqual('input1=1&input2=2&input3=3&input4=4&input5=5');

        $('input').remove();

    });

    it('getSearch should serialize a model', function(){

        var model = {
            name:'Todd',
            arr:[1,2,3,4,5],
            obj:{
                name:'Todd',
                arr:[1,2,3,4,5]
            }
        };

        var req = new jax.Request({
            method:'ajax-get',
            action:'myurl/',
            model:model
        });

        var search = req.getSearch();

        expect(search).toEqual('name=Todd&arr%5B%5D=1&arr%5B%5D=2&arr%5B%5D=3&arr%5B%5D=4&arr%5B%5D=5&obj%5Bname%5D=Todd&obj%5Barr%5D%5B%5D=1&obj%5Barr%5D%5B%5D=2&obj%5Barr%5D%5B%5D=3&obj%5Barr%5D%5B%5D=4&obj%5Barr%5D%5B%5D=5');
    });

    it('getSearch should serialize a model', function(){

        var req = new jax.Request({
            method:'ajax-get',
            action:'myurl/',
            model:'{"name":"value"}'
        });

        var search = req.getSearch();

        expect(req.model.name).toEqual('value');

        expect(search).toEqual('name=value');
    });

    it('ajax-get', function (done) {

        var request = new jax.Request({
            method:'ajax-get',
            action:'http://localhost:1338'
        });

        request.exec().
            then(function(response){
                expect(response.method).toEqual('GET');
                done();
            }).
            catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });

    });

    it('ajax-post', function (done) {

        var request = new jax.Request({
            method:'ajax-post',
            action:'http://localhost:1338'
        });

        request.exec().
            then(function(response){
                expect(response.method).toEqual('POST');
                done();
            }).
            catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });

    });

    it('ajax-put', function (done) {

        var request = new jax.Request({
            method:'ajax-put',
            action:'http://localhost:1338'
        });

        request.exec().
            then(function(response){
                expect(response.method).toEqual('PUT');
                done();
            }).
            catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });
    });

    it('ajax-delete', function (done) {

        var request = new jax.Request({
            method:'ajax-delete',
            action:'http://localhost:1338'
        });

        request.exec().
            then(function(response){
                expect(response.method).toEqual('DELETE');
                done();
            }).
            catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });
    });

    xit('should cancel', function (done) {

        $(document).one('beforeRequest', function(evt){
            evt.cancel = true;
            expect(evt.cancel).toEqual(true);
        });

        $(document).one('afterRequest', function(evt){
            done();
        });

        var request = new jax.Request({
            method:'get',
            action:'http://localhost:1338'
        })
            .exec()
            .then(function(response){
                expect(response).toEqual('not!');
                done();
            })
            .catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });

        $(document).off('beforeRequest');

        $(document).off('afterRequest');

    });

    xit('should post', function (done) {

        $(document).one('beforeRequest', function(evt){
            expect(true).toEqual(true);
        });

        $(document).one('afterRequest', function(evt){
            expect(true).toEqual(true);
            done();
        });

        var request = new jax.Request({
            method:'post',
            action:'http://localhost:1338'
        })
            .exec()
            .then(function(response){
                expect(response).toEqual('not!');
                done();
            })
            .catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });

//        expect(true).toEqual('not!');

        //done();
    });

    xit('put', function (done) {

        $(document).one('beforeRequest', function(evt){
            expect(true).toEqual(true);
        });

        $(document).one('afterRequest', function(evt){
            expect(true).toEqual(true);
            done();
        });

        var request = new jax.Request({
            method:'put',
            action:'http://localhost:1338'
        })
            .exec()
            .then(function(response){
                expect(response).toEqual('not!');
                done();
            })
            .catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });

//        expect(true).toEqual('not!');

        //done();
    });

    it('delete', function (done) {

        $(document).one('beforeRequest', function(evt){
            expect(true).toEqual(true);
        });

        $(document).one('afterRequest', function(evt){
            expect(true).toEqual(true);
            done();
        });

        var request = new jax.Request({
            method:'delete',
            action:'http://localhost:1338'
        })
            .exec()
            .then(function(response){
                expect(response).toEqual('not!');
                done();
            })
            .catch(function(error){
                logError(error);
                expect(error).toEqual('not!');
                done();
            });

//        expect(true).toEqual('not!');

        done();
    });

    it ('undefined action should do nothing', function(){
        $(document).one('beforeRequest', function(evt){
            expect('beforeRequest').toEqual('should not fire');
        });

        $(document).one('afterRequest', function(evt){
            expect('afterRequest').toEqual('should not fire');
        });

        var request = new jax.Request({
            method:'ajax-post'
        }).exec();

        $(document).off('beforeRequest');

        $(document).off('afterRequest');
    });

    it ('empty action should do nothing', function(){
        $(document).one('beforeRequest', function(evt){
            expect('beforeRequest').toEqual('should not fire');
        });

        $(document).one('afterRequest', function(evt){
            expect('afterRequest').toEqual('should not fire');
        });

        var request = new jax.Request({
            method:'ajax-post',
            action:''
        }).exec();

        $(document).off('beforeRequest');

        $(document).off('afterRequest');
    });

    xit ('empty action should do nothing', function(done){

        var a = $('<a href="" data-method="ajax-get">Empty action</a>')
            .appendTo("body");

        $(document).one('beforeRequest', function(evt){
            //console.log('before request');
        });

        $(document).one('afterRequest', function(evt){
            //console.log('after request');
            expect(true).toEqual(true);
            a.remove();
            done();
        });

    });

});

describe('getForm', function(){

    it('should build a form from a model', function () {

        var model = {
            name:'Todd',
            arr:[1,2,3,4,5],
            obj:{
                name:'Todd',
                arr:[1,2,3,4,5]
            }
        };

        var req = new jax.Request({
            method:'ajax-get',
            action:'myurl/',
            model:model
        });

        var form = req.getForm();

        expect(form.size()).toEqual(1);

    });

    it('should build a form from input elements', function () {

        var arr = [1,2,3,4,5];

        arr.forEach(function(i) {
            $('<input type="hidden" name="input' + i + '" value="' + i + '" />').appendTo('body');
        });

        var req = new jax.Request({
            method:'ajax-get',
            action:'myurl/',
            form:':input'
        });

        var form = req.getForm();

        expect(form.size()).toEqual(1);

    });

    it('should return a blank form if no form or model', function () {

        var arr = [1,2,3,4,5];

        arr.forEach(function(i) {
            $('<input type="hidden" name="input' + i + '" value="' + i + '" />').appendTo('body');
        });

        var req = new jax.Request({
            method:'ajax-get',
            action:'myurl/'
        });

        var form = req.getForm();

        //console.log(form);

        expect(form.size()).toEqual(1);

    });

});
