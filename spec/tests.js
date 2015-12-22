var tests = tests || {};

var div = null;

Object.defineProperty(tests, 'log', {
    get: function () {

        return window.location.search.indexOf('log') !== -1;
    }
});

$(function () {
    div = $('<div id="div1" data-jaxpanel="hidden-div" style="display:none"></div>').appendTo('body');
});

QUnit.test("click event handler", function (assert) {
    var done = assert.async();
    $(document).on('clicktest', function () {
        assert.ok(true, "click was handled by lojax");
        done();
    });

    // click should be handled
    $('<button data-method="ajax-get" data-action="/raiseevent/clicktest">').appendTo(div).click().remove();

    // click should not be handled
    $('<button data-method="ajax-get" data-action="/raiseevent/clicktest" data-trigger="change">').appendTo(div).click().remove();
});

QUnit.test("change event handler", function (assert) {
    var done1 = assert.async();

    $(document).on('changetest', function () {
        assert.ok(true, "change was handled by lojax");
        done1();
    });

    // change should be handled
    $('<input type="text" data-method="ajax-get" data-action="/raiseevent/changetest" data-trigger="change">').appendTo(div).change().remove();

    // change should not be handled because no data-method attribute
    $('<input type="text" data-action="/raiseevent" data-trigger="change">').appendTo(div).change().remove();
});

QUnit.test("getObjectAtPath", function (assert) {
    window.obj = {};

    var path = 'prop.array1[0].name';

    var result = jax.priv.getObjectAtPath(obj, path, true);

    assert.equal(Array.isArray(result), true);

    window.obj = {};

    path = 'prop.array1[1].name.array2[2]';

    result = jax.priv.getObjectAtPath(obj, path);

    assert.equal(obj.prop.array1[0], undefined);

    assert.ok(obj.prop.array1[1].name.array2[2] == null, 'should resolve arrays');

    console.log(obj);

    window.obj = {};

    path = 'prop.array1[0]';

    var result = jax.priv.getObjectAtPath(obj, path);

    assert.equal(Array.isArray(result), true);

    // start anew
    window.obj = {};

    path = 'prop.arrays.names';

    var result = jax.priv.getObjectAtPath(obj, path, true);

    assert.equal(Array.isArray(result), true);


});

QUnit.test("getModelValue", function (assert) {

    var model = { "number": 5, "daterange": ["2015-11-13", "2015-11-15"], "bool": true, "arrays": { "names": ["Kit", "Todd"] } };

    var result = jax.priv.getModelValue(model, 'number');
    assert.equal(result, 5);

    result = jax.priv.getModelValue(model, 'daterange[1]');
    assert.equal(result, "2015-11-15");

    result = jax.priv.getModelValue(model, 'arrays.names');
    assert.ok(Array.isArray(result));

    result = jax.priv.getModelValue(model, 'arrays.names.length');
    assert.equal(result, 2);

});

QUnit.test("bindToModels1", function (assert) {
    var input = $('<input data-model type="number" name="number" value="1" />');

    div.append(input);

    var models = jax.instance.bindToModels(input);

    assert.equal(models.length, 1, "Should find one model")

    input.remove();

    input = $('<input type="number" name="number" value="1" />');

    div.append(input);

    var models = jax.instance.bindToModels(input);

    assert.equal(models.length, 0, "Should find zero models")

    div.empty();
});

QUnit.test("bindToModels2", function (assert) {

    //jax.logging = true;

    var modelDiv = $('<div data-model></div>');

    modelDiv.append('<input type="number" name="number" value="1" />');
    modelDiv.append('<input type="date" name="daterange[0]" value="2015-01-01" />');
    modelDiv.append('<input type="date" name="daterange[1]" value="2015-12-31" />');
    modelDiv.append('<input type="checkbox" name="bool" value="true" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Todd" checked="checked" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Kit" checked="checked" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Anders" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Kaleb" />');
    modelDiv.append('<input type="text" name="no.value" />');

    div.append(modelDiv);

    var models = jax.instance.bindToModels(modelDiv);

    assert.equal(models.length, 1, "Should create one model");

    if (tests.log) {
        console.log(models);
    }

    var m = models[0];

    assert.equal(m.number, 1, "Should resolve numbers");

    assert.equal(m.daterange[0], "2015-01-01", "Should resolve dates");

    assert.equal(m.daterange[1], "2015-12-31", "Should resolve dates");

    assert.equal(m.bool, false, "Should resolve bools");

    assert.ok(Array.isArray(m.arrays.names), "Should resolve arrays");

    assert.equal(m.arrays.names.length, 2, "Should populate arrays from checkboxes");

    assert.equal(m.no.value, null, "Inputs with no value should be null");

    var datamodel = modelDiv.data('model');
    
    assert.equal(m, datamodel, "The model can be retrieved using jQuery's data('model') function.");

    console.log(datamodel);

    // now change some of the values
    modelDiv.find('[name="daterange[0]"]').val('2015-11-13').change();
    modelDiv.find('[name="daterange[1]"]').val('2015-11-15').change();
    modelDiv.find('[name=bool]').prop('checked', true).change();
    modelDiv.find('[value=Kaleb]').prop('checked', true).change();

    assert.equal(m.daterange[0], "2015-11-13", "Should resolve dates");
    assert.equal(m.daterange[1], "2015-11-15", "Should resolve dates");
    assert.equal(m.bool, true, "Should resolve bools");
    assert.equal(m.arrays.names[2], 'Kaleb', "Should resolve arrays");
    assert.equal(m.arrays.names.length, 3);

    modelDiv.find('[value=Kaleb]').prop('checked', false).change();

    assert.equal(m.arrays.names.length, 2);

    modelDiv.find('[value=Todd]').prop('checked', false).change();

    assert.equal(m.arrays.names.length, 1);

    var done = assert.async();

    $(document).one(jax.events.afterUpdateModel, function (evt, obj) {
        assert.ok(true, "model change events are being handled");
        assert.equal(m.number, 5, "Should resolve numbers");
        done();
    });

    modelDiv.find('[type=number]').val(5).change();

    div.empty();
});

