if ( lojax.bindAllModels ) {

    var tests = tests || {};

    var getDetail = function () {
        var out = [];

        out.push( '<div name="number" />' );
        out.push( '<h1 name="daterange[0]"></h1>' );
        out.push( '<h1 name="daterange[1]"></h1>' );
        out.push( '<span name="bool" />' );
        out.push( '<ul name="arrays.names">' )
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

    QUnit.test( 'modals1', function ( assert ) {

        div.empty();

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

            done2();
        };

        window.loadAsyncContentTest = function ( val ) {
            assert.equal( val, 'load async content', 'loadSrc called' );
            done1();
            lojax.logging = false;
            lojax.closeModal();
        };

        $( '<button data-method="ajax-get" data-action="partials/modal.html?_=2">' ).appendTo( div ).click().remove();

    } );

    QUnit.test( 'methods2', function ( assert ) {

        //lojax.logging = true;

        var link = $( '<a href="partials/EmptyResponse.html" jx-model="{&quot;number&quot;:5}"></a>' );

        div.append( getForm() );

        div.append( link );

        var dones = [];

        for ( var method in methods ) {
            dones.push( assert.async() );
        }

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
            dones[i++]();

            if ( i == methods.length ) {
                $( document ).off( lojax.events.beforeRequest );
            }

        } );

        for ( var i in methods ) {
            link.attr( 'data-method', methods[i] ).click();
        }

        div.empty();

    } );

    QUnit.test( 'Request.getData', function ( assert ) {

        var data, req;

        methods.forEach( function ( method ) {
            req = new lojax.Request( {
                action: 'partials/EmptyResponse.html',
                method: method,
                model: getModel()
            } );
            data = req.getData();
            assert.ok( data != null );
        } );

    } );


    QUnit.test( 'castValue', function ( assert ) {

        div.empty();

        var fn = lojax.priv.castValues;

        var form = getForm();

        div.append( form );

        lojax.logging = true;

        assert.strictEqual( fn( '5', 'number' ), 5 );
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

        lojax.bindAllModels( input );

        var model = input.data( 'model' );

        assert.ok( model != undefined, 'Should find one model' );

        input.remove();

        input = $( '<input type="number" name="number" value="1" />' );

        div.append( input );

        lojax.bindAllModels( input );

        model = input.data( 'model' );

        assert.ok( model == undefined, 'Should find zero models' );

    } );

    QUnit.test( 'binding models 2', function ( assert ) {

        div.empty();

        var modelDiv = $( '<div data-model></div>' );

        modelDiv.append( getForm() );

        div.append( modelDiv );

        lojax.logging = true;

        lojax.bindAllModels( modelDiv );

        lojax.logging = false;

        var m = modelDiv.data( 'model' );

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
        lojax.bindAllModels( modelDiv );

        // grab the model
        var m = modelDiv.data( 'model' );

        assert.strictEqual( m.daterange[0], '2015-01-01', 'Should resolve dates' );
        assert.strictEqual( m.daterange[1], '2015-12-31', 'Should resolve dates' );
        assert.strictEqual( m.bool, true, 'Should resolve bools' );
        assert.strictEqual( m.arrays.names[1], 'Kit', 'Should resolve arrays' );
        assert.strictEqual( m.arrays.names.length, 2, 'Should repopulate arrays' );

        lojax.logging = true;

        modelDiv.find( '[name="daterange[0]"]' ).val( '2015-11-13' ).change();
        modelDiv.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
        modelDiv.find( '[name=bool]' ).prop( 'checked', false ).change();
        modelDiv.find( '[value=Kaleb]' ).prop( 'checked', true ).change();
        modelDiv.find( '[name=color][value=green]' ).prop( 'checked', true ).change();

        assert.strictEqual( m.daterange[0], '2015-11-13', 'Should resolve dates' );
        assert.strictEqual( m.daterange[1], '2015-11-15', 'Should resolve dates' );
        assert.strictEqual( m.bool, false, 'Should resolve bools' );
        assert.strictEqual( m.color, 'green', 'Should resolve radios' );
        assert.strictEqual( m.arrays.names[2], 'Kaleb', 'Should resolve arrays' );
        assert.strictEqual( m.arrays.names.length, 3, 'Should repopulate arrays' );

        lojax.logging = false;

        //console.log( m );

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
        lojax.bindAllModels( modelDiv );

        // change some of the values
        modelDiv.find( '[name="daterange[0]"]' ).val( '2015-11-01' ).change();
        modelDiv.find( '[name="daterange[1]"]' ).val( '2015-11-15' ).change();
        modelDiv.find( '[name=bool]' ).prop( 'checked', true ).change();
        modelDiv.find( '[value=Todd]' ).prop( 'checked', true ).change();

        var model = modelDiv.data( 'model' );

        assert.strictEqual( model.daterange[0], '2015-11-01', 'lojax should monitor changes' );
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
        lojax.bindAllModels( modelDiv );

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

}
