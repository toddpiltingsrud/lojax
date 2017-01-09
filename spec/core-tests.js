var tests = tests || {};

//lojax.config.prefix = 'jx-';

var div = null;

var methods = 'get post put ajax-get ajax-post ajax-put ajax-delete jsonp'.split( ' ' );

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

QUnit.test( 'getFormData', function ( assert ) {

    var form = getForm();

    var formData = lojax.priv.getFormData( form );

    assert.ok( formData != null, 'formData should not be null' );

    if ( formData.keys ) {
        var key,
            successful = $( form ).serializeArray();

        successful.forEach( function ( item ) {
            assert.ok( formData.get( item.name ) != null );
        } );
    }

} );

QUnit.test( 'getFunctionAtPath', function ( assert ) {

    var path = 'window.escapeHTML';

    var fn = lojax.priv.getFunctionAtPath( path );

    assert.strictEqual( fn, escapeHTML, 'should resolve paths that start with "window"' );

    path = "escapeHTML";

    fn = lojax.priv.getFunctionAtPath( path );

    assert.strictEqual( fn, escapeHTML, 'should resolve paths that do not start with "window"' );

    path = escapeHTML;

    fn = lojax.priv.getFunctionAtPath( path );

    assert.strictEqual( fn, escapeHTML, 'if a function is passed in, it should return the function' );

} );

QUnit.test( 'lojax.out with jx-src', function ( assert ) {

    var done1 = assert.async();

    div.empty()
        .append( '<div id="calling-out-with-src" jx-src="partials/CallOutWithSrc.html?v=1" />' );

    tests.callOutTest = function ( id ) {
        assert.strictEqual( id, 'call-out-with-src', 'lojax.out can be used with jx-src' );
        done1();
    };

    lojax.Controller.loadSrc();

} );

QUnit.test( 'call lojax.in with target', function ( assert ) {

    var done1 = assert.async();

    div.empty()
        .append( '<div id="calling-in-with-target" jx-src="partials/InWithTarget.html" />' );

    tests.onSuccess = function ( id ) {
        assert.strictEqual( id, 'calling-in-with-target', 'context should be the target' );
        done1();
    };

    lojax.exec( {
        action: 'partials/InWithTarget.html',
        method: 'ajax-get',
        target: '#calling-in-with-target'
    } );

    lojax.Controller.loadSrc();

} );


QUnit.test( 'resolveForm', function ( assert ) {

    div.empty();

    var params = {
        form: null,
        source: null
    };

    // test a single form element
    var form = $( '<form></form>' ).appendTo( div );

    form.append( getForm() );

    params.form = '#div1 form';

    var resolvedForm = lojax.priv.resolveForm( params );

    assert.ok( resolvedForm.length == 1 && resolvedForm.is( 'form' ), 'should resolve a single form' );

    div.empty();

    // test a single div
    div.append( getForm() );

    params.form = '#div1';

    var resolvedForm = lojax.priv.resolveForm( params );

    assert.ok( resolvedForm.length == 16, 'should resolve a top-level element that is not a form to the inputs inside it' );

    div.empty();

    // test a compound selector
    form = $( '<form></form>' ).appendTo( div );

    form.append( getForm() );

    form = $( '<div></div>' ).appendTo( div );

    form.append( getForm() );

    params.form = '#div1 form, #div1 div';

    var resolvedForm = lojax.priv.resolveForm( params );

    assert.strictEqual( resolvedForm.length, 32, 'compound form selectors should resolve to the inputs inside each selector' );

    div.empty();

    // test a compound selector
    form = $( '<form></form>' ).appendTo( div );

    form.append( getForm() );

    form = $( '<div></div>' ).appendTo( div );

    form.append( getForm() );

    params.form = '#div1 form, #div1 div :input';

    var resolvedForm = lojax.priv.resolveForm( params );

    assert.strictEqual( resolvedForm.length, 32, 'compound form selectors should resolve to the inputs inside each selector' );

    div.empty();

} );

QUnit.test( 'then and catch', function ( assert ) {

    var done1 = assert.async();
    var done2 = assert.async();

    div.empty()
        .append( '<div jx-src="partials/RaiseEvent.html" jx-then="tests.onSuccess" />' )
        .append( '<div jx-src="partials/doesnotexist.html" jx-catch="tests.onFail" />' );

    tests.onSuccess = function () {
        assert.ok( true, 'jx-then should resolve to a function which should be called on a successful ajax call' );
        done1();
    };

    tests.onFail = function () {
        assert.ok( true, 'jx-catch should resolve to a function which should be called on a failed ajax call' );
        div.empty();
        done2();
    };

    lojax.Controller.loadSrc();

} );

QUnit.test( 'serializeArray', function ( assert ) {

    var form = $( '<form><input type="checkbox" name="in" checked value="inside"/></form><input type="checkbox" name="out" checked value="outside"/>' );

    var inputs = form.serializeArray();

    assert.ok( inputs.length == 2 );

} );

QUnit.test( 'submit event', function ( assert ) {

    div.empty();

    // create a form with a submit button
    var form = $( '<form></form>' );
    var submitBtn = $( '<input type="submit" data-method="ajax-post" data-action="partials/EmptyResponse.html#withhash" />' );

    div.append( form );

    // add some inputs
    form.append( getForm() );
    form.append( submitBtn );

    var done1 = assert.async();

    $( document ).on( lojax.events.beforeSubmit, function ( evt, arg ) {
        $( document ).off( lojax.events.beforeSubmit );
        assert.ok( arg != null );
        arg.cancel = true; 
        done1();
        lojax.logging = false;
        $( document ).off( lojax.events.beforeRequest );
    } );

    $( document ).one( lojax.events.beforeRequest, function ( evt, arg ) {
        assert.ok( false, 'the request should have been canceled' );
        done1();
    } );

    lojax.logging = true;

    submitBtn.click();

} );

