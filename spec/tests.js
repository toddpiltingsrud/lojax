var tests = tests || {};

var div = null;

var getForm = function () {
    var out = [];

    out.push( '<input type="number" name="number" value="5" />' );
    out.push( '<input type="date" name="daterange[0]" value="2015-01-01" />' );
    out.push( '<input type="date" name="daterange[1]" value="2015-12-31" />' );
    out.push( '<input type="checkbox" name="bool" value="true" checked="checked" />' );
    out.push( '<input type="checkbox" name="arrays.names" value="Todd" checked="checked" />' );
    out.push( '<input type="checkbox" name="arrays.names" value="Kit" checked="checked" />' );
    out.push( '<input type="checkbox" name="arrays.names" value="Anders" />' );
    out.push( '<input type="checkbox" name="arrays.names" value="Kaleb" />' );
    out.push( '<input type="text" name="no.value" />' );
    out.push( '<select name="select">' );
    out.push( '<option>Select one...</option> ' );
    out.push( '<option value="a">A</option> ' );
    out.push( '<option value="b" selected="selected">B</option> ' );
    out.push( '<option value="c">C</option> ' );
    out.push( '</select>' );
    out.push( '<input type="radio" name="color" value="red" checked="checked" />' );
    out.push( '<input type="radio" name="color" value="green" />' );
    out.push( '<input type="radio" name="color" value="blue" />' );
    out.push( '<input type="radio" name="color" value="cyan" />' );

    return out.join( '' );
};

Object.defineProperty( tests, 'log', {
    get: function () {

        return window.location.search.indexOf( 'log' ) !== -1;
    }
} );

$( function () {

    div = $( '<div id="div1" data-jaxpanel="hidden-div" style="display:none"></div>' ).appendTo( 'body' );
} );

QUnit.test( 'jQuery data function', function ( assert ) {
    div.empty();

    var button = $( '<input type="submit" data-method="ajax-post" jx-action="/save" />' );

    var obj = button.data();

    var attributes = 'method action transition target form model cache expire renew'.split(' ');

    attributes.forEach( function ( attr ) {
        var name = 'jx-' + attr;
        if ( !( attr in obj ) ) {
            var val = button.attr( name );
            if ( val !== undefined ) {
                obj[attr] = val;
            }
        }
    } );

    console.log( obj );

    assert.equal( lojax.logging, false );

} );

QUnit.test( 'click event handler', function ( assert ) {

    var done = assert.async();
    $( document ).on( 'clicktest', function () {

        assert.ok( true, 'click was handled by lojax' );
        done();
    } );

    //click should be handled
    $( '<button data-method="ajax-get" data-action="/raiseevent/clicktest">' ).appendTo( div ).click().remove();

    //click should not be handled
    $( '<button data-method="ajax-get" data-action="/raiseevent/clicktest" data-trigger="change">' ).appendTo( div ).click().remove();
} );

QUnit.test( 'change event handler', function ( assert ) {

    var done1 = assert.async();

    $( document ).on( 'changetest', function () {
        assert.ok( true, 'change was handled by lojax' );
        done1();
    } );

    //change should be handled
    $( '<input type="text" data-method="ajax-get" data-action="/raiseevent/changetest" data-trigger="change">' ).appendTo( div ).change().remove();

    //change should not be handled because no data-method attribute
    $( '<input type="text" data-action="/raiseevent" data-trigger="change">' ).appendTo( div ).change().remove();
} );

QUnit.test( 'getObjectAtPath', function ( assert ) {

    var obj = window.obj = {};

    var path = 'prop.array1[0].name';

    var result = lojax.priv.getObjectAtPath( obj, path, true );

    assert.equal( Array.isArray( result ), true );

    //start anew
    obj = window.obj = {};

    path = 'prop.array1[1].name.array2[2]';

    result = lojax.priv.getObjectAtPath( obj, path );

    assert.equal( obj.prop.array1[0], undefined );

    assert.ok( obj.prop.array1[1].name.array2[2] == null, 'should resolve arrays' );

    console.log( obj );

    //start anew
    obj = window.obj = {};

    path = 'prop.array1[0]';

    var result = lojax.priv.getObjectAtPath( obj, path );

    assert.equal( Array.isArray( result ), true );

    //start anew
    obj = window.obj = {};

    path = 'prop.arrays.names';

    var result = lojax.priv.getObjectAtPath( obj, path, true );

    assert.equal( Array.isArray( result ), true );


} );

