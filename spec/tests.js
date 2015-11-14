//jax.logging = true;

var div = null;

$(function () {
    div = $('<div data-jaxpanel="hidden-div" style="display:none"></div>').appendTo('body');
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

QUnit.test("buildPropertyPath", function (assert) {
    window.obj = {};

    var path = 'prop.array1[0].name';

    jax.priv.buildPropertyPath(obj, path);

    path = 'prop.array1[1].name.array2[2]';

    jax.priv.buildPropertyPath(obj, path);

    assert.ok(obj.prop.array1[0].name == null);

    assert.ok(obj.prop.array1[1].name.array2[2] == null);

    window.obj = {};

    path = 'prop.array1[]';

    jax.priv.buildPropertyPath(obj, path);

    assert.ok(obj.prop.array1.length === 0);
});

QUnit.test("bindToModels", function (assert) {
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

QUnit.test("bindToModels", function (assert) {

//    jax.logging = true;

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

    var m = models[0];

    assert.equal(m.number, 1, "Should resolve numbers");

    assert.equal(m.daterange[0], "2015-01-01", "Should resolve dates");

    assert.equal(m.daterange[1], "2015-12-31", "Should resolve dates");

    assert.equal(m.bool, false, "Should resolve bools");

    assert.ok(Array.isArray(m.arrays.names), "Should resolve arrays");

    assert.equal(m.arrays.names.length, 2, "Should populate arrays from checkboxes");

    assert.equal(m.no.value, null, "Inputs with no value should be null");

    //console.log(m);

    var datamodel = modelDiv.data('model');
    
    assert.equal(m, datamodel, "The model can be retrieved using jQuery's data('model') function.");

    // now change some of the values
    modelDiv.find('[name="daterange[0]"]').val('2015-11-13').change();
    modelDiv.find('[name="daterange[1]"]').val('2015-11-15').change();
    modelDiv.find('[name=bool]').prop('checked', true);
    modelDiv.find('[value=Kaleb]').prop('checked', true);

    m = modelDiv.data('model');

    assert.equal(m.daterange[0], "2015-11-13", "Should resolve dates");
    assert.equal(m.daterange[1], "2015-11-15", "Should resolve dates");
    assert.equal(m.bool, true, "Should resolve bools");
    assert.equal(m.arrays.names[2], 'Kaleb', "Should resolve arrays");

    var done = assert.async();

    $(document).one(jax.events.afterUpdateModel, function (evt, obj) {
        assert.ok(true, "model change events are being handled");
        assert.equal(m.number, 5, "Should resolve numbers");
        console.log(obj);
        done();
    });

    modelDiv.find('[type=number]').val(5).change();

    //console.log(m);

    div.empty();
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

QUnit.test("injectContent", function (assert) {
    div.empty();

    window.scriptExecuted = false;

    var done = assert.async();

    $(document).one(jax.events.afterRequest, function () {
        assert.ok(true, "async content was loaded");

        var datamodel = div.find('[data-model]').data('model');

        assert.ok(window.scriptExecuted === true, "scripts should run");

        done();
    });

    $('<button data-method="ajax-get" data-action="/Home/ModelTest">').appendTo(div).click().remove();
});

QUnit.test("injectContent", function (assert) {
    div.empty();

    window.scriptExecuted = false;

    var done = assert.async();

    div.append('<input id="testinput" type="text" value="0" />');

    $(document).one(jax.events.afterRequest, function () {
        assert.equal(window.testvalue, "1", "new content should be queried by new script");
        assert.equal(window.testvalue2, true, "loose scripts should run");
        done();
    });

    $('<button data-method="ajax-get" data-action="/File/InjectTest">').appendTo(div).click().remove();
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
