var tests = tests || {};

//lojax.config.prefix = 'jx-';

var div = null;

var methods = 'get post ajax-get ajax-post ajax-put ajax-delete jsonp'.split( ' ' );

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
    out.push( '<input type="text" name="arrays.values" value="1" />' );
    out.push( '<input type="text" name="arrays.values" value="2" />' );

    return out.join( '' );
};

var getDetail = function () {
    var out = [];

    out.push( '<div name="number" />' );
    out.push( '<h1 name="daterange[0]"></h1>' );
    out.push( '<h1 name="daterange[1]"></h1>' );
    out.push( '<span name="bool" />' );
    out.push( '<ul name="arrays.names">')
    out.push( '<li class="name" />' );
    out.push( '</ul>' );
    out.push( '<p type="text" name="no.value" />' );
    out.push( '<p name="select">' );
    out.push( '<div name="color" />' );
    out.push( '<div name="jx-quoted" />' );

    return out.join( '' );
};

var getModel = function () {
    return {
        number: 3.14,
        daterange: ['2015-11-13', new Date( '2016-01-01T06:00:00Z' )],
        bool: false,
        no: { value: null },
        arrays: { names: ['Anders', 'Kaleb'] },
        select: 'a',
        color: 'green',
        'jx-quoted': '&quot;'
    };
};

$( function () {
    div = $( '<div id="div1" jx-panel="hidden-div" style="display:none"></div>' ).appendTo( 'body' );
} );

var chars = [/&/g, /</g, />/g, /"/g, /'/g, /`/g];

var escaped = ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;', '&#96;'];

var escapeHTML = function ( obj ) {
    if ( typeof obj !== 'string' ) {
        return obj;
    }
    for ( var i = 0; i < chars.length; i++ ) {
        obj = obj.replace( chars[i], escaped[i] );
    }
    return obj;
};

QUnit.test( 'isJSON', function ( assert ) {

    assert.equal( lojax.priv.isJSON( '{"number":5}' ), true, 'should detect objects' );

    assert.equal( lojax.priv.isJSON( '[1,2,3]' ), true, 'should detect arrays' );

    assert.equal( lojax.priv.isJSON( 'partials/ModelTest.html' ), false, 'should detect urls' );

    assert.equal( lojax.priv.isJSON( 'http://10.4.9.149:8080/lojax/spec/SpecRunner.html' ), false, 'should detect urls' );

} );

QUnit.test( 'emptyHashAction', function ( assert ) {

    div.empty();

    lojax.logging = true;

    var done1 = assert.async();
    $( document ).one( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'handleHash should execute the configured action if there is no hash' );
        done1();
    } );
    lojax.emptyHashAction = 'partials/RaiseEvent.html';
    lojax.instance.handleHash();

    var done2 = assert.async();
    $( document ).one( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'handleHash should execute the configured action if there is no hash' );
        done2();
    } );
    lojax.emptyHashAction = function () {
        return 'partials/RaiseEvent.html';
    };
    lojax.instance.handleHash();

    var done3 = assert.async();
    $( document ).one( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'handleHash should execute the configured action if there is no hash' );
        done3();
    } );
    lojax.emptyHashAction = {
        action: 'partials/RaiseEvent.html',
        method: 'ajax-get'
    };
    lojax.instance.handleHash();

} );

QUnit.test( 'handleHash2', function ( assert ) {

    div.empty();

    lojax.logging = true;

    var done = assert.async();

    $( document ).one( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'hash change handled' );
        done();
        //lojax.logging = false;
    } );

    $( '<a href="#partials/RaiseEvent.html" jx-method="ajax-get"></a>' ).appendTo( div ).click();

} );

QUnit.test( 'lojax.exec', function ( assert ) {

    var done = assert.async();

    $( document ).one( 'customEvent', function () {
        assert.ok( true, 'lojax.exec should execute a request' );
        done();
    } );

    lojax.exec( {
        action: 'partials/RaiseEvent.html',
        method: 'ajax-get'
    } );

} );

QUnit.test( 'handleError', function ( assert ) {

    var done = assert.async();

    $( document ).one( 'ajaxError', function () {
        assert.ok( true, 'error was handled' );
        done();
    } );

    $( '<button data-method="ajax-get" data-action="partials/doesntexist.html">' ).appendTo( div ).click();

} );

QUnit.test( 'triggerEvent error handling', function ( assert ) {

    $( document ).one( 'errorTest', function () {
        throw 'exception inside event handler';
    } );

    try {
        lojax.priv.triggerEvent( 'errorTest' );
        assert.ok( true, 'exceptions thrown in event handlers should not derail lojax' );
    }
    catch ( ex ) {
        assert.ok( false, 'exceptions thrown in event handlers should not derail lojax' );
    }

} );