QUnit.test( 'getModelValue', function ( assert ) {

    var model = { number: 5, daterange: ['2015-11-13', '2015-11-15'], bool: true, arrays: { names: ['Kit', 'Todd'] } };

    var result = lojax.priv.getModelValue( model, 'number' );
    assert.equal( result, 5 );

    result = lojax.priv.getModelValue( model, 'daterange[1]' );
    assert.equal( result, '2015-11-15' );

    result = lojax.priv.getModelValue( model, 'arrays.names' );
    assert.ok( Array.isArray( result ) );

    result = lojax.priv.getModelValue( model, 'arrays.names.length' );
    assert.equal( result, 2 );

} );

QUnit.test( 'bindToModels1', function ( assert ) {
    div.empty();

    var input = $( '<input data-model type="number" name="number" value="1" />' );

    div.append( input );

    var models = lojax.instance.bindToModels( input );

    assert.equal( models.length, 1, 'Should find one model' );

    input.remove();

    input = $( '<input type="number" name="number" value="1" />' );

    div.append( input );

    var models = lojax.instance.bindToModels( input );

    assert.equal( models.length, 0, 'Should find zero models' );

} );

QUnit.test( 'bindToModels2', function ( assert ) {

    div.empty();

    var modelDiv = $( '<div data-model></div>' );

    modelDiv.append( getForm() );

    div.append( modelDiv );

    var models = lojax.instance.bindToModels( modelDiv );

    assert.equal( models.length, 1, 'Should create one model' );

    var m = models[0];

    assert.equal( m.number, 5, 'Should resolve numbers' );

    assert.equal( m.daterange[0], '2015-01-01', 'Should resolve dates' );

    assert.equal( m.daterange[1], '2015-12-31', 'Should resolve dates' );

    assert.strictEqual( m.bool, true, 'Should resolve bools' );

    assert.ok( Array.isArray( m.arrays.names ), 'Should resolve arrays' );

    assert.strictEqual( m.arrays.names.length, 2, 'Should populate arrays from checkboxes' );

    assert.strictEqual( m.color, 'red', 'Should resolve radio buttons' );

    assert.strictEqual( m.no.value, null, 'Inputs with no value should be null' );

    var datamodel = modelDiv.data( 'model' );

    assert.equal( m, datamodel, "The model can be retrieved using jQuery's data ( 'model' )  function." );

    console.log( datamodel );

    //now change some of the values
    modelDiv.find( '[name="daterange[0]"]' ).val( '2015-11-13' ).change();
    modelDiv.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
    modelDiv.find( '[name=bool]' ).prop( 'checked', true ).change();
    modelDiv.find( '[value=Kaleb]' ).prop( 'checked', true ).change();

    assert.strictEqual( m.daterange[0], '2015-11-13', 'Should resolve dates' );
    assert.strictEqual( m.daterange[1], '2015-11-15', 'Should resolve dates' );
    assert.strictEqual( m.bool, true, 'Should resolve bools' );
    assert.strictEqual( m.arrays.names[2], 'Kaleb', 'Should resolve arrays' );
    assert.strictEqual( m.arrays.names.length, 3 );

    modelDiv.find( '[value=Kaleb]' ).prop( 'checked', false ).change();

    assert.strictEqual( m.arrays.names.length, 2 );

    modelDiv.find( '[value=Todd]' ).prop( 'checked', false ).change();

    assert.strictEqual( m.arrays.names.length, 1 );

    var done = assert.async();

    $( document ).one( lojax.events.afterUpdateModel, function ( evt, obj ) {
        assert.ok( true, 'model change events are being handled' );
        assert.equal( m.number, 1, 'Should resolve numbers' );
        done();
    } );

    modelDiv.find( '[type=number]' ).val( 1 ).change();

} );

