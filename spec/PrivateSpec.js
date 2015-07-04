/**
 * Created by Todd Piltingrsud on 6/13/2015.
 */
describe('resolveForm', function(){

    it('should find input elements', function () {

        var arr = [1,2,3,4,5];

        arr.forEach(function(i) {
            $('<input type="hidden" name="input' + i + '" value="' + i + '" />').appendTo('body');
        });

        var form = jax.priv.resolveForm({
            form:':input'
        });

        expect(form.size()).toEqual(5);

        $(':input').remove();

    });

    it('should return null if a model is present, even if there is a form element', function () {

        var element = $('<form><input type="hidden" name="input1" value="1" /></form>').appendTo('body');

        var form = jax.priv.resolveForm({
            model:{
                name:'value'
            }
        });

        expect(form).toEqual(null);

        element.remove();

    });

    it('should look for the closest form element if no model or form is present', function () {

        var element = $('<form><input type="hidden" name="input1" value="1" /></form>').appendTo('body');

        var form = jax.priv.resolveForm({
            source:$(element).find('input')
        });

        expect(form.size()).toEqual(1);

        element.remove();

    });

    it('should return null if no form, model, or source', function () {

        var element = $('<form><input type="hidden" name="input1" value="1" /></form>').appendTo('body');

        var form = jax.priv.resolveForm({});

        expect(form).toEqual(null);

        element.remove();

    });

});

describe('resolveAction', function(){

    it('should find a non-empty action', function () {

        var action = jax.priv.resolveAction({
            action:'http://myurl'
        });

        expect(action).toEqual('http://myurl');
    });

    it('should use href of source if action is not present', function () {

        var element = $('<a href="http://myurl/">Do something</a>').appendTo('body');

        var action = jax.priv.resolveAction({
            action:'',
            source:element[0]
        });

        expect(action).toEqual('http://myurl/');

        element.remove();

    });

    it('should ignore #', function () {

        var element = $('<a href="#">Do something</a>').appendTo('body');

        var action = jax.priv.resolveAction({
            action:'',
            source:element[0]
        });

        expect(action).toEqual(null);

        element.remove();

    });

    it('should return null if no action or source', function () {

        var element = $('<a href="javascript:doSomething();">Do something</a>').appendTo('body');

        var action = jax.priv.resolveAction({
        });

        expect(action).toEqual(null);

        element.remove();

    });

});

describe('resolveModel', function(){

    it('should use the source data-model attribute if present', function () {

        var element = $('<a href="javascript:doSomething();" data-model="[1,2,3,4,5]"></a>').appendTo('body');

        var model = jax.priv.resolveModel({
            source:element[0]
        });

        expect(model.length).toEqual(5);

        expect(model[0]).toEqual(1);
    });

    it('should return an object model', function () {

        var model = jax.priv.resolveModel({
            model:{"name":"value"}
        });

        expect(model.name).toEqual('value');
    });

    it('should find and parse a string model', function () {

        var model = jax.priv.resolveModel({
            model:'{"name":"value"}'
        });

        expect(model.name).toEqual('value');
    });

    it('should return null if no model or source', function () {

        var element = $('<a href="javascript:doSomething();"></a>').appendTo('body');

        var model = jax.priv.resolveModel({
            source:element[0]
        });

        expect(model).toEqual(null);

        element.remove();

    });

});

describe('buildForm', function(){

    it('should build a form from a set of input elements', function () {

        var arr = [1,2,3,4,5];

        arr.forEach(function(i) {
            $('<input type="hidden" name="input' + i + '" value="' + i + '" />').appendTo('body');
        });

        var form = jax.priv.buildForm(':input', '');

        expect(form.size()).toEqual(1);

        //console.log(form);

        $('input[name]').remove();
    });

    it('should build a form from a form element', function () {

        var element = $('<form><input type="hidden" name="input1" value="1" /></form>').appendTo('body');

        [1,2,3,4,5].forEach(function(i) {
            $('<input type="hidden" name="input' + i + '" value="' + i + '" />').appendTo(element);
        });

        var form = jax.priv.buildForm('form', 'http://myurl/', 'put');

        expect(form.size()).toEqual(1);

        //console.log(form);

        element.remove();
    });

});

describe('formFromModel', function(){

    it('should build a form from a model', function () {

        var model = {
            name:'Todd',
            arr:[1,2,3,4,5],
            obj:{
                name:'Todd',
                arr:[1,2,3,4,5]
            }
        };

        var form = jax.priv.formFromModel(model);

        expect(form.size()).toEqual(1);

        //console.log(form);

    });

});