QUnit.test("bindToModels3", function (assert) {

    var modelDiv = $('<div data-model></div>');

    var model = { "number": 5, "daterange": ["2015-11-13", "2015-11-15"], "bool": true, "arrays": { "names": ["Kit", "Todd"] } };

    modelDiv.data('model', model);

    modelDiv.append('<input type="number" name="number" />');
    modelDiv.append('<input type="date" name="daterange[0]" />');
    modelDiv.append('<input type="date" name="daterange[1]" />');
    modelDiv.append('<input type="checkbox" name="bool" value="true" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Todd" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Kit" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Anders" />');
    modelDiv.append('<input type="checkbox" name="arrays.names" value="Kaleb" />');
    modelDiv.append('<input type="text" name="no.value" />');

    div.append(modelDiv);

    jax.logging = true;

    assert.equal(modelDiv.find('[name=number]').val(), '');
    assert.equal(modelDiv.find('[name="daterange[0]"]').val(), '');
    assert.equal(modelDiv.find('[name="daterange[1]"]').val(), '');
    assert.equal(modelDiv.find('[name=bool]').prop('checked'), false);
    assert.equal(modelDiv.find('[value=Kit]').prop('checked'), false);
    assert.equal(modelDiv.find('[value=Todd]').prop('checked'), false);
    assert.equal(modelDiv.find('[value=Anders]').prop('checked'), false);
    assert.equal(modelDiv.find('[value=Kaleb]').prop('checked'), false);

    jax.instance.bindToModels();

    assert.equal(modelDiv.find('[name=number]').val(), '5');
    assert.equal(modelDiv.find('[name="daterange[0]"]').val(), '2015-11-13');
    assert.equal(modelDiv.find('[name="daterange[1]"]').val(), '2015-11-15');
    assert.equal(modelDiv.find('[name=bool]').prop('checked'), true);
    assert.equal(modelDiv.find('[value=Kit]').prop('checked'), true);
    assert.equal(modelDiv.find('[value=Todd]').prop('checked'), true);
    assert.equal(modelDiv.find('[value=Anders]').prop('checked'), false);
    assert.equal(modelDiv.find('[value=Kaleb]').prop('checked'), false);

    model.arrays.names.push('Kaleb');
    jax.instance.bindToModels();
    assert.equal(modelDiv.find('[value=Kaleb]').prop('checked'), true);

    jax.logging = false;
});

QUnit.test("loadAsyncContent", function (assert) {
    div.empty();

    var done = assert.async();

    $(document).one(jax.events.afterRequest, function () {
        assert.ok(true, "async content was loaded");

        var datamodel = div.find('[data-model]').data('model');

        console.log(datamodel);

        done();
    });

    div.append('<div data-src="/Home/ModelTest"></div>');

    jax.instance.loadAsyncContent(div);

});

QUnit.test("injectContent1", function (assert) {
    div.empty();

    window.scriptExecuted = false;

    var done = assert.async();

    $(document).one(jax.events.afterRequest, function () {
        assert.ok(true, "async content was loaded");

        assert.ok(window.scriptExecuted === true, "scripts should run");

        done();
    });

    $('<button data-method="ajax-get" data-action="/Home/ModelTest">').appendTo(div).click().remove();
});