QUnit.test( 'bindToModels3', function ( assert ) {

    var modelDiv = $( '<div data-model></div>' );

    var model = { number: 3.14, daterange: ['2015-11-13', '2015-11-15'], bool: false, arrays: { names: ['Anders', 'Kaleb'] }, select:'a', color: 'green' };

    modelDiv.data( 'model', model );

    modelDiv.append( getForm() );

    div.append( modelDiv );

    lojax.logging = true;

    lojax.instance.bindToModels();

    assert.equal( modelDiv.find( '[name=number]' ).val(), '3.14' );
    assert.equal( modelDiv.find( '[name="daterange[0]"]' ).val(), '2015-11-13' );
    assert.equal( modelDiv.find( '[name="daterange[1]"]' ).val(), '2015-11-15' );
    assert.equal( modelDiv.find( '[name=bool]' ).prop( 'checked' ), false );
    assert.equal( modelDiv.find( '[value=Kit]' ).prop( 'checked' ), false );
    assert.equal( modelDiv.find( '[value=Todd]' ).prop( 'checked' ), false );
    assert.equal( modelDiv.find( '[value=Anders]' ).prop( 'checked' ), true );
    assert.equal( modelDiv.find( '[value=Kaleb]' ).prop( 'checked' ), true );
    assert.equal( modelDiv.find( '[value=green]' ).prop( 'checked' ), true );
    assert.equal( modelDiv.find( '[value=red]' ).prop( 'checked' ), false );
    assert.equal( modelDiv.find( 'select' ).val(), 'a' );

    model.arrays.names.push( 'Todd' );
    lojax.instance.bindToModels(modelDiv);
    assert.equal( modelDiv.find( '[value=Todd]' ).prop( 'checked' ), true );

    lojax.logging = false;
} );

QUnit.test( 'loadAsyncContent', function ( assert ) {
    div.empty();

    var done = assert.async();

    $( document ).one( lojax.events.afterRequest, function () {
        assert.ok( true, 'async content was loaded' );

        var datamodel = div.find( '[data-model]' ).data( 'model' );

        console.log( datamodel );

        done();
    } );

    div.append( '<div data-src="/Home/ModelTest"></div>' );

    lojax.instance.loadAsyncContent( div );

} );

QUnit.test( 'injectContent1', function ( assert ) {
    div.empty();

    window.scriptExecuted = false;

    var done = assert.async();

    $( document ).one( lojax.events.afterRequest, function () {
        assert.ok( true, 'async content was loaded' );

        assert.ok( window.scriptExecuted === true, 'scripts should run' );

        done();
    } );

    $( '<button data-method="ajax-get" data-action="/Home/ModelTest">' ).appendTo( div ).click().remove();

} );

QUnit.test( 'injectContent2', function ( assert ) {
    div.empty();

    window.scriptExecuted = false;

    var done = assert.async();

    $( document ).one( lojax.events.afterRequest, function () {
        assert.equal( window.testvalue, '1', 'new content should be queried by new script' );
        assert.equal( window.testvalue2, true, 'loose scripts should run' );
        done();
    } );

    $( '<button data-method="ajax-get" data-action="/File/InjectTest">' ).appendTo( div ).click().remove();

} );

QUnit.test( 'event order', function ( assert ) {
    div.empty();

    var done = assert.async();

    var beforeInjectFired = false;

    $( document ).one( lojax.events.beforeInject, function ( evt, request ) {
        beforeInjectFired = true;
    } );

    $( document ).one( lojax.events.afterRequest, function ( evt, request ) {
        assert.equal( beforeInjectFired, true, 'beforeInject should fire before afterRequest' );
        done();
    } );

    $( '<button data-method="ajax-get" data-action="/File/InjectTest">' ).appendTo( div ).click().remove();
} );

QUnit.test( 'injectContent3 empty response', function ( assert ) {
    div.empty();

    var done = assert.async();

    var beforeInjectFired = false;

    $( document ).one( lojax.events.beforeInject, function ( evt, request ) {
        beforeInjectFired = true;
    } );

    $( document ).one( lojax.events.afterRequest, function ( evt, request ) {
        assert.ok( true, 'empty response should not throw an error' );
        assert.equal( beforeInjectFired, false, 'empty response should return from injectContent early' );
        done();
    } );

    $( '<button data-method="ajax-get" data-action="/EmptyResponse">' ).appendTo( div ).click().remove();
} );

QUnit.test( 'handleHash', function ( assert ) {
    div.empty();

    var done = assert.async();

    $( document ).on( 'handleHashTest', function () {
        assert.ok( true, 'hash change was handled' );
        done();
        window.location.hash = '';
    } );

    $( '<input type="text" data-method="ajax-get" data-action="#/raiseevent/handleHashTest">' ).appendTo( div ).click().remove();

} );