QUnit.test( 'request attribute', function ( assert ) {

    var done = assert.async();

    $( document ).one( 'ajaxError', function () {
        assert.ok( true, 'error was handled' );
        done();
    } );

    var json = '{"method":"ajax-get","action":"partials/doesntexist.html"}';

    $( '<button jx-request="' + escapeHTML( json ) + '">' ).appendTo( div ).click();

} );

QUnit.test( 'Request.catch', function ( assert ) {

    var req, done = assert.async();

    req = new lojax.Request( {
        action: 'partials/doesnt_exist.html',
        method: 'ajax-get'
    } );

    req.exec().catch( function ( error ) {
        assert.ok( error != null );
        assert.ok( true, 'catch can handle errors' );
        done();
    } );

} );

QUnit.test( 'Request.getData', function ( assert ) {

    var data, req;

    methods.forEach( function ( method ) {
        req = new lojax.Request( {
            action: 'partials/EmptyResponse.html',
            method:method,
            model: getModel()
        } );
        data = req.getData();
        assert.ok( data != null );
    } );

    div.append( getForm() );

    methods.forEach( function ( method ) {
        req = new lojax.Request( {
            action: 'partials/EmptyResponse.html',
            method:method,
            form: div.find( ':input' )
        } );
        data = req.getData();
        assert.ok( data != null );
    } );

} );

QUnit.test( 'transitions', function ( assert ) {

    // make sure that the node returned by each transition exists on the page

    div.empty();

    var parent = '<div id="div2" jx-panel="hidden-div2" style="display:none"></div>',
        newNode = '<div><p id="newNode"></p></div>',
        transitions = Object.getOwnPropertyNames( lojax.Transitions ),
        returnedNode,
        fn;

    transitions.forEach( function ( t ) {
        fn = lojax.Transitions[t];
        var $parent = $( parent );
        div.append( $parent );
        returnedNode = fn( $parent, newNode );
        assert.equal( $.contains( document, returnedNode[0] ), true, 'returned node should exist on the page' );
    } );

} );

QUnit.test( 'lojax.on/off', function ( assert ) {

    lojax.on( 'raiseThis', {
        action: 'partials/RaiseEvent.html',
        method: 'ajax-get'
    } );

    var done = assert.async();

    $( document ).on( 'customEvent', function () {

        assert.ok( true, 'lojax.on' );

        done();
        lojax.off( 'customEvent' );

    } );

    lojax.priv.triggerEvent( 'raiseThis' );

} );

