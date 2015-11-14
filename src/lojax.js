/*
TODO: 
- Handle files?
- rewrite formFromModel to recurse through arrays
- refactor: diagram everything out and reorganize
- handle request timeouts
- use MutationObserver to detect creation of async elements: div[data-src]
- provide a mechanism for pre-loading resources and caching them on the client
- implement dependency declarations
- use configuration to specify whether to serialize models to a query string or to JSON
- use config to specify a default transition
*/

/*
Dependencies:
jquery
*/

// namespace
var jax = jax || {};

(function ($) {

    jax.Gator = function () {
        var self = this;
        this.div = null;
        this.modal = null;
        this.currentTransition = null;
        this.currentPanel = null;

        $(function () {
            self.div = $("<div style='display:none'></div>").appendTo('body');
            $(document).on('click', '[data-request],[jx-request]', self.handleRequest);
            $(document).on('click', '[data-method]:not([data-trigger]),[jx-method]:not([jx-trigger])', self.handleRequest);
            $(document).on('change', '[data-method][data-trigger*=change],[jx-method][jx-trigger*=change]', self.handleRequest);
            $(document).on('keydown', '[data-method][data-trigger*=enter],[jx-method][jx-trigger*=enter]', self.handleEnterKey);
            $(document).on('change', '[data-model]', self.updateModel);

            window.addEventListener("hashchange", self.handleHash, false);

            self.loadAsyncContent();
            self.bindToModels();

            if (priv.hasHash()) {
                setTimeout(self.handleHash, 0);
            }
        });
    };

    jax.Gator.prototype = {

        handleRequest: function (evt) {
            // handles click, change, submit
            // 'this' will be the element that was clicked, changed, or submitted
            var params, $this = $(this);
            if ($this.is('[data-request]')) {
                params = JSON.parse($this.data('request').replace(/'/g, '"'));
            }
            else {
                params = $this.data();
            }
            params.source = this;

            jax.log('handleRequest: params: ').log(params);

            instance.executeRequest(params);

            evt.stopPropagation();

            evt.preventDefault();
        },

        executeRequest: function (params) {
            var request = new jax.Request(params);

            jax.log('executeRequest: request: ').log(request);

            if (request.action === null) return;

            if (request.action.indexOf('#') !== -1 && params.method === 'ajax-get') {

                // delegate hashes to handleHash

                var newHash = request.getHash();

                // store the request's transition so handleHash can pick it up
                instance.currentTransition = request.transition;

                // if hash equals the current hash, hashchange event won't fire
                // so call handleHash directly
                if ('#' + newHash === window.location.hash) {
                    instance.handleHash();
                }
                else {
                    window.location.hash = newHash;
                }
            }
            else {
                request.exec()
                    .then(function (response) {
                        instance.injectContent(request, response);
                    })
                    .catch(instance.handleError);
                instance.currentTransition = null;
            }
        },

        handleEnterKey: function (evt) {
            if (evt.which == 13) {
                instance.handleRequest.call(this, evt);
            }
        },

        handleHash: function () {
            // grab the current hash and request it with ajax-get

            var handler, request, hash = window.location.hash;

            jax.log('handleHash: hash: ').log(hash);

            if (priv.hasHash()) {

                // If there's no anchor with this name, handle with default settings.
                // We want to support url-only access, and we don't want to clutter 
                // the url with request settings like transition and target. That 
                // means that there must be enough information already in the page 
                // (like default-target) or in the response (jx-panel) to be able to 
                // properly handle the response.
                handler = $('a[name="' + hash.substr(1) + '"]');
                if (handler.size() === 0) {
                    request = new jax.Request({
                        action: hash,
                        method: 'ajax-get',
                        transition: instance.currentTransition
                    });
                    request.exec()
                        .then(function (response) {
                            instance.injectContent(request, response);
                        })
                        .catch(instance.handleError);
                }
                instance.currentTransition = null;
            }
            else {
                // we got here because a browser navigation button was clicked which changed the hash to nothing
                // so load the current page via ajax
                instance.executeRequest({
                    action: window.location.href,
                    method: 'ajax-get'
                });
            }
        },

        bindToModels: function (context) {
            context = context || document;
            var model, inputs, value, type, $this, models = [];
            var dataModels = $(context).find('[data-model]').add(context).filter('[data-model]');

            jax.log('bindToModels:').log('|-context: ').log(context);
            jax.log('|-dataModels:').log(dataModels);

            // iterate over the data-models found in context
            dataModels.each(function () {
                $this = $(this);
                // grab the data-model
                model = $this.data('model');
                if (!priv.hasValue(model) || model === '') {
                    // empty model, so create one from its inputs
                    model = priv.buildModelFromElements($this);
                    // store the result back into the element
                    $this.data('model', model);
                }
                else {
                    // set the inputs to the model
                    $this.find('[name]').each(function () {
                        value = priv.getModelValue(model, this.name);
                        type = priv.getType(value);
                        // lojax assumes ISO 8601 date serialization format
                        // http://www.hanselman.com/blog/OnTheNightmareThatIsJSONDatesPlusJSONNETAndASPNETWebAPI.aspx
                        // ISO 8601 is easy to parse
                        // making it possible to skip the problem of converting date strings to JS Date objects
                        if (type === 'date' || this.type === 'date') {
                            $(this).val(priv.standardDateFormat(value));
                        }
                        else if (type === 'boolean' && this.type === 'checkbox') {
                            this.checked = value;
                        }
                        else {
                            $(this).val(value);
                        }
                    });
                }
                models.push(model);
                jax.log('|-model:').log(model);
            });
            return models;
        },

        updateModel: function (evt) {
            jax.log('updateModel:');
            // provides simple one-way binding from HTML elements to a model
            var $this = $(this);
            var $target = $(evt.target);
            var model = $this.data('model');
            var name = evt.target.name;
            if (priv.hasValue(name) === false) {
                return;
            }
            var o = {
                target: evt.target,
                name: name,
                value: $target.val(),
                type: priv.getType(model[name]),
                model: model,
                cancel: false
            };
            // coerce the value to the proper type
            switch (o.type) {
                case 'number':
                    o.value = parseFloat(o.value);
                    break;
                case 'boolean':
                    if (evt.target.type == 'checkbox') {
                        o.value = evt.target.checked;
                    }
                    else {
                        o.value = o.value.toLocaleLowerCase() === 'true';
                    }
                    break;
                default:
                    break;
            }
            jax.log('updateModel: o:').log(o);
            if (o.model[o.name] !== o.value) {
                priv.triggerEvent(jax.events.beforeUpdateModel, o);
                if (o.cancel === true) return;
                o.model[o.name] = o.value;
                // TODO: set an isDirty flag without corrupting the model
                // maybe use a wrapper class to observe the model
                priv.triggerEvent(jax.events.afterUpdateModel, o);
            }
        },

        injectContent: function (request, response) {
            jax.log('injectContent:');

            var id, target, newModal, transition, $node, result;
            var nodes = $.parseHTML(response, true);
            jax.log('|-nodes:').log(nodes);

            priv.triggerEvent(jax.events.beforeInject, nodes);

            if (request.target) {
                transition = priv.resolveTransition(request, request.target);
                result = transition(request.target, response);
                request.target.refresh = request;
                priv.triggerEvent(jax.events.afterInject, result);
                instance.loadAsyncContent(request.target);
                instance.bindToModels(request.target);
                priv.callIn(result);
                return;
            }

            var doPanel = function (node) {
                // match up with panels on the page
                id = node.data('jaxpanel');
                target = $('[data-jaxpanel="' + id + '"]');

                if (target.size() > 0) {
                    jax.log('data-jaxpanel: ' + id);
                    transition = priv.resolveTransition(request, node);
                    result = transition(target, node);
                    if (priv.hasValue(request)) {
                        result.refresh = request.exec.bind(request);
                    }
                    priv.triggerEvent(jax.events.afterInject, result);
                    instance.loadAsyncContent(result);
                    instance.bindToModels(result);
                    priv.callIn(result);
                }
            };

            for (var i = 0; i < nodes.length; i++) {
                $node = $(nodes[i]);
                // check for modal
                if (instance.modal === null) {
                    if ($node.is('.modal')) {
                        instance.createModal($node);
                        continue;
                    }
                    else {
                        newModal = $node.find('.modal');
                        if (newModal.length > 0) {
                            instance.createModal(newModal);
                        }
                    }
                }

                // find all the panels in the new content
                if ($node.is('[data-jaxpanel]')) {
                    doPanel($node);
                    continue;
                }
                else {
                    // iterate through the panels
                    $(nodes[i]).find('[data-jaxpanel]').each(function () {
                        doPanel($(this));
                    });
                }
            }

            // find any loose script and style nodes
            instance.div.empty();
            nodes.forEach(function (node) {
                $node = $(node);
                if ($node.is('script,style')) {
                    instance.div.append($node);
                }
            });
        },

        createModal: function (content) {
            // check for bootstrap
            if ($.fn.modal) {
                instance.modal = $(content).appendTo('body').modal({
                    show: false,
                    keyboard: true
                });
                instance.modal.on('hidden.bs.modal', function () {
                    if (priv.hasValue(instance.modal)) {
                        instance.modal.off('hidden.bs.modal', instance.onModalClose);
                        instance.modal.modal('hide');
                        $(instance.modal).remove();
                        instance.modal = null;
                    }
                });
                instance.loadAsyncContent(instance.modal);
                instance.bindToModels(instance.modal);
                instance.modal.modal('show');
            }
                // check for kendo
            else if ($.fn.kendoWindow) {
                instance.modal = $(content).appendTo('body').kendoWindow({
                    title: $(content).find('.dialog-header').text(),
                    modal: true,
                    animation: {
                        open: {
                            effects: "fade:in"
                        }
                    },
                    visible: false,
                    close: function () {
                        if (priv.hasValue(instance.modal)) {
                            instance.modal.data('kendoWindow').destroy();
                            $(instance.modal).remove();
                            instance.modal = null;
                        }
                    }
                });
                instance.modal.data('kendoWindow').center().open();
                instance.modal.find('[data-dismiss=modal]').click(function () {
                    instance.modal.data('kendoWindow').close();
                });
            }
        },

        // this is often called when the server returns a success 
        // response from a form submission that came from a modal
        closeModal: function () {
            if (priv.hasValue(instance.modal)) {
                if ($.fn.modal) {
                    instance.modal.hide();
                }
                else if ($.fn.kendoWindow) {
                    instance.modal.data('kendoWindow').close();
                }
            }
        },

        // an AJAX alternative to iframes
        loadAsyncContent: function (root) {
            root = root || document;
            $(root).find('div[data-src]').each(function () {
                var url = $(this).data('src');
                priv.triggerEvent(jax.events.beforeRequest, {
                    action: url
                });
                $(this).load(url, function () {
                    instance.bindToModels(this);
                    priv.triggerEvent(jax.events.afterRequest, {
                        action: url
                    });
                });
            });
        },

        handleError: function (response) {
            priv.triggerEvent(jax.events.ajaxError, response);
            if (response.handled) return;
            var error = [];
            Object.getOwnPropertyNames(response).forEach(function (name) {
                if (typeof response[name] !== 'function') {
                    error.push(response[name]);
                }
            });
            console.log(response);
            console.log(response.responseText);
        }
    };

    jax.Request = function (params) {
        this.method = params.method.toLowerCase();
        this.form = priv.resolveForm(params);
        this.action = priv.resolveAction(params);
        this.model = priv.resolveModel(params);
        this.transition = params.transition;
        this.target = priv.resolveTarget(params);
        this.cancel = false;
        this.resolve = null;
        this.reject = null;
        this.result = null;
        this.error = null;
    };

    jax.Request.prototype = {
        getSearch: function () {
            var queryString = '';
            if (priv.hasValue(this.form)) {
                queryString = priv.resolveInputs(this.form).serialize();
            }
            else if (priv.hasValue(this.model)) {
                queryString = $.param(this.model);
            }
            return queryString;
        },
        getForm: function (method) {
            var form = null;
            method = method || 'post';
            if (priv.hasValue(this.form)) {
                form = priv.buildForm(this.form, this.action, method);
            }
            else if (priv.hasValue(this.model)) {
                form = priv.formFromModel(this.model, method, this.action);
            }
            else {
                // if there's neither a form nor a model, return a blank form
                form = priv.formFromModel(null, method, this.action);
            }
            return form;
        },
        getHash: function () {
            var hash = priv.checkHash(this.action);
            if (hash !== null) {
                var search = this.getSearch();
                return hash + (search !== '' ? '?' + search : '');
            }
            return null;
        },
        formal: function (type) {
            var self = this;
            var form = this.getForm(type);
            form.appendTo('body');
            form[0].submit();
            // in the case of downloading a file, the page is not refreshed
            // so we still need to clean up after ourselves
            setTimeout(function () {
                form.remove();
                priv.triggerEvent(jax.events.afterRequest, self);
            }, 0);
        },
        ajax: function (type) {
            var self = this;
            var search = this.getSearch();
            jax.log('ajax: search: ' + search);
            $.ajax({
                url: this.action,
                type: type.toUpperCase(),
                data: search
            })
                .done(self.done.bind(self))
                .fail(self.fail.bind(self));
        },
        done: function (response) {
            this.result = response;
            if (priv.hasValue(this.resolve)) {
                this.resolve(response);
            }
            priv.triggerEvent(jax.events.afterRequest, this);
        },
        fail: function (error) {
            this.error = error;
            if (priv.hasValue(this.reject)) {
                this.reject(error);
            }
            priv.triggerEvent(jax.events.afterRequest, this);
        },
        methods: {
            get: function () {
                var queryString = this.getSearch();
                var url = priv.checkHash(this.action);
                window.location = url + '?' + queryString;
                priv.triggerEvent(jax.events.afterRequest, this);
            },
            post: function () {
                this.formal('post');
            },
            'ajax-get': function () {
                var url = priv.checkHash(this.action);
                var search = this.getSearch();
                $.get(url, search)
                    .done(this.done.bind(this))
                    .fail(this.fail.bind(this));
            },
            'ajax-post': function () {
                this.ajax('post');
            },
            'ajax-put': function () {
                this.ajax('put');
            },
            'ajax-delete': function () {
                this.ajax('delete');
            },
            jsonp: function () {
                var self = this;
                var queryString = this.getSearch();
                var url = priv.checkHash(this.action);
                var s = document.createElement('script');
                s.type = 'text/javascript';
                s.src = url + '?' + queryString;
                document.body.appendChild(s);
                setTimeout(function () {
                    document.body.removeChild(s);
                    // we have no way of handling the response of JSONP
                    // but trigger the event anyway
                    priv.triggerEvent(jax.events.afterRequest, self);
                }, 10);
            }
        },

        exec: function () {
            // reset 
            this.result = null;
            this.error = null;
            this.cancel = false;

            if (!priv.hasValue(this.methods[this.method])) throw 'Unsupported method: ' + this.method;

            if (priv.hasValue(this.action) && this.action !== '') {
                priv.triggerEvent(jax.events.beforeRequest, this);
                if (this.cancel == false) {
                    // execute the method function
                    this.methods[this.method].bind(this)();
                }
                else {
                    priv.triggerEvent(jax.events.afterRequest, this);
                }
            }
            return this;
        },

        // fake promise
        then: function (resolve, reject) {
            if (priv.hasValue(resolve)) {
                this.resolve = resolve;
                if (this.result !== null) {
                    // the response came before calling this function
                    this.resolve(this.result);
                }
            }
            if (priv.hasValue(reject)) {
                this.reject = reject;
                if (this.error !== null) {
                    // the response came before calling this function
                    this.reject(this.error);
                }
            }
            return this;
        },

        // fake promise
        catch: function (reject) {
            return this.then(undefined, reject);
        }
    };

    jax.Transitions = {
        'replace': function (oldPanel, newPanel) {
            $(newPanel).fadeOut(0);
            $(oldPanel).fadeOut(0).replaceWith(newPanel);
            $(newPanel).fadeIn('slow');
            return newPanel;
        },
        'fade-in': function (oldPanel, newPanel) {
            oldPanel.fadeOut(0).empty().append($(newPanel).children()).fadeIn();
            return oldPanel;
        },
        'flip-horizontal': function (oldPanel, newPanel) {
            var parent = $(oldPanel).parent().addClass('flip-horizontal').css('position', 'relative');
            $(oldPanel).addClass('front');
            $(newPanel).addClass('back').width(oldPanel.width()).appendTo(parent);
            setTimeout(function () {
                parent.addClass('flip');
            }, 100);
            setTimeout(function () {
                $(oldPanel).remove();
                parent.removeClass('flip').removeClass('flip-horizontal');
                $(newPanel).removeClass('back').css('width', '');
            }, 1000);
            return newPanel;
        },
        'flip-vertical': function (oldPanel, newPanel) {
            var parent = $(oldPanel).parent().addClass('flip-vertical').css('position', 'relative');
            oldPanel.addClass('front');
            $(newPanel).addClass('back').css('width', oldPanel.width()).appendTo(parent);
            setTimeout(function () {
                parent.addClass('flip');
            }, 100);
            setTimeout(function () {
                oldPanel.remove();
                parent.removeClass('flip').removeClass('flip-vertical');
                $(newPanel).removeClass('back').css('width', '');
            }, 1000);
            return newPanel;
        },
        'slide-left': function (oldPanel, newPanel) {
            var parent = oldPanel.parent().addClass('slide-left').css('position', 'relative');
            $(oldPanel).addClass('left');
            $(newPanel).addClass('right').appendTo(parent);
            setTimeout(function () {
                parent.addClass('slide');
            }, 100);
            setTimeout(function () {
                oldPanel.remove();
                parent.removeClass('slide').removeClass('slide-left');
                $(newPanel).removeClass('right');
            }, 800);
            return newPanel;
        },
        'append': function (oldPanel, newPanel) {
            // useful for paging
            $(newPanel).children().fadeOut(0).appendTo(oldPanel).fadeIn('slow');
            return newPanel;
        },
        'prepend': function (oldPanel, newPanel) {
            // useful for paging
            $(newPanel).fadeOut(0).prependTo(oldPanel).fadeIn('slow');
            return newPanel;
        }
    };
    // private functions
    var priv = {
        hasValue: function (val) {
            return typeof val !== 'undefined' && val !== null;
        },
        resolveAction: function (params) {
            // if there's an action in the params, return it
            if (priv.hasValue(params.action) && params.action.length) {
                return params.action;
            }
            if (priv.hasValue(params.source)
                && priv.hasValue(params.source.href)
                && params.source.href.length
                && params.source.href.substr(params.source.href.length - 1, 1) !== '#'
                && params.source.href.substr(0, 11) !== 'javascript:') {
                return params.source.href;
            }
            return null;
        },
        resolveForm: function (params) {
            var form;
            // use the jQuery selector if present
            if (priv.hasValue(params.form)) {
                return $(params.form);
            }
            // if there's a model, don't search for a form
            if (priv.hasValue(params.model)) {
                return null;
            }
            // find the closest form element
            form = $(params.source).closest('form');
            if (form.size() > 0) {
                return form;
            }
            return null;
        },
        resolveModel: function (params) {
            // jQuery's data() function doesn't get the most recent value if it's an object
            // if the value changes jQuery will still return the original object
            // so use the attr() function instead
            if (priv.hasValue(params.source)
                && priv.hasValue($(params.source).attr('data-model'))
                && $(params.source).attr('data-model').length) {
                params.model = JSON.parse($(params.source).attr('data-model'));
                return params.model;
            }
            if (typeof params.model === 'object') {
                return params.model;
            }
            if (typeof params.model === 'string') {
                params.model = JSON.parse(params.model);
                return params.model;
            }
            var model = $(params.source).closest('[data-model]');
            if (model.size() > 0) {
                params.model = model.data('model');
                return params.model;
            }
            return null;
        },
        resolveTarget: function (params) {
            if (priv.hasValue(params.target)) {
                return $(params.target);
            }
            return null;
        },
        resolveInputs: function (form) {
            var inputs = $(form).find(':input');
            if (inputs.size() === 0) {
                inputs = $(form).filter(':input');
            }
            return inputs;
        },
        resolveTransition: function (request, target) {
            // check for a transition in the request first
            if (request.transition) {
                return jax.Transitions[request.transition] || jax.Transitions['fade-in'];
            }
            else {
                // check for a transition on the target
                return jax.Transitions[$(target).attr('data-transition')] || jax.Transitions['fade-in'];
            }
        },
        buildForm: function (forms, action, method) {
            if ($(forms).size() > 0) {
                method = method || 'POST';
                var form = $("<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>");
                var inputs = priv.resolveInputs(forms).serializeArray();
                inputs.forEach(function (obj) {
                    $("<input type='hidden' />").appendTo(form).prop('name', obj.name).val(obj.value);
                });
                jax.log('buildForm: form: ').log(form);
                return form;
            }
            return forms;
        },
        formFromModel: function (model, method, action, rootName, form) {
            if (!priv.hasValue(form)) {
                method = method || 'POST';
                action = action || '';
                form = $("<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>");
                rootName = '';
            }

            if (priv.hasValue(model)) {
                // populate the form

                var type, names = Object.getOwnPropertyNames(model);

                names.forEach(function (name) {
                    type = priv.getType(model[name]);
                    switch (type) {
                        case 'array':
                            model[name].forEach(function (val) {
                                if (priv.hasValue(val) && val !== '') {
                                    // add hidden input to form
                                    $("<input type='hidden' />").appendTo(form).prop('name', rootName + name).val(val);
                                }
                            });
                            break;
                        case 'object':
                            // recurse through child objects
                            priv.formFromModel(model[name], method, action, rootName + name + '.', form);
                            break;
                        case 'function':
                        case null:
                            break;
                        default:
                            // add hidden input to form
                            $("<input type='hidden' />").appendTo(form).prop('name', rootName + name).val(model[name].toString());
                    }
                });
            }

            jax.log('formFromModel: form: ').log(form);

            return form;
        },
        buildPropertyPath: function (obj, path, value) {
            // o is our placeholder
            var o = obj, val, prop, index, paths = path.split('.');
            val = value;
            if (val === undefined) val = null;
            // split out any array indexers
            paths.forEach(function (path, index) {
                paths[index] = path.replace(']', '').split('[');
            });

            for (var i = 0; i < paths.length; i++) {
                prop = paths[i][0]; // property name
                index = paths[i][1]; // array index
                // don't overwrite previously defined properties
                if (o[prop] === undefined) {
                    // if this is not the last one, set it to an object
                    // so we have something to add properties to on the next loop
                    if (i < paths.length - 1) {
                        o[prop] = {};
                    }
                    else {
                        // last one
                        o[prop] = val;
                    }
                }
                if (paths[i].length === 2) {
                    // don't overwrite previously defined arrays
                    if (!Array.isArray(o[prop])) {
                        o[prop] = [];
                    }
                    // advance the placeholder
                    o = o[prop];
                    // don't overwrite previously defined array elements
                    if (index && o[index] === undefined) {
                        // if this is not the last one, set it to an object
                        // so we have something to add properties to on the next loop
                        if (i < paths.length - 1) {
                            o[index] = {};
                        }
                        else {
                            // last one
                            o[index] = val;
                        }
                    }
                    else if (value !== undefined) {
                        o.push(value);
                    }
                    // advance the placeholder
                    o = o[index];
                }
                else {
                    // advance the placeholder
                    o = o[prop];
                }
            }

            return o;
        },
        setModelProperty: function(context, model, elem) {
            // derive an object path from the input name
            name = elem.name;
            type = elem.type;
            // if this is a checkbox and their are other checkboxes with this name, assume an array of indeterminate length
            if (type === 'checkbox'
                && $(context).find('input[type=checkbox][name="' + name + '"]').length > 1) {
                name = name + '[]';
            }

            // derive a data type
            if (elem.type === 'checkbox' && elem.value.toLowerCase() === 'true') {
                type = 'boolean';
            }
            else {
                // number, text, date, etc
                type = elem.type;
            }

            // derive a value or undefined
            if (elem.value == '') {
                value = undefined;
            } 
            else {
                switch (type) {
                    case 'number':
                        value = parseFloat(elem.value);
                        break;
                    case 'boolean':
                        value = elem.checked;
                        break;
                    case 'checkbox':
                        value = elem.checked ? elem.value : undefined;
                        break;
                    default:
                        value = elem.value;
                        break;
                }
            }

            priv.buildPropertyPath(model, name, value);
        },
        buildModelFromElements: function (context) {
            var model = {};

            $(context).find('[name]').each(function () {
                priv.setModelProperty(context, model, this);
            });

            jax.log('buildModelFromElements:').log('|-model:').log(model);
            return model;
        },
        getModelValue(model, path) {
            // split by dots, then square brackets
            // we're assuming there won't be dots between square brackets
            try {
                var currentObj = model;
                var paths = path.split('.');

                for (var i = 0; i < paths.length && currentObj; i++) {
                    var name = paths[i];
                    var split = name.split('[');
                    var objName = split[0];
                    currentObj = currentObj[objName];
                    if (currentObj && split.length > 1) {
                        var indexer = split[1].slice(0, -1);
                        currentObj = currentObj[indexer];
                    }
                }

                return currentObj;
            }
            catch (err) {
                console.log('Could not resolve object path: ' + path);
                console.log(err);
            }
        },
        getType: function (a) {
            if (a === null) {
                return null;
            }
            if (a instanceof Date) {
                return 'date';
            }
            if (Array.isArray(a)) {
                return 'array';
            }
            // 'number','string','boolean','function','object','undefined'
            return typeof (a);
        },
        triggerEvent: function (name, arg) {
            $.event.trigger({
                type: name,
                source: arg
            }, arg);
        },
        checkHash: function (url) {
            // return the hash portion if present
            var index = url.indexOf('#');
            if (index !== -1) {
                return url.substring(index + 1);
            }
            return url;
        },
        hasHash: function () {
            // hash has to be longer than just '#_' and have some alpha characters in it
            return window.location.hash.length > 2 && /[a-z]/i.test(window.location.hash);
        },
        standardDateFormat: function (date) {
            if (priv.hasValue(date) === false) return;
            if (typeof date === 'string') {
                return date.substring(0, 10);
            }
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var d = date.getDate();
            var out = [];
            out.push(y);
            out.push('-');
            if (m < 10)
                out.push('0');
            out.push(m);
            out.push('-');
            if (d < 10)
                out.push('0');
            out.push(d);
            return out.join('');
        },
        callIn: function (panel) {
            if (panel && instance.in) {
                instance.in.call(panel);
                instance.in = null;
            }
        }
    };

    // handle an arbitrary event
    jax.on = function (event, params) {
        $(document).on(event, function () {
            instance.executeRequest(params);
        });
    };

    jax.off = function (event) {
        $(document).off(event);
    };

    jax.get = function (params) {
        instance.executeRequest(params);
    };

    jax.in = function (callback) {
        instance.in = callback;
    };

    jax.events = {
        beforeRequest: 'beforeRequest',
        afterRequest: 'afterRequest',
        beforeUpdateModel: 'beforeUpdateModel',
        afterUpdateModel: 'afterUpdateModel',
        beforeInject: 'beforeInject',
        afterInject: 'afterInject',
        ajaxError: 'ajaxError'
    };

    jax.logging = false;

    jax.log = function (arg) {
        if (jax.logging) {
            console.log(arg);
        }
        return jax;
    };

    // for testing
    jax.priv = priv;

    // global
    jax.instance = new jax.Gator();

    // local
    var instance = jax.instance;

})(jQuery);