QUnit.test( 'callIn', function ( assert ) {

    lojax.logging = true;

    var div2 = $( '<div data-jaxpanel="hidden-div2" style="display:none"></div>' ).appendTo( 'body' );

    var done = assert.async();
    var done2 = assert.async();
    var done3 = assert.async();

    window.callInTest = function ( val ) {
        assert.ok( true, 'lojax.in called' );
        assert.equal( val, 'call-in-test', '' );
        done();
    };

    window.callInTest2 = function ( val ) {
        assert.ok( true, 'lojax.in called' );
        assert.equal( val, 'call-in-test2', '' );
        done2();
        console.clear();
    };

    window.loadAsyncContentTest = function ( val ) {
        assert.ok( true, 'lojax.in called' );
        assert.equal( val, 'load async content', '' );
        done3();
    };

    $( '<button data-method="ajax-get" data-action="/File/CallInTest">' ).appendTo( div ).click().remove();

    lojax.logging = false;

} );

QUnit.test( 'buildForm', function ( assert ) {
    div.empty();

    //test form serialization
    var form = $( '<form></form>' ).appendTo( div );

    form.append( getForm() );

    //add inputs outside the form
    var div2 = $( '<div id="div2"></div>' ).appendTo( div );
    div2.append( '<select name="select2"><option value="1">One</option><option value="2">Two</option><option value="3" selected="selected">Three</option></select>' );
    div2.append( '<input type="number" name="number2" value="2" />' );
    div2.append( '<input type="radio" name="radio1" value="Todd" />' );
    div2.append( '<input type="radio" name="radio1" value="Kit" checked="checked" />' );

    //add some inputs that the selector should NOT include
    var div3 = $( '<div id="div3"></div>' ).appendTo( div );
    div3.append( '<select name="select3"><option value="1" selected="selected">One</option><option value="2">Two</option><option value="3">Three</option></select>' );
    div3.append( '<input type="number" name="number3" value="3" />' );

    var selector = $( '#div1 form,#div2 [name]' );

    var builtForm = lojax.priv.buildForm( selector );

    var serialized = builtForm.serialize();

    var shouldBe = 'number=5&daterange%5B0%5D=2015-01-01&daterange%5B1%5D=2015-12-31&bool=true&arrays.names=Todd&arrays.names=Kit&no.value=&select=b&color=red&select2=3&number2=2&radio1=Kit';

    assert.equal( serialized, shouldBe, 'Should create a form' );

} );

QUnit.test( 'posting models 1', function ( assert ) {

    // make sure jQuery.closest() works the way we think it should

    var form = $( '<form></form>' );
    var modelDiv = $( '<div data-model></div>' );
    var model = { number: 5, daterange: ['2015-11-13', '2015-11-15'], bool: true, arrays: { names: ['Kit', 'Todd'] } };
    modelDiv.data( 'model', model );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" data-action="/post" />' );

    modelDiv.append( submitBtn );
    form.append( modelDiv );

    var closest = submitBtn.closest( 'form,[data-model]' );

    assert.ok( closest.is( '[data-model]' ), 'closest should be [data-model]' );

    // start over and swap form and modelDiv

    form.empty();
    modelDiv.empty();
    form.append( submitBtn );
    modelDiv.append( form );

    closest = submitBtn.closest( 'form,[data-model]' );

    assert.ok( closest.is( 'form' ), 'closest should be form' );

    assert.equal( closest.attr( 'action' ), undefined, 'missing action attribute === undefined' );

    // start over with no form or model

    form.empty();

    modelDiv.empty();

    closest = submitBtn.closest( 'form,[data-model]' );

    assert.equal( closest.is( 'form' ), false, 'closest should not be form' );
    assert.equal( closest.is( '[data-model]' ), false, 'closest should not be [data-model]' );

    div.empty();

} );