QUnit.test( 'priv.noCache', function ( assert ) {

    var nonce = lojax.priv.nonce;

    var urls = [
        'http://server/app/controller/action/id',
        'http://server/app/controller/action/id?name=value',
        'http://server/app/controller/action/id#suburl',
        'http://server/app/controller/action/id?name=value#suburl?name=value'
    ];

    var expected = [
        'http://server/app/controller/action/id?_=' + nonce++,
        'http://server/app/controller/action/id?name=value&_=' + nonce++,
        'http://server/app/controller/action/id?_=' + (nonce++) + '#suburl',
        'http://server/app/controller/action/id?name=value&_=' + (nonce++) + '#suburl?name=value'
    ];

    var search = /\?.+(?=#)|\?.+$|.+(?=#)|.+/;

    for ( var i = 0; i < urls.length; i++ ) {
        var nocache = lojax.priv.noCache( urls[i] );
        assert.strictEqual( nocache, expected[i] );
    }

} );

QUnit.test( 'methods1', function ( assert ) {

    lojax.logging = true;

    var link = $( '<a href="partials/EmptyResponse.html" jx-form="#div1 [name=number]"></a>' );

    div.append( getForm() );

    div.append( link );

    var done = assert.async();

    var i = 0;

    var usedMethods = {};

    $( document ).on( lojax.events.beforeRequest, function ( evt, arg ) {
        assert.ok( usedMethods[arg.method] == undefined, 'each method should be used once' );
        usedMethods[arg.method] = arg;

        switch (arg.method) {
            case 'post':
                assert.ok( arg.data.is( 'form' ), 'non-ajax post should use a form' );
                break;
            default:
                assert.equal( arg.data, 'number=5' );
                break;
        }
        // mongoose doesn't support put or delete :(
        if ( /get|post|ajax-put|ajax-delete/.test( arg.method ) ) arg.cancel = true;
        done();
        if ( ++i < methods.length ) {
            done = assert.async();
            link.attr( 'data-method', methods[i] ).click();
        }
        else {
            $( document ).off( lojax.events.beforeRequest );
        }
    } );

    link.attr( 'data-method', methods[i] ).click();

} );

QUnit.test( 'methods2', function ( assert ) {

    //lojax.logging = true;

    var link = $( '<a href="partials/EmptyResponse.html" jx-model="{&quot;number&quot;:5}"></a>' );

    div.append( getForm() );

    div.append( link );

    var done = assert.async();

    var i = 0;

    $( document ).on( lojax.events.beforeRequest, function ( evt, arg ) {

        switch ( arg.method ) {
            case 'get':
            case 'ajax-get':
            case 'ajax-delete':
            case 'jsonp':
                assert.equal( arg.data, 'number=5', arg.method );
                break;
            case 'post':
                assert.ok( arg.data.is( 'form' ), 'post should use a form' );
                break;
            default:
                assert.equal( arg.data, '{"number":5}', arg.method );
                break;
        }
        arg.cancel = true;
        done();
        if ( ++i < methods.length ) {
            done = assert.async();
            link.attr( 'data-method', methods[i] ).click();
        }
        else {
            $( document ).off( lojax.events.beforeRequest );
        }
    } );

    link.attr( 'data-method', methods[i] ).click();

} );

QUnit.test( 'methods3', function ( assert ) {

    //lojax.logging = true;

    var link = $( '<a href="partials/EmptyResponse.html"></a>' );

    div.append( getForm() );

    div.append( link );

    var done = assert.async();

    var i = 0;

    $( document ).on( lojax.events.beforeRequest, function ( evt, arg ) {

        switch ( arg.method ) {
            case 'post':
                assert.ok( arg.data.is( 'form' ), 'post should use a form' );
                break;
            default:
                assert.equal( arg.data, undefined, arg.method );
                break;
        }
        arg.cancel = true;
        done();
        if ( ++i < methods.length ) {
            done = assert.async();
            link.attr( 'data-method', methods[i] ).click();
        }
        else {
            $( document ).off( lojax.events.beforeRequest );
        }
    } );

    link.attr( 'data-method', methods[i] ).click();

} );

QUnit.test( 'formFromModel', function ( assert ) {

    lojax.logging = true;

    var form = lojax.priv.formFromModel( getModel() );

    lojax.logging = false;

    assert.strictEqual( form.find( '[name=number]' ).val(), '3.14' );
    assert.strictEqual( form.find( '[name=daterange]:first' ).val(), '2015-11-13' );
    assert.strictEqual( form.find( '[name=daterange]:last' ).val(), '2016-01-01T06:00:00.000Z' );
    assert.strictEqual( form.find( '[name=bool]' ).val(), 'false' );
    assert.strictEqual( form.find( '[name="no.value"]' ).val(), '' );
    assert.strictEqual( form.find( '[name="arrays.names"]:first' ).val(), 'Anders' );
    assert.strictEqual( form.find( '[name="arrays.names"]:last' ).val(), 'Kaleb' );
    assert.strictEqual( form.find( '[name=select]' ).val(), 'a' );
    assert.strictEqual( form.find( '[name=color]' ).val(), 'green' );

} );

QUnit.test( 'standardDateFormat', function ( assert ) {

    var fn = lojax.priv.standardDateFormat;

    var dt = new Date( 1451706061077 );

    assert.strictEqual( fn( undefined ), undefined );
    assert.strictEqual( fn( null ), null );
    assert.strictEqual( fn( '' ), '' );
    assert.strictEqual( fn( dt ), '2016-01-01' );
    assert.strictEqual( fn( '2016-01-01T' ), '2016-01-01' );

} );

QUnit.test( 'castValue', function ( assert ) {

    div.empty();

    var fn = lojax.priv.castValues;

    var form = getForm();

    div.append( form );

    lojax.logging = true;

    assert.strictEqual( fn( '5' , 'number' ), 5 );
    assert.strictEqual( fn( '2015-01-01', 'date' ), '2015-01-01' );
    assert.strictEqual( fn( 'True', 'boolean' ), true );
    assert.strictEqual( fn( ['Todd', 'Kit'], 'undefined' )[0], 'Todd' );
    assert.strictEqual( fn( ['Todd', 'Kit'], 'undefined' )[1], 'Kit' );
    assert.strictEqual( fn( '', 'undefined' ), null );
    assert.strictEqual( fn( ['1', '2'], 'number' )[0], 1 );
    assert.strictEqual( fn( ['1', '2'], 'number' )[1], 2 );

    lojax.logging = false;

} );

QUnit.test( 'getModel', function ( assert ) {

    var fn = lojax.priv.getModel;

    var button = $( '<input type="submit" data-method="ajax-post" jx-action="/save" jx-model="{&quot;number&quot;:5}" />' );

    var obj = fn( button );

    assert.strictEqual( obj.number, 5 );

    button = $( '<input type="submit" data-method="ajax-post" jx-action="/save" data-model="{&quot;number&quot;:5}" />' );

    obj = fn( button );

    assert.strictEqual( obj.number, 5 );

    button = $( '<input type="submit" data-method="ajax-post" jx-action="/save" />' );

    obj = fn( button );

    assert.strictEqual( obj, undefined );

} );

QUnit.test( 'enter key event handler', function ( assert ) {

    var done = assert.async();
    var modelDiv = $( '<div data-model data-action="partials/RaiseEvent.html" data-method="ajax-post"></div>' );
    div.append( modelDiv );
    modelDiv.data( 'model', getModel() ).append( getForm() );

    $( document ).off( 'customEvent' );

    $( document ).on( 'customEvent', function () {
        assert.ok( true, 'enter key was handled by lojax' );
        done();
    } );

    $(modelDiv).find('input:first').trigger(
       jQuery.Event( 'keydown', { keyCode: 13, which: 13 } )
    );

} );

QUnit.test( 'click event handler', function ( assert ) {

    var done = assert.async();

    $( document ).off( 'customEvent' );

    $( document ).on( 'customEvent', function () {
        assert.ok( true, 'click was handled by lojax' );
        done();
    } );

    //click should be handled
    $( '<button data-method="ajax-get" data-action="partials/raiseevent.html">' ).appendTo( div ).click();

    //click should not be handled because trigger of 'change' is specified instead of click
    $( '<button data-method="ajax-get" data-action="partials/raiseevent.html" data-trigger="change">' ).appendTo( div ).click();
} );

QUnit.test( 'change event handler', function ( assert ) {

    var done1 = assert.async();

    $( document ).off( 'customEvent' );

    $( document ).on( 'customEvent', function () {
        assert.ok( true, 'change was handled by lojax' );
        done1();
    } );

    //change should be handled
    $( '<input type="text" data-method="ajax-get" data-action="partials/raiseevent.html" data-trigger="change">' ).appendTo( div ).change().remove();

    //change should not be handled because no data-method attribute
    $( '<input type="text" data-action="partials/raiseevent.html" data-trigger="change">' ).appendTo( div ).change().remove();
} );

QUnit.test( 'getPathSegments', function ( assert ) {

    var result = lojax.priv.getPathSegments( 'jx-quoted' );
    assert.equal( result[0], 'jx-quoted' );

    result = lojax.priv.getPathSegments( 'daterange[1]' );
    assert.equal( result[0], 'daterange' );
    assert.equal( result[1], '[1]' );

    result = lojax.priv.getPathSegments( 'arrays.names.length' );
    assert.equal( result[0], 'arrays' );
    assert.equal( result[1], 'names' );
    assert.equal( result[2], 'length' );

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

    var model = getModel();

    var result = lojax.priv.getModelValue( model, 'number' );
    assert.equal( result, model.number );

    result = lojax.priv.getModelValue( model, 'daterange[1]' );
    assert.equal( result, model.daterange[1] );

    result = lojax.priv.getModelValue( model, 'arrays.names' );
    assert.ok( Array.isArray( result ) );

    result = lojax.priv.getModelValue( model, 'arrays.names.length' );
    assert.equal( result, 2 );

    result = lojax.priv.getModelValue( model, 'jx-quoted' );
    assert.equal( result, '&quot;' );

} );

QUnit.test( 'binding models 1', function ( assert ) {
    div.empty();

    var input = $( '<input data-model type="number" name="number" value="1" />' );

    div.append( input );

    lojax.instance.bindToModels( input );

    var model = input.data( 'model' );

    assert.ok( model != undefined, 'Should find one model' );

    input.remove();

    input = $( '<input type="number" name="number" value="1" />' );

    div.append( input );

    lojax.instance.bindToModels( input );

    model = input.data( 'model' );

    assert.ok( model == undefined, 'Should find zero models' );

} );

QUnit.test( 'binding models 2', function ( assert ) {

    div.empty();

    var modelDiv = $( '<div data-model></div>' );

    modelDiv.append( getForm() );

    div.append( modelDiv );

    lojax.logging = true;

    lojax.instance.bindToModels( modelDiv );

    lojax.logging = false;

    var m = modelDiv.data('model');

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

    //now change some of the values
    modelDiv.find( '[name="daterange[0]"]' ).val( '2015-11-13' ).change();
    modelDiv.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
    modelDiv.find( '[name=bool]' ).prop( 'checked', true ).change();
    modelDiv.find( '[value=Kaleb]' ).prop( 'checked', true ).change();

    assert.strictEqual( m.daterange[0], '2015-11-13', 'Should resolve dates' );
    assert.strictEqual( m.daterange[1], '2015-11-15', 'Should resolve dates' );
    assert.strictEqual( m.bool, true, 'Should resolve bools' );
    assert.strictEqual( m.arrays.names[2], 'Kaleb', 'Should resolve arrays' );
    assert.strictEqual( m.arrays.names.length, 3, 'Should repopulate arrays' );

    modelDiv.find( '[value=Kaleb]' ).prop( 'checked', false ).change();

    assert.strictEqual( m.arrays.names.length, 2, 'Should repopulate arrays' );

    modelDiv.find( '[value=Todd]' ).prop( 'checked', false ).change();

    assert.strictEqual( m.arrays.names.length, 1, 'Should repopulate arrays' );

    lojax.logging = true;

    var done = assert.async();

    $( document ).one( lojax.events.afterUpdateModel, function ( evt, obj ) {
        assert.ok( true, 'model change events are being handled' );
        assert.equal( m.number, 1, 'Should resolve numbers' );
        done();
        lojax.logging = false;
    } );

    // IE9 doesn't support the number input type

    modelDiv.find( '[name=number]' ).val( 1 ).change();

    console.log( modelDiv );

} );

QUnit.test( 'binding models 3', function ( assert ) {

    div.empty();

    div.append( getForm() );

    lojax.logging = true;

    var model = getModel();

    lojax.bind( div, model );

    assert.equal( div.find( '[name=number]' ).val(), model.number );
    assert.equal( div.find( '[name="daterange[0]"]' ).val(), model.daterange[0] );
    if ( div.find( '[name = "daterange[1]"]' )[0].type == 'date' ) {
        assert.equal( div.find( '[name="daterange[1]"]' ).val(), '2016-01-01' );
    }
    else {
        // IE9 doesn't support the date input type
        assert.equal( div.find( '[name="daterange[1]"]' ).val(), model.daterange[1] );
    }
    assert.equal( div.find( '[name=bool]' ).prop( 'checked' ), model.bool );
    assert.equal( div.find( '[value=Kit]' ).prop( 'checked' ), false );
    assert.equal( div.find( '[value=Todd]' ).prop( 'checked' ), false );
    assert.equal( div.find( '[value=Anders]' ).prop( 'checked' ), true );
    assert.equal( div.find( '[value=Kaleb]' ).prop( 'checked' ), true );
    assert.equal( div.find( '[value=green]' ).prop( 'checked' ), true );
    assert.equal( div.find( '[value=red]' ).prop( 'checked' ), false );
    assert.equal( div.find( 'select' ).val(), model.select );

    model.arrays.names.push( 'Todd' );
    lojax.bind( div, model );
    assert.equal( div.find( '[value=Todd]' ).prop( 'checked' ), true );

    lojax.logging = false;
} );

QUnit.test( 'binding models 4', function ( assert ) {

    div.empty();

    // add a blank model
    var modelDiv = $( '<div jx-model></div>' );

    div.append( modelDiv );

    // add some inputs
    modelDiv.append( getForm() );

    // bind the inputs to the model
    lojax.instance.bindToModels( modelDiv );

    // grab the model
    var m = modelDiv.data( 'model' );

    assert.strictEqual( m.daterange[0], '2015-01-01', 'Should resolve dates' );
    assert.strictEqual( m.daterange[1], '2015-12-31', 'Should resolve dates' );
    assert.strictEqual( m.bool, true, 'Should resolve bools' );
    assert.strictEqual( m.arrays.names[1], 'Kit', 'Should resolve arrays' );
    assert.strictEqual( m.arrays.names.length, 2, 'Should repopulate arrays' );

    lojax.logging = true;

    //modelDiv.find( '[name="daterange[0]"]' ).val( '2015-11-13' ).change();
    //modelDiv.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
    modelDiv.find( '[name=bool]' ).prop( 'checked', false ).change();
    //modelDiv.find( '[value=Kaleb]' ).prop( 'checked', true ).change();
    //modelDiv.find( '[name=color][value=green]' ).prop( 'checked', true ).change();

    //assert.strictEqual( m.daterange[0], '2015-11-13', 'Should resolve dates' );
    //assert.strictEqual( m.daterange[1], '2015-11-15', 'Should resolve dates' );
    assert.strictEqual( m.bool, false, 'Should resolve bools' );
    //assert.strictEqual( m.color, 'green', 'Should resolve radios' );
    //assert.strictEqual( m.arrays.names[2], 'Kaleb', 'Should resolve arrays' );
    //assert.strictEqual( m.arrays.names.length, 3, 'Should repopulate arrays' );

    lojax.logging = false;

    //console.log( m );

} );

QUnit.test( 'loadSrc', function ( assert ) {
    div.empty();

    lojax.logging = true;

    var done = assert.async();

    $( document ).one( lojax.events.afterInject, function () {
        assert.ok( true, 'async content was loaded' );

        var datamodel = div.find( '[data-model]' ).data( 'model' );

        var replaceThis = div.find( '#replaceThis' ).length;

        assert.equal( replaceThis, 0, 'jx-src should completely replace contents by default' );

        done();

        lojax.logging = false;
    } );

    div.append( '<div data-src="partials/ModelTest.html"><span id="replaceThis"></span></div>' );

    lojax.instance.loadSrc( div );

} );

QUnit.test( 'injectContent1', function ( assert ) {
    div.empty();

    var btn = $( '<button data-method="ajax-get" data-action="partials/ModelTest.html"/>' );

    div.append( btn );

    lojax.logging = true;

    window.scriptExecuted = false;

    var done = assert.async();

    $( document ).on( lojax.events.afterRequest, function () {
        assert.ok( true, 'async content was loaded' );

        assert.ok( window.scriptExecuted === true, 'scripts should run' );

        done();
    } );

    btn.click();

} );

QUnit.test( 'injectContent2', function ( assert ) {
    div.empty();

    var btn = $( '<button data-method="ajax-get" data-action="partials/InjectTest.html">' ).appendTo( div );

    window.scriptExecuted = false;

    var done = assert.async();

    lojax.logging = true;

    $( document ).on( lojax.events.afterRequest, function () {
        assert.equal( window.testvalue, '1', 'new content should be queried by new script' );
        assert.equal( window.testvalue2, true, 'loose scripts should run' );
        assert.equal( div.find( '#testinput' ).length, 1, 'jx-panels should get injected' );
        done();
        lojax.logging = false;
    } );

    btn.click();

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

    $( '<button data-method="ajax-get" data-action="partials/InjectTest.html">' ).appendTo( div ).click().remove();
} );

QUnit.test( 'formFromInputs', function ( assert ) {
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

    var builtForm = lojax.priv.formFromInputs( selector );

    var serialized = builtForm.serialize();

    var shouldBe = 'number=5&daterange%5B0%5D=2015-01-01&daterange%5B1%5D=2015-12-31&bool=true&arrays.names=Todd&arrays.names=Kit&no.value=&select=b&color=red&arrays.values=1&arrays.values=2&select2=3&number2=2&radio1=Kit';

    assert.equal( serialized, shouldBe, 'Should create a form' );

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

    $( '<button data-method="ajax-get" data-action="partials/EmptyResponse.html">' ).appendTo( div ).click().remove();
} );

QUnit.test( 'posting models 1', function ( assert ) {

    // make sure jQuery.closest() works the way we think it should

    var form = $( '<form></form>' );
    var modelDiv = $( '<div data-model></div>' );
    modelDiv.data( 'model', getModel() );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" data-action="partials/EmptyResponse.html" />' );

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
    modelDiv.data( 'model', getModel() );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" data-action="partials/EmptyResponse.html" />' );

    div.append( form );
    form.append( modelDiv );
    modelDiv.append( submitBtn );

    // add some inputs
    modelDiv.append( getForm() );

    // bind the inputs to the model
    lojax.instance.bindToModels( modelDiv );

    // change some of the values
    modelDiv.find( '[name="daterange[0]"]' ).val( '2015-11-01' ).change();
    modelDiv.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
    modelDiv.find( '[name=bool]' ).prop( 'checked', true ).change();
    modelDiv.find( '[value=Todd]' ).prop( 'checked', true ).change();

    var model = modelDiv.data( 'model' );

    assert.strictEqual( model.daterange[0], '2015-11-01' , 'lojax should monitor changes' );
    assert.strictEqual( model.daterange[1], '2015-11-15' );
    assert.strictEqual( model.bool, true );

    var done = assert.async();

    $( document ).on( lojax.events.beforeRequest, function ( evt, arg ) {
        assert.ok( arg.model != null );
        console.log( 'arg' );
        console.log( arg );
        assert.equal( arg.model.daterange[0], '2015-11-01', 'model should be passed to beforeRequest' );
        assert.equal( arg.model.daterange[1], '2015-11-15' );
        assert.equal( arg.model.bool, true );
        assert.equal( arg.model.arrays.names.length, 3 );
        //arg.cancel = true;
        done();
        lojax.logging = false;
    } ); 

    lojax.logging = true;

    submitBtn.click();

} );

QUnit.test( 'posting models 3', function ( assert ) {

    div.empty();

    // create a data-model with a submit button
    var form = $( '<form></form>' );
    var modelDiv = $( '<div data-model></div>' );
    modelDiv.data( 'model', getModel() );
    var submitBtn = $( '<input type="submit" data-method="post" data-action="partials/EmptyResponse.html" />' );

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

    $( document ).off( lojax.events.beforeRequest );

    $( document ).on( lojax.events.beforeRequest, function ( evt, arg ) {
        console.log( arg );
        assert.ok( arg.data.is( 'form' ), 'Since we are doing a conventional post, the model should be converted into a form.' );
        arg.cancel = true;
        done();
        lojax.logging = false;
        $( document ).off( lojax.events.beforeRequest );
    } );

    lojax.logging = true;

    submitBtn.click();

} );


QUnit.test( 'propagateChange', function ( assert ) {

    div.empty();

    var model = getModel();

    var form = $( '<form jx-model></form>' );
    form.append( getForm() );
    form.data( 'model', model );
    div.append( form );

    var detail = $( '<div jx-model></div>' );
    detail.append( getDetail() );
    detail.data( 'model', model );
    div.append( detail );

    // bind both areas to the same model
    lojax.bind( form, model );
    lojax.bind( detail, model );

    function verifyDetail() {
        assert.equal( detail.find( '[name="daterange[0]"]' ).text(), model.daterange[0] );
        assert.equal( detail.find( '[name="daterange[1]"]' ).text(), model.daterange[1].toString() );
        assert.equal( detail.find( '[name=bool]' ).text(), model.bool.toString() );
        assert.equal( detail.find( '[name="arrays.names"]' ).text(), model.arrays.names.toString() );
        assert.equal( detail.find( '[name=color]' ).text(), 'green' );
        assert.equal( detail.find( '[name="jx-quoted"]' ).text(), '"' );
        assert.equal( detail.find( '[name="no.value"]' ).text(), '' );
        assert.equal( detail.find( '[name=number]' ).text(), model.number.toString() );
        assert.equal( detail.find( '[name=select]' ).text(), model.select );
    }

    verifyDetail();

    lojax.logging = true;

    // change some of the form inputs
    form.find( '[name="daterange[0]"]' ).val( '2015-11-13' ).change();
    form.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
    form.find( '[name=bool]' ).prop( 'checked', true ).change();
    form.find( '[value=Kaleb]' ).prop( 'checked', false ).change();

    assert.equal( model.daterange[0], '2015-11-13' );
    assert.equal( model.daterange[1], '2015-11-15' );
    assert.equal( model.bool, true );
    assert.equal( model.arrays.names.length, 1 );

    lojax.logging = false;

    verifyDetail();

} );

QUnit.test( 'posting forms 1', function ( assert ) {

    div.empty();

    // create a form with a submit button
    var form = $( '<form></form>' );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" data-action="partials/EmptyResponse.html#withhash" />' );

    div.append( form );

    // add some inputs
    form.append( getForm() );
    form.append( submitBtn );

    var done1 = assert.async();

    $( document ).on( lojax.events.afterRequest, function ( evt, arg ) {
        assert.ok( arg != null );
        assert.equal( arg.contentType, 'application/x-www-form-urlencoded; charset=UTF-8' );
        assert.equal( arg.action, 'partials/EmptyResponse.html#withhash' );
        $( document ).off( lojax.events.afterRequest );
        done1();
    } );

    lojax.logging = true;

    submitBtn.click();

    lojax.logging = false;

} );

QUnit.test( 'callOnLoad', function ( assert ) {

    lojax.logging = true;

    var div2 = $( '<div jx-panel="hidden-div2" style="display:none"></div>' ).appendTo( 'body' );

    var done = assert.async();
    var done2 = assert.async();
    var done3 = assert.async();
    var done4 = assert.async();

    window.callInTest = function ( val ) {
        assert.ok( true, 'lojax.onLoad called' );
        assert.equal( val, 'call-in-test', '' );
        done();
    };

    window.callInTest2 = function ( val ) {
        assert.ok( true, 'lojax.onLoad called' );
        assert.equal( val, 'call-in-test2', '' );
        done2();
    };

    window.loadAsyncContentTest = function ( val ) {
        assert.ok( true, 'lojax.onLoad called' );
        assert.equal( val, 'load async content', '' );
        done3();
    };

    window.callOutTest = function ( val ) {
        assert.ok( true, 'lojax.onUnload called' );
        assert.equal( val, 'call-in-test', '' );
        done4();
    };

    $( '<button data-method="ajax-get" data-action="partials/CallInTest.html?v=2">' ).appendTo( div ).click().remove();

    //lojax.logging = false;

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

    $( document ).off( lojax.events.beforeRequest );

    $( document ).one( lojax.events.beforeRequest, function ( evt, arg ) {
        arg.cancel = true;
        assert.ok( arg != null );
        assert.equal( arg.contentType, 'application/x-www-form-urlencoded; charset=UTF-8' );
        assert.equal( arg.action, window.location.href, 'forms should use the current url if none is specified' );
        $( document ).off( lojax.events.beforeRequest );
        done1();
    } );

    lojax.logging = true;

    submitBtn.click();

   //div.empty();

} );

QUnit.test( 'posting forms 3', function ( assert ) {

    div.empty();

    // create a form with a submit button
    var form = $( '<form data-method="ajax-get" action="partials/EmptyResponse.html"></form>' );
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

QUnit.test( 'posting forms 4', function ( assert ) {

    div.empty();

    // create a single input
    var input = $( '<input type="text" name="search" jx-action="/home/search" jx-method="ajax-post" jx-trigger="change enter" value="single input" />' );

    div.append( input );

    var done = assert.async();

    $( document ).one( lojax.events.afterRequest, function ( evt, arg ) {
        console.log( arg );
        assert.equal( $(arg.form).val(), 'single input', 'if the event source is a single input, assume it is suposed to be the form' );
        done();
        lojax.logging = false;
    } );

    lojax.logging = true;

    input.change();

} );

QUnit.test( 'modals1', function ( assert ) {

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

    $( '<button data-method="ajax-get" data-action="partials/modal.html?_=1">' ).appendTo( div ).click().remove();

} );

QUnit.test( 'modals2', function ( assert ) {

    div.empty();

    var done1 = assert.async();
    //var done2 = assert.async();

    $( document ).one( 'modal2', function () {
        assert.ok( true, 'inner modal was loaded' );
        done1();
        lojax.closeModal();
    } );

    $( '<button data-method="ajax-get" data-action="partials/modal2.html">' ).appendTo( div ).click().remove();

} );

QUnit.test( 'preload', function ( assert ) {

    div.empty();

    var done = assert.async();

    lojax.logging = false;
    var store = lojax.instance.cache;
    var prop;

    $( document ).one( lojax.events.afterRequest, function ( evt, arg ) {
        setTimeout( function () {
            prop = Object.getOwnPropertyNames( store )[0];
            assert.ok( /RaiseEvent/.test( prop ), 'make sure we have the right request' );
            var request = lojax.instance.cache[prop];
            assert.ok( request != null, 'stuff should get cached' );
            // wait for it to return, then check the contents
            request.then( function ( response ) {
                assert.ok( /customEvent/.test( response ) ,'' );
                // now execute the request for real
                lojax.exec( request );
            },
            function ( error ) {
                assert.ok( false, 'ajax error' );
                console.log( error );
            } );
            lojax.logging = false;
        } );
    } );

    $( document ).off( 'customEvent' );

    $( document ).on( 'customEvent', function () {
        assert.ok( true, 'customEvent was raised' );
        setTimeout( function () {
            assert.equal( store[prop], undefined, 'preloaded requests should be automatically removed' );
            done();
        } );
    } );

    $( '<button data-method="ajax-get" data-action="partials/preload1.html">' ).appendTo( div ).click();

} );

QUnit.test( 'make sure logging is turned off', function ( assert ) {
    div.empty();

    assert.equal( lojax.logging, false );

} );

QUnit.test( 'coverage report', function ( assert ) {

    assert.equal( lojax.logging, false );

    if ( lojax.covered ) {

        setTimeout( function () {
            var out = [],
                indexes = Object.getOwnPropertyNames( lojax.covered ),
                last = indexes[indexes.length - 2],
                covered = last,
                percentage;

            out.push( '<ul>' );

            for ( var i = 0; i < last; i++ ) {
                if ( !lojax.covered[i] ) {
                    out.push( '<li>' );
                    out.push( i );
                    out.push( '</li>' );
                    covered--;
                }
            }

            percentage = covered / last;

            out.push( '</ul>' );

            out.push( '<h3>Coverage: ' );

            out.push( Math.round( percentage * 100 ) );

            out.push( ' %</h3>' );

            $( '#coverage-report' ).html( out.join( '' ) );
        } );
    }

} );