QUnit.test( 'polling', function ( assert ) {

    div.empty();

    lojax.logging = true;

    $( div ).append( '<div jx-src="partials/RaiseEvent.html" jx-poll="1" />' );

    var done1 = assert.async();

    var count = 3;

    $( document ).on( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'should poll the url' );
        if ( --count == 0 )
        {
            div.empty();
            done1();
        }
        if ( count < 0 )
        {
            assert.ok( false, 'removing the jx-src element should stop the polling' )
        }
    } );


    lojax.Controller.loadSrc();

} );

QUnit.test( 'emptyHashAction', function ( assert ) {

    div.empty();

    lojax.logging = true;

    lojax.config.navHistory = true;

    //window.location.hash = '';

    var done1 = assert.async();
    $( document ).one( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'handleHash should execute the configured action if there is no hash' );
        done1();
    } );
    lojax.emptyHashAction = 'partials/RaiseEvent.html';
    lojax.Controller.handleHash();

    var done2 = assert.async();
    $( document ).one( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'handleHash should execute the configured action if there is no hash' );
        done2();
    } );
    lojax.emptyHashAction = function () {
        return 'partials/RaiseEvent.html';
    };
    lojax.Controller.handleHash();

    var done3 = assert.async();
    $( document ).one( 'customEvent', function ( evt, arg ) {
        assert.ok( true, 'handleHash should execute the configured action if there is no hash' );
        done3();
    } );
    lojax.emptyHashAction = {
        action: 'partials/RaiseEvent.html',
        method: 'ajax-get'
    };
    lojax.Controller.handleHash();

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

QUnit.test( 'isJSON', function ( assert ) {

    assert.equal( lojax.priv.isJSON( '{"number":5}' ), true, 'should detect objects' );

    assert.equal( lojax.priv.isJSON( '[1,2,3]' ), true, 'should detect arrays' );

    assert.equal( lojax.priv.isJSON( 'partials/ModelTest.html' ), false, 'should detect urls' );

    assert.equal( lojax.priv.isJSON( 'http://10.4.9.149:8080/lojax/spec/SpecRunner.html' ), false, 'should detect urls' );

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
            case 'put':
                assert.ok( arg.data.is( 'form' ), 'non-ajax post or put should use a form' );
                break;
            case 'ajax-post':
            case 'ajax-put':
                if ( window.FormData ) {
                    assert.ok( arg.data instanceof window.FormData, arg.method );
                }
                else {
                    assert.equal( arg.data, 'number=5', arg.method );
                }
                break;
            default:
                assert.equal( arg.data, 'number=5', arg.method );
                break;
        }
        // mongoose doesn't support put or delete :(
        if ( /get|post|put|ajax-put|ajax-delete/.test( arg.method ) ) arg.cancel = true;
        done();
    } );

    $( document ).on( lojax.events.afterRequest, function ( evt, arg ) {
        if ( ++i < methods.length ) {
            done = assert.async();
            // change the link and trigger the event again
            link.attr( 'data-method', methods[i] ).click();
        }
        else {
            // done
            $( document ).off( lojax.events.beforeRequest );
            $( document ).off( lojax.events.afterRequest );
        }
    } );

    // start the loop
    link.attr( 'data-method', methods[i] ).click();

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

QUnit.test( 'enter key event handler', function ( assert ) {

    $( document ).off( lojax.events.beforeRequest );

    var done = assert.async();
    var modelDiv = $( '<div data-model data-action="partials/RaiseEvent.html" data-method="ajax-get"></div>' );
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

    lojax.Controller.loadSrc( div );

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

QUnit.test( 'callIn', function ( assert ) {

    lojax.logging = true;

    var div2 = $( '<div jx-panel="hidden-div2" style="display:none"></div>' ).appendTo( 'body' );

    var done = assert.async();
    var done2 = assert.async();
    var done3 = assert.async();
    var done4 = assert.async();

    window.callInTest = function ( val ) {
        assert.ok( true, 'lojax.in called' );
        assert.equal( val, 'call-in-test', '' );
        done();
    };

    window.callInTest2 = function ( val ) {
        assert.ok( true, 'lojax.in called' );
        assert.equal( val, 'call-in-test2', '' );
        done2();
    };

    window.loadAsyncContentTest = function ( val ) {
        assert.ok( true, 'lojax.in called' );
        assert.equal( val, 'load async content', '' );
        done3();
    };

    window.callOutTest = function ( val ) {
        assert.ok( true, 'lojax.out called' );
        assert.equal( val, 'call-in-test', 'should be context-aware' );
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

QUnit.test( 'modals2', function ( assert ) {

    lojax.logging = true;

    div.empty();

    var done1 = assert.async();
    //var done2 = assert.async();

    $( document ).one( 'modal2', function () {
        console.log( 'createModal: modal2 raised' );
        assert.ok( true, 'inner modal was loaded' );
        lojax.closeModal();
        done1();
    } );

    $( '<button data-method="ajax-get" data-action="partials/modal2.html">' ).appendTo( div ).click();

} );

QUnit.test( 'preload', function ( assert ) {

    div.empty();

    var done = assert.async();

    lojax.logging = false;
    var store = lojax.Controller.cache;
    var prop;

    $( document ).one( lojax.events.afterRequest, function ( evt, arg ) {
        setTimeout( function () {
            prop = Object.getOwnPropertyNames( store )[0];
            assert.ok( /RaiseEvent/.test( prop ), 'make sure we have the right request' );
            var request = lojax.Controller.cache[prop];
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