QUnit.test("injectContent2", function (assert) {
    div.empty();

    window.scriptExecuted = false;

    var done = assert.async();

    $(document).one(jax.events.afterRequest, function () {
        assert.equal(window.testvalue, "1", "new content should be queried by new script");
        assert.equal(window.testvalue2, true, "loose scripts should run");
        done();
    });

    $('<button data-method="ajax-get" data-action="/File/InjectTest">').appendTo(div).click().remove();
});

QUnit.test("event order", function (assert) {
    div.empty();

    var done = assert.async();

    var beforeInjectFired = false;

    $(document).one(jax.events.beforeInject, function (evt, request) {
        beforeInjectFired = true;
    });

    $(document).one(jax.events.afterRequest, function (evt, request) {
        assert.equal(beforeInjectFired, true, "beforeInject should fire before afterRequest");
        done();
    });

    $('<button data-method="ajax-get" data-action="/File/InjectTest">').appendTo(div).click().remove();
});

QUnit.test("injectContent3 empty response", function (assert) {
    div.empty();

    var done = assert.async();

    var beforeInjectFired = false;

    $(document).one(jax.events.beforeInject, function (evt, request) {
        beforeInjectFired = true;
    });

    $(document).one(jax.events.afterRequest, function (evt, request) {
        assert.ok(true, "empty response should not throw an error");
        assert.equal(beforeInjectFired, false, "empty response should return from injectContent early");
        done();
    });

    $('<button data-method="ajax-get" data-action="/EmptyResponse">').appendTo(div).click().remove();
});

QUnit.test("handleHash", function (assert) {
    div.empty();

    var done = assert.async();

    $(document).on('handleHashTest', function () {
        assert.ok(true, "hash change was handled");
        done();
    });

    $('<input type="text" data-method="ajax-get" data-action="#/raiseevent/handleHashTest">').appendTo(div).click().remove();

});

QUnit.test("callIn", function (assert) {
    div.empty();

    var div2 = $('<div data-jaxpanel="hidden-div2" style="display:none"></div>').appendTo('body');

    var done = assert.async();
    var done2 = assert.async();

    window.callInTest = function (val) {
        assert.ok(true, "jax.in called");
        assert.equal(val, 'call-in-test', "");
        done();
    };

    window.callInTest2 = function (val) {
        assert.ok(true, "jax.in called");
        assert.equal(val, 'call-in-test2', "");
        done2();
    };

    $('<button data-method="ajax-get" data-action="/File/CallInTest">').appendTo(div).click().remove();
});

QUnit.test("buildForm", function (assert) {
    div.empty();

    // test form serialization
    var form = $('<form></form>').appendTo(div);
    form.append('<select name="select1"><option value="1">One</option><option value="2" selected="selected">Two</option><option value="3">Three</option></select>');
    form.append('<input type="number" name="number1" value="1" />');
    form.append('<input type="date" name="daterange[0]" value="2015-01-01" />');
    form.append('<input type="date" name="daterange[1]" value="2015-12-31" />');
    form.append('<input type="checkbox" name="bool" value="true" />');
    form.append('<input type="checkbox" name="arrays.names" value="Todd" checked="checked" />');
    form.append('<input type="checkbox" name="arrays.names" value="Kit" checked="checked" />');
    form.append('<input type="checkbox" name="arrays.names" value="Anders" />');
    form.append('<input type="checkbox" name="arrays.names" value="Kaleb" />');
    form.append('<input type="text" name="no.value" />');

    // add inputs outside the form
    var div2 = $('<div id="div2"></div>').appendTo(div);
    div2.append('<select name="select2"><option value="1">One</option><option value="2">Two</option><option value="3" selected="selected">Three</option></select>');
    div2.append('<input type="number" name="number2" value="2" />');
    div2.append('<input type="radio" name="radio1" value="Todd" />');
    div2.append('<input type="radio" name="radio1" value="Kit" checked="checked" />');

    // add some inputs that the selector should NOT include
    var div3 = $('<div id="div3"></div>').appendTo(div);
    div3.append('<select name="select3"><option value="1" selected="selected">One</option><option value="2">Two</option><option value="3">Three</option></select>');
    div3.append('<input type="number" name="number3" value="3" />');

    var selector = $('#div1 form,#div2 [name]');

    var builtForm = jax.priv.buildForm(selector);

    var serialized = builtForm.serialize();

    var shouldBe = 'select1=2&number1=1&daterange%5B0%5D=2015-01-01&daterange%5B1%5D=2015-12-31&arrays.names=Todd&arrays.names=Kit&no.value=&select2=3&number2=2&radio1=Kit';

    assert.equal(builtForm.children().length, 10, 'Should have 10 input elements');

    assert.equal(serialized, shouldBe, 'Should create a form');

});

QUnit.test('make sure logging is turned off', function (assert) {
    div.empty();

    assert.equal(jax.logging, false);

});