QUnit.test( 'posting models 2', function ( assert ) {

    div.empty();

    // create a data-model with a submit button
    var form = $( '<form></form>' );
    var modelDiv = $( '<div data-model></div>' );
    var model = { number: 5, daterange: ['2015-01-01', '2015-12-31'], bool: false, arrays: { names: ['Kit', 'Todd'] } };
    modelDiv.data( 'model', model );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" data-action="/post" />' );

    div.append( form );
    form.append( modelDiv );
    modelDiv.append( submitBtn );

    // add some inputs
    modelDiv.append( getForm() );

    // bind the inputs to the model
    lojax.instance.bindToModels( modelDiv );

    // change some of the values
    modelDiv.find( '[name="daterange[0]"]' ).val( '2015-11-13' ).change();
    modelDiv.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
    modelDiv.find( '[name=bool]' ).prop( 'checked', true ).change();
    modelDiv.find( '[value=Kaleb]' ).prop( 'checked', true ).change();

    var done = assert.async();

    $( document ).on( lojax.events.beforeRequest, function ( evt, arg ) {
        assert.ok( arg.model != null );
        assert.equal( arg.model.daterange[0], '2015-11-13' );
        assert.equal( arg.model.daterange[1], '2015-11-15' );
        assert.equal( arg.model.bool, true );
        assert.equal( arg.model.arrays.names.length, 3 );
        //arg.cancel = true;
        done();
    } );

    lojax.logging = true;

    submitBtn.click();

    lojax.logging = false;

} );

QUnit.test( 'posting forms 1', function ( assert ) {

    div.empty();

    // create a form with a submit button
    var form = $( '<form></form>' );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" data-action="/post#withhash" />' );

    div.append( form );

    // add some inputs
    form.append( getForm() );
    form.append( submitBtn );

    var done1 = assert.async();

    $( document ).one( lojax.events.afterRequest, function ( evt, arg ) {
        assert.ok( arg != null );
        assert.equal( arg.contentType, 'application/x-www-form-urlencoded; charset=UTF-8' );
        assert.equal( arg.action, '/post#withhash' );
        $( document ).off( lojax.events.afterRequest );
        done1();
    } );

    lojax.logging = true;

    submitBtn.click();

    lojax.logging = false;

} );

QUnit.test( 'posting forms 2', function ( assert ) {

    div.empty();

    // create a form with a submit button
    var form = $( '<form></form>' );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" />' );

    div.append( form );

    // add some inputs
    form.append( getForm() );
    form.append( submitBtn );

    var done1 = assert.async();

    $( document ).one( lojax.events.afterRequest, function ( evt, arg ) {
        assert.ok( arg != null );
        assert.equal( arg.contentType, 'application/x-www-form-urlencoded; charset=UTF-8' );
        assert.equal( arg.action, window.location.href );
        $( document ).off( lojax.events.afterRequest );
        done1();
    } );

    lojax.logging = true;

    submitBtn.click();

    // test with default url (current page)
    div.empty();

} );

QUnit.test( 'posting forms 3', function ( assert ) {

    div.empty();

    // create a form with a submit button
    var form = $( '<form data-method="ajax-get"></form>' );
    var submitBtn = $( '<input type="submit" />' );

    div.append( form );

    // add some inputs
    form.append( '<input type="number" name="number" value="5" />' );
    form.append( submitBtn );

    var done = assert.async();

    $( document ).one( lojax.events.afterRequest, function ( evt, arg ) {
        assert.ok( true, 'form submit events can be intercepted' );
        done();
    } );

    lojax.logging = true;

    submitBtn.click();

    // test with default url (current page)
    div.empty();

    lojax.logging = false;

} );

QUnit.test( 'modals', function ( assert ) {

    lojax.logging = true;

    var done1 = assert.async();
    var done2 = assert.async();

    window.callInTest4 = function ( val, context ) {
        assert.equal( val, 'call-in-test4', 'in called' );
        var model = context.find( '[data-model]' ).data( 'model' );

        assert.equal( model.number, 5 );
        assert.equal( model.daterange[0], '2015-01-01' );
        assert.equal( model.daterange[1], '2015-12-31' );
        assert.equal( model.bool, true );
        assert.equal( model.arrays.names[0], 'Todd' );
        assert.equal( model.arrays.names[1], 'Kit' );
        assert.equal( model.arrays.names.length, 2 );
        assert.equal( model.no.value, null );
        assert.equal( model.select, 'b' );

        done1();
    };

    window.loadAsyncContentTest = function ( val ) {
        assert.equal( val, 'load async content' );
        done2();
        lojax.logging = false;
        lojax.closeModal();
    };

    $( '<button data-method="ajax-get" data-action="/modal">' ).appendTo( div ).click().remove();

} );

QUnit.test('cache', function (assert) {

    div.empty();

    var form = getForm();



    assert.equal(lojax.logging, false);

});

QUnit.test( 'make sure logging is turned off', function ( assert ) {
    div.empty();

    assert.equal( lojax.logging, false );

} );
