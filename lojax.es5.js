
// namespace
'use strict';

var lojax = lojax || {};

(function ($, jx) {
    'use strict';
    // prevent this script from running more than once
    if (jx.Controller) {
        return;
    }

    var priv = {};
    var rexp = {};
    jx.Controller = {};
    jx.Transitions = {};
    var instance = jx.Controller;
    jx.priv = priv;
    jx.modules = [];

    /***********\
        API
    \***********/

    // handle an arbitrary event and execute a request
    jx.on = function (event, selector, request) {
        if (request === undefined) {
            $(document).on(event, function () {
                instance.executeRequest(selector);
            });
        } else {
            $(document).on(event, selector, function () {
                instance.executeRequest(request);
            });
        }
    };

    // remove event handler
    jx.off = function (event) {
        $(document).off(event);
    };

    // execute a request
    jx.exec = function (params) {
        instance.executeRequest(params);
    };

    // call this from a script that is located inside a jx-panel, div[data-src] or .modal
    // executes a callback with the context set to the injected node
    jx['in'] = function (callback) {
        instance['in'] = callback;
    };

    jx.out = function (callback) {
        instance.out = callback;
    };

    jx.events = {
        beforeSubmit: 'beforeSubmit',
        beforeRequest: 'beforeRequest',
        afterRequest: 'afterRequest',
        beforeUpdateModel: 'beforeUpdateModel',
        afterUpdateModel: 'afterUpdateModel',
        beforeInject: 'beforeInject',
        afterInject: 'afterInject',
        ajaxError: 'ajaxError'
    };

    Object.getOwnPropertyNames(jx.events).forEach(function (prop) {
        jx[prop] = function (handler) {
            if (typeof handler == 'function') {
                $(document).on(lojax.events[prop], handler);
            }
        };
    });

    jx.config = {
        prefix: 'jx-',
        transition: 'fade-in',
        // This action is executed when a browser nav button is clicked
        // which changes window.location.hash to an empty string.
        // This can be a url, a config object for creating a new request,
        // or a function which returns a url or config object.
        emptyHashAction: null
    };

    var navHistory = false;

    Object.defineProperty(jx.config, 'navHistory', {
        get: function get() {
            return navHistory;
        },
        set: function set(b) {
            navHistory = b;
            b ? window.addEventListener("hashchange", jx.Controller.handleHash, false) : window.removeEventListener("hashchange", jx.Controller.handleHash, false);
            if (b) {
                jx.Controller.handleHash();
            }
        }
    });

    jx.preload = function (urls) {
        var obj, request;
        if (!Array.isArray(urls)) {
            urls = [urls];
        }
        urls.forEach(function (url) {
            if (typeof url === 'string') {
                obj = {
                    action: url
                };
            } else {
                obj = url;
            }
            obj.method = obj.method || 'ajax-get';
            obj.suppressEvents = true;
            request = new jx.Request(obj);
            // if it's got a valid action that hasn't already been cached, cache and execute
            if (priv.hasValue(request.action) && !jx.Controller.cache[request.action]) {
                jx.Controller.cache[request.action] = request;
                request.exec();
            }
        });
    };

    jx.registerModule = function (fn) {
        if (typeof fn === 'function') {
            jx.modules.push(fn);
        }
    };

    jx.select = {
        methodOrRequest: ['[data-request]', '[jx-request]', '[data-method]:not([data-trigger])', '[jx-method]:not([jx-trigger])'].join(','),
        methodWithChange: ['[data-method][data-trigger*=change]', '[jx-method][jx-trigger*=change]'].join(','),
        methodWithEnterOrModel: ['[data-method][data-trigger*=enter]', '[jx-method][jx-trigger*=enter]', '[data-model]', '[jx-model]'].join(','),
        formWithMethod: 'form[data-method],form[jx-method]',
        model: '[data-model],[jx-model]',
        src: '[data-src],[jx-src]',
        preload: '[data-preload],[jx-preload]',
        jxModelAttribute: '[jx-model]',
        jxModel: 'jx-model',
        inputTriggerChangeOrEnter: [':input[name][jx-trigger*=change]', ':input[name][data-trigger*=change]', ':input[name][jx-trigger*=enter]', ':input[name][data-trigger*=enter]'].join(','),
        panel: function panel(id) {
            return '[' + lojax.config.prefix + 'panel="' + id + '"],[data-panel="' + id + '"]';
        }
    };

    /***********\
     Controller
    \***********/

    $.extend(jx.Controller, {

        init: function init() {
            var self = this;
            this.div = null;
            this.modal = null;
            this.currentTransition = null;
            this.currentPanel = null;
            this.cache = {};
            this.isControl = false;

            $(function () {
                self.div = $('<div style="display:none"></div>').appendTo('body');

                self.removeHandlers();
                self.addHandlers();
                self.loadSrc();
                self.preloadAsync();

                // check window.location.hash for valid hash
                if (jx.config.navHistory && priv.hasHash()) {
                    setTimeout(self.handleHash);
                }
            });
        },

        addHandlers: function addHandlers() {
            $(document).on('click', jx.select.methodOrRequest, this.handleRequest).on('change', jx.select.methodWithChange, this.handleRequest)
            // allows executing a request on a single input element without wrapping it in a form (e.g. data-trigger="change enter")
            // also submits an element with a model attribute if enter key is pressed
            .on('keydown', jx.select.methodWithEnterOrModel, this.handleEnterKey).on('submit', jx.select.formWithMethod, this.handleRequest)
            // handle the control key
            .on('keydown', this.handleControlKey).on('keyup', this.handleControlKey).on(lojax.events.beforeRequest, this.disableButton).on(lojax.events.afterRequest, this.enableButton);
            if (jx.config.navHistory) {
                window.addEventListener("hashchange", this.handleHash, false);
            }
        },

        removeHandlers: function removeHandlers() {
            $(document).off('click', this.handleRequest).off('change', this.handleRequest).off('keydown', this.handleEnterKey).off('submit', this.handleRequest).off('keydown', this.handleControlKey).off('keyup', this.handleControlKey).off(lojax.events.beforeRequest, this.disableButton).off(lojax.events.afterRequest, this.enableButton);
            if (jx.config.navHistory) {
                window.removeEventListener("hashchange", this.handleHash, false);
            }
        },

        disableButton: function disableButton(evt, arg) {
            // prevent users from double-clicking, timeout of 30 seconds
            if (arg.eventType == 'click') {
                priv.disable(arg.source, 30);
                $(arg.source).addClass('busy');
            };
        },

        enableButton: function enableButton(evt, arg) {
            priv.enable(arg.source);
        },

        handleRequest: function handleRequest(evt) {
            evt.stopPropagation();

            // handles click, change, submit, keydown (enter)
            // 'this' will be the element that was clicked, changed, submitted or keydowned
            var params = priv.getConfig(this),
                $this = $(this);

            // preserve the event type so we can disable buttons
            params.eventType = evt.type;

            var request = new jx.Request(params);

            try {
                // delegate hashes to handleHash
                if (request.isNavHistory) {

                    // if the control key is down and this is a hash url, let the browser handle it
                    if (instance.isControl) {
                        priv.enable($this);
                        return;
                    }

                    // store the request's transition so handleHash can pick it up
                    instance.currentTransition = request.transition;

                    var newHash = request.action;

                    if (request.data) {
                        newHash += '?' + request.data;
                    }

                    // if hash equals the current hash, hashchange event won't fire
                    // so call handleHash directly
                    if ('#' + newHash === window.location.hash) {
                        instance.handleHash();
                    } else {
                        // trigger hashchange event
                        window.location.hash = newHash;
                    }
                } else {
                    instance.executeRequest(request);
                }
            } catch (ex) {
                priv.enable($this);
                priv.error(ex);
            }

            evt.preventDefault();
        },

        handleEnterKey: function handleEnterKey(evt) {
            if (evt.which === 13) {
                instance.handleRequest.call(this, evt);
            }
        },

        handleControlKey: function handleControlKey(evt) {
            if (evt.which === 17) {
                instance.isControl = evt.type === 'keydown';
            }
        },

        handleHash: function handleHash() {
            // grab the current hash and request it with ajax-get
            var handler,
                request,
                hash = window.location.hash;

            // ignore the hash change if navHistory is not turned on
            if (!jx.config.navHistory) return;

            if (priv.hasHash()) {

                // If there's no anchor with this name, handle with default settings.
                // We want to support url-only access, and we don't want to clutter
                // the url with request settings like transition and target. That
                // means that there must be enough information already in the page
                // or response (jx-panel) to be able to properly handle the response.
                handler = $('a[name="' + hash.substr(1) + '"]');
                if (handler.length === 0) {
                    instance.executeRequest({
                        action: hash,
                        method: 'ajax-get',
                        transition: instance.currentTransition
                    });
                }
                instance.currentTransition = null;
            } else if (hash === '' && jx.emptyHashAction) {
                // we got here because a browser navigation button
                // was clicked which changed the hash to an empty string
                // so execute the configured action if present, else do nothing
                instance.executeRequest(jx.emptyHashAction);
            }
        },

        executeRequest: function executeRequest(request) {
            var req, copyProps;

            if (!(request instanceof jx.Request)) {
                request = new jx.Request(request);
            }

            // no action? we're done here
            // this check must be done after the Request constructor executes priv.resolveAction
            if (request.action === null) return;

            // check for caching
            if (request.action in this.cache) {
                req = this.cache[request.action];
                // copy properties that were likely not included in the preloaded version
                copyProps = 'isNavHistory transition source before callbacks suppressEvents eventType'.split(' ');
                copyProps.forEach(function (prop) {
                    req[prop] = req[prop] || request[prop];
                });
                delete this.cache[req.action];
            } else {
                req = request;
                // if we got here by through lojax.exec
                // the source won't be disabled by the event handlers
                if (req.source && $(req.source).is(':button,a')) {
                    priv.disable(req.source, 30);
                }
                request.exec();
            }

            req.then(function (response) {
                instance.injectContent(req, response);
                // if the request has a poll interval, handle it after the request has been processed
                instance.handlePolling(req);
                priv.enable($(req.source));
            })['catch'](function (e) {
                priv.enable($(req.source));
                if (typeof req.callbacks['catch'] !== 'function') {
                    instance.handleError(e, req);
                }
                // handle polling even if there was an error
                instance.handlePolling(req);
            }).then(req.callbacks.then, req.callbacks['catch']);
        },

        injectContent: function injectContent(request, response) {
            var id, target, transition, $node, result, root, handled;

            // ensure any loose calls to jx.in are ignored
            instance['in'] = null;

            var swapPanel = function swapPanel(panel, root) {
                root = root || document;
                var node = $(panel);
                // match up with panels on the page
                id = priv.attr(node, 'panel');
                target = request.target || $(root).find(jx.select.panel(id)).first();

                if (target.length) {

                    transition = priv.resolveTransition(request, node);
                    priv.callOut(target);
                    // swap out the content
                    result = transition(target, node);
                    // perform post-inject chores
                    instance.postInject(result, node, request);
                }
            };

            if (request.target) {
                // inject the entire response into the specified target
                swapPanel($(response));
            } else {
                // create a list of nodes from the response
                var nodes = $.parseHTML(response, true);

                if (!nodes) return;

                for (var i = 0; i < nodes.length; i++) {
                    $node = $(nodes[i]);

                    root = document;

                    priv.triggerEvent(jx.events.beforeInject, nodes, $node);

                    // check for a handler module
                    handled = this.checkForModule($node, request);

                    if (handled) {
                        continue;
                    }

                    // find all the panels in the new content
                    if (request.target || $node.is(priv.attrSelector('panel'))) {
                        swapPanel($node, root);
                    } else {
                        // iterate through the panels
                        $(nodes[i]).find(priv.attrSelector('panel')).each(function () {
                            swapPanel(this, root);
                        });
                    }
                }

                // process any loose script or style nodes
                instance.div.empty();
                nodes.forEach(function (node) {
                    $node = $(node);
                    if ($node.is('script,style')) {
                        instance.div.append($node);
                    }
                });
            }
        },

        checkForModule: function checkForModule(node, request) {
            var module;
            for (var i = 0; i < jx.modules.length; i++) {
                if (jx.modules[i](node, request)) {
                    return true;
                }
            }
            return false;
        },

        // an AJAX alternative to iframes
        loadSrc: function loadSrc(root) {
            root = root || document;
            $(root).find(jx.select.src).each(function () {
                var $this = $(this);
                var url = priv.attr($this, 'src');
                var config = priv.getConfig($this);
                config.action = priv.noCache(config.src);
                config.method = config.method || 'ajax-get';
                config.target = $this;
                config.transition = config.transition || 'empty-append-node';
                config.suppressEvents = true;
                instance.executeRequest(config);
            });
        },

        preloadAsync: function preloadAsync(root) {
            // do this after everything else
            setTimeout(function () {
                var config,
                    requests = [];
                root = root || document;
                // find elements that are supposed to be pre-loaded
                $(root).find(jx.select.preload).each(function () {
                    config = priv.getConfig(this);
                    config.method = config.method || 'ajax-get';
                    config.suppressEvents = true;
                    requests.push(config);
                });
                if (requests.length) {
                    jx.preload(requests);
                }
            });
        },

        handlePolling: function handlePolling(request) {
            // for polling to work, we must have a target and a numeric polling interval greater than 0
            if (!request.target || !$.isNumeric(request.poll) || request.poll <= 0) return;

            // and the target still has to exist on the page
            var target = $(request.target)[0];
            var exists = target.ownerDocument.body.contains(target);

            if (exists) {
                setTimeout(function () {
                    instance.executeRequest(request);
                }, request.poll * 1000);
            }
        },

        postInject: function postInject(context, source, request) {
            if (typeof instance.out == 'function') {
                $(context)[0].out = instance.out;
                instance.out = null;
            }
            priv.triggerEvent(jx.events.afterInject, context, source);
            priv.callIn(context, request);
            if (priv.hasValue(request)) {
                context.refresh = request.exec.bind(request);
            }
            instance.loadSrc(context);
            instance.preloadAsync(context);
        },

        handleError: function handleError(response, request) {
            priv.triggerEvent(jx.events.ajaxError, response);
            if (response.handled) return;
            // filter out authentication errors, those are usually handled by the browser
            if (response.status && /^(4\d\d|5\d\d)/.test(response.status) && /401|403|407/.test(response.status) == false) {
                if (!request || !request.suppressEvents) {
                    alert('An error occurred while processing your request.');
                }
                priv.error(response);
            }
        }

    });

    /***************\
    private functions
    \***************/

    $.extend(rexp, {
        search: /\?.+(?=#)|\?.+$/,
        hash: /#((.*)?[a-z]{2}\/[a-z]{2}(.*)?)/i,
        json: /^\{.*\}$|^\[.*\]$/,
        splitPath: /[^\[\]\.\s]+|\[\d+\]/g,
        indexer: /\[\d+\]/,
        quoted: /^['"].+['"]$/
    });

    $.extend(priv, {
        afterRequest: function afterRequest(arg, suppress) {
            if (!suppress) {
                priv.triggerEvent(jx.events.afterRequest, arg);
            }
        },
        attr: function attr(elem, name) {
            // use attr instead of data function to account for changing attribute values
            return $(elem).attr('data-' + name) || $(elem).attr(jx.config.prefix + name);
        },
        attributes: 'method action transition target form model preload src poll then catch'.split(' '),
        attrSelector: function attrSelector(name) {
            return '[data-' + name + '],[' + jx.config.prefix + name + ']';
        },
        beforeRequest: function beforeRequest(arg, suppress) {
            if (!suppress) priv.triggerEvent(jx.events.beforeRequest, arg);
        },
        beforeSubmit: function beforeSubmit(request) {
            // if the request source is a submit button and the method is 'post' or 'ajax-post', raise a submit event
            if (priv.hasValue(request.source) && $(request.source).is('[type=submit]') && /post/.test(request.method)) {
                priv.triggerEvent(jx.events.beforeSubmit, request);
            }
        },
        call: function call(fn, context, arg) {
            try {
                fn.call(context, arg);
            } catch (e) {
                jx.priv.error(e);
            }
        },
        callIn: function callIn(panel, context) {
            // ensure in is called only once
            // and that calls to jx.in outside of a container are ignored
            var fn = instance['in'];
            instance['in'] = null;
            if (panel && fn) {
                priv.call(fn, panel, context);
            }
        },
        callOut: function callOut(panel) {
            if (panel) {
                if (typeof panel[0].out == 'function') {
                    priv.call(panel[0].out, panel);
                    panel[0].out = null;
                } else {
                    var parent = panel.parent(jx.select.src);
                    if (parent.length && typeof parent[0].out == 'function') {
                        priv.call(parent[0].out, parent);
                        parent[0].out = null;
                    }
                }
            }
        },
        callFunctionArray: function callFunctionArray(functions, context, arg) {
            if (Array.isArray(functions)) {
                functions.forEach(function (fn) {
                    if (typeof fn === 'function') {
                        priv.call(fn, context, arg);
                    }
                });
            }
        },
        disable: function disable(elem, seconds) {
            if (!elem) {
                return;
            }
            $(elem).attr('disabled', 'disabled').addClass('disabled');
            if (typeof seconds == 'number' && seconds > 0) {
                setTimeout(function () {
                    priv.enable(elem);
                }, seconds * 1000);
            }
        },
        enable: function enable(elem) {
            $(elem).removeAttr('disabled').removeClass('disabled busy');
        },
        error: function error(e) {
            if (window.console != undefined && window.console.error != undefined) {
                console.error(e);
            }
        },
        formFromInputs: function formFromInputs(forms, action, method) {
            var $forms = $(forms);

            // if forms is a single form element, just use that instead of building a new one
            // this will come in handy for doing client-side validation
            // it also allows support for files
            if ($forms.is('form') && $forms.length == 1 && (action == '' || action == $forms.attr('action')) && (method == '' || method == $forms.attr('method'))) return $forms;

            // Trying to use jQuery's clone function here fails for select elements.
            // The clone function doesn't preserve select element values.
            // So copy everything manually instead.
            if ($forms.length) {
                action = action || window.location.href;
                method = method || 'POST';
                var form = $("<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>");
                var inputs = $forms.serializeArray();
                inputs.forEach(function (input) {
                    $("<input type='hidden' />").appendTo(form).prop('name', input.name).val(input.value);
                });
                return form;
            }
            return forms;
        },
        formFromModel: function formFromModel(model, method, action, rootName, form) {
            var t, i, props, name;

            if (!priv.hasValue(form)) {
                // first time through
                method = method || 'POST';
                action = action || window.location.href;
                form = $("<form method='" + method.toUpperCase() + "' action='" + action + "' style='display:none'></form>");
                rootName = '';
            }

            // this is a recursive function
            // so we have to detect the type on every iteration
            t = $.type(model);
            switch (t) {
                case 'null':
                case 'undefined':
                    $("<input type='hidden' />").appendTo(form).prop('name', rootName);
                    break;
                case 'date':
                    $("<input type='hidden' />").appendTo(form).prop('name', rootName).val(model.toISOString());
                    break;
                case 'array':
                    model.forEach(function (item) {
                        priv.formFromModel(item, method, action, rootName, form);
                    });
                    break;
                case 'object':
                    props = Object.getOwnPropertyNames(model);
                    props.forEach(function (prop) {
                        name = rootName === '' ? prop : rootName + '.' + prop;
                        priv.formFromModel(model[prop], method, action, name, form);
                    });
                    break;
                default:
                    $("<input type='hidden' />").appendTo(form).prop('name', rootName).val(model.toString());
            }
            return form;
        },
        getConfig: function getConfig(elem) {
            var name,
                config,
                $this = $(elem);

            if ($this.is(priv.attrSelector('request'))) {
                config = JSON.parse(priv.attr($this, 'request').replace(/'/g, '"'));
            } else {
                // don't use the data() function to retrieve request configurations
                // if attributes are changed, the data function won't pick it up
                config = {};

                priv.attributes.forEach(function (attr) {
                    var val = priv.attr($this, attr);
                    if (val !== undefined) {
                        config[attr] = val;
                    }
                });
            }

            config.source = elem;

            return config;
        },
        getFormData: function getFormData(forms) {
            var fd = new FormData();

            // use serializeArray to get the successful form elements
            $(forms).serializeArray().forEach(function (item) {
                fd.append(item.name, item.value);
            });

            // serializeArray doesn't include files
            $(forms).find('[type=file]').each(function () {
                if (this.files.length) {
                    fd.append(this.name, this.files[0]);
                }
            });

            return fd;
        },
        getFunctionAtPath: function getFunctionAtPath(path, root) {
            if (!path || typeof path === 'function') {
                return path;
            }

            path = Array.isArray(path) ? path : path.match(rexp.splitPath);

            if (path[0] === 'window') path = path.splice(1);

            // o is our placeholder
            var o = root || window,
                segment;

            for (var i = 0; i < path.length; i++) {
                // is this segment an array index?
                segment = path[i];
                if (rexp.indexer.test(segment)) {
                    // convert to int
                    segment = parseInt(/\d+/.exec(segment));
                } else if (rexp.quoted.test(segment)) {
                    segment = segment.slice(1, -1);
                }

                o = o[segment];

                if (o === undefined) return;
            }

            return o;
        },
        getModel: function getModel(elem) {
            var $elem = $(elem);
            var model = $elem.data('model');
            if (!priv.hasValue(model) && $(elem).is(jx.select.jxModelAttribute)) {
                model = $elem.attr(jx.select.jxModel);

                if (!model) return null;

                if (priv.isJSON(model)) {
                    model = JSON.parse(model);
                } else {
                    // it's a URL, create a new request
                    model = new jx.Request({
                        action: model,
                        method: 'ajax-get'
                    });
                }
                // store model in jQuery's data object
                // reference it there from now on
                $elem.data('model', model);
            }
            return model;
        },
        hasHash: function hasHash(url) {
            url = url || window.location.href;
            return rexp.hash.test(url);
        },
        hasValue: function hasValue(val) {
            return val !== undefined && val !== null;
        },
        isJSON: function isJSON(str) {
            return rexp.json.test(str);
        },
        noCache: function noCache(url) {
            var a = (url.indexOf('?') != -1 ? '&_=' : '?_=') + priv.nonce++;
            var s = url.match(/\?.+(?=#)|\?.+$|.+(?=#)|.+/);
            return url.replace(s, s + a);
        },
        nonce: jQuery.now(),
        resolveAction: function resolveAction(obj) {
            var action;
            // if there's an action in the obj, return it
            if (priv.hasValue(obj.action) && obj.action.length) {
                action = obj.action;
            }
            // check for a valid href
            else if (priv.hasValue(obj.source) && priv.hasValue(obj.source.href) && obj.source.href.length && obj.source.href.substr(0, 11) !== 'javascript:') {
                    action = obj.source.href;
                }
                // if this is a submit button check for a form
                else if ($(obj.source).is('[type=submit]')) {
                        var closest = $(obj.source).closest('form,' + priv.attrSelector('model'));
                        // is submit button inside a form?
                        if (closest.is('form')) {
                            // post to form.action or current page
                            action = closest.attr('action') || window.location.href;
                        }
                    }
                    // if this is a form use form.action or current page
                    else if ($(obj.source).is('form')) {
                            action = $(obj.source).attr('action') || window.location.href;
                        }
                        // if obj.form is a form with an action
                        else if ($(obj.form).is('form[action]')) {
                                action = $(obj.form).attr('action') || window.location.href;
                            }

            if (jx.config.navHistory && obj.method === 'ajax-get' && priv.hasHash(action)) {
                action = priv.resolveHash(action);
                obj.isNavHistory = true;
            }

            return action;
        },
        resolveForm: function resolveForm(params) {
            var closest, $form;
            // use the jQuery selector if present
            if (priv.hasValue(params.form)) {
                $form = $(params.form);

                if ($form.is('form') && $form.length == 1) return $form;

                // account for selectors that either select a top element with inputs inside (e.g. 'form')
                // or that select specific input elements (e.g. '#div1 [name]')
                // or both (e.g. 'form,#div1 [name]')
                return $form.find(':input').add($form.filter(':input'));
            }
            // only a submit button can submit an enclosing form
            if ($(params.source).is('[type=submit]')) {
                closest = $(params.source).closest('form,' + jx.select.model);
                if (closest.is('form')) {
                    return closest;
                }
            }
            // check for a form or a single named input with a trigger
            if ($(params.source).is('form') || $(params.source).is(jx.select.inputTriggerChangeOrEnter)) {
                return params.source;
            }
            return null;
        },
        resolveHash: function resolveHash(url) {
            url = url || window.location.href;
            if (priv.hasHash(url)) {
                return url.substr(url.indexOf('#') + 1);
            }
            return url;
        },
        resolveModel: function resolveModel(params) {
            var closest, model;
            if (priv.hasValue(params.model)) {
                model = params.model;
            } else if (priv.hasValue(params.source) && $(params.source).is(jx.select.model)) {
                model = priv.getModel(params.source);
            }
            // only a submit button can submit an enclosing model
            else if ($(params.source).is('input[type=submit],button[type=submit]')) {
                    // don't return anything if closest is form
                    closest = $(params.source).closest('form,' + jx.select.model);
                    if (closest.is(jx.select.model)) {
                        model = priv.getModel(closest);
                    }
                }

            if (typeof model === 'string' && model.length) {
                if (priv.isJSON(model)) {
                    model = JSON.parse(model);
                } else {
                    // it's a URL, create a new request
                    model = new jx.Request({
                        action: model,
                        method: 'ajax-get'
                    });
                }
            }

            if (params.source && model) {
                // store model in jQuery's data object
                // reference it there from now on
                $(params.source).data('model', model);
            }

            return model;
        },
        resolvePoll: function resolvePoll(params) {
            if ($.isNumeric(params.poll)) {
                return parseInt(params.poll);
            }
        },
        resolveTarget: function resolveTarget(params) {
            if (priv.hasValue(params.target)) {
                return $(params.target);
            }
            return null;
        },
        resolveTransition: function resolveTransition(request, target) {
            // check for a transition in the request first
            if (request.transition) {
                return jx.Transitions[request.transition] || jx.Transitions[jx.config.transition];
            } else {
                // check for a transition on the target
                return jx.Transitions[priv.attr(target, 'transition')] || jx.Transitions[jx.config.transition];
            }
        },
        standardDateFormat: function standardDateFormat(date) {
            if (!priv.hasValue(date) || date == '') return date;
            if (typeof date === 'string') {
                return date.substring(0, 10);
            }
            var m = date.getMonth() + 1;
            var d = date.getDate();
            return [date.getFullYear(), ('0' + m).slice(-2), ('0' + d).slice(-2)].join('-');
        },
        triggerEvent: function triggerEvent(name, arg, src) {
            try {
                $.event.trigger({
                    type: name,
                    source: src || arg
                }, arg);
            } catch (ex) {
                priv.error(ex);
            }
        }

    });

    /***********\
       Request
    \***********/

    jx.Request = function (obj) {

        if (typeof obj === 'function') {
            obj = obj();
        }
        if (typeof obj === 'string') {
            obj = {
                action: obj,
                method: 'ajax-get'
            };
        }

        this.method = obj.method.toLowerCase();
        this.form = priv.resolveForm(obj);
        this.action = priv.resolveAction(obj);
        this.isNavHistory = obj.isNavHistory;
        this.model = priv.resolveModel(obj);
        this.contentType = obj.contentType || 'application/x-www-form-urlencoded; charset=UTF-8';
        this.transition = obj.transition;
        this.target = priv.resolveTarget(obj);
        this.poll = priv.resolvePoll(obj);
        this.processData = true;
        this.data = this.getData(obj);
        this.source = obj.source;
        this.preload = 'preload' in obj;
        this.eventType = obj.eventType;
        this.cancel = false;
        this.resolve = [];
        this.reject = [];
        // set result and error in case we are recycling a cached request
        this.result = obj.result || null;
        this.error = obj.rerror || null;
        this.suppressEvents = obj.suppressEvents || false;
        this.callbacks = {
            then: priv.getFunctionAtPath(obj.then),
            'catch': priv.getFunctionAtPath(obj['catch'])
        };
        this.before = priv.getFunctionAtPath(obj.before);
    };

    jx.Request.prototype = {

        getData: function getData() {
            switch (this.method) {
                case 'get':
                case 'ajax-get':
                case 'ajax-delete':
                case 'jsonp':
                    // convert model to form, serialize form
                    // currently the api doesn't provide a way to specify a model
                    if (this.model) {
                        return priv.formFromModel(this.model).serialize();
                    } else if (this.form) {
                        return $(this.form).serialize();
                    }
                    break;
                case 'post':
                case 'put':
                    // convert model to form and submit
                    if (this.model) {
                        return priv.formFromModel(this.model);
                    } else if (this.form) {
                        return priv.formFromInputs(this.form, this.action, this.method);
                    } else {
                        // post and put require a form, it's the only way we can do a post or put from JS
                        return $("<form method='" + this.method.toUpperCase() + "' action='" + this.action + "' style='display:none'></form>");
                    }
                    break;
                case 'ajax-post':
                case 'ajax-put':
                    // serialize form, JSON.stringify model and change content-type to application/json
                    if (this.model) {
                        return JSON.stringify(this.model);
                        this.contentType = 'application/json';
                    } else if (this.form) {
                        if (window.FormData) {
                            // prevent jQuery from converting this into a string
                            this.processData = false;
                            this.contentType = false;
                            return priv.getFormData(this.form);
                        } else {
                            return $(this.form).serialize();
                        }
                    }
                    break;
            }
            return null;
        },
        getFullUrl: function getFullUrl() {
            if (/^(get|ajax-get|ajax-delete|jsonp)$/.test(this.method)) {
                return this.action + (this.data ? '?' + this.data : '');
            }
            return this.action;
        },
        ajax: function ajax(type) {
            var self = this;
            $.ajax({
                url: this.action,
                type: type,
                data: this.data,
                contentType: this.contentType,
                processData: this.processData
            }).done(self.done.bind(self)).fail(self.fail.bind(self));
        },
        done: function done(response) {
            this.result = response;
            priv.callFunctionArray(this.resolve, this, response);
            priv.afterRequest(this, this.suppressEvents);
        },
        fail: function fail(error) {
            this.error = error;
            priv.callFunctionArray(this.reject, this, error);
            priv.afterRequest(this, this.suppressEvents);
        },
        methods: {
            get: function get() {
                window.location = this.getFullUrl();
                priv.afterRequest(this, this.suppressEvents);
            },
            post: function post() {
                var self = this;
                var form = this.data;
                form.appendTo('body');
                form[0].submit();
                // in the case of downloading a file, the page is not refreshed
                // so we still need to clean up after ourselves
                setTimeout(function () {
                    form.remove();
                    priv.afterRequest(self, self.suppressEvents);
                }, 0);
            },
            put: function put() {
                var self = this;
                var form = this.data;
                form.appendTo('body');
                form[0].submit();
                // in the case of downloading a file, the page is not refreshed
                // so we still need to clean up after ourselves
                setTimeout(function () {
                    form.remove();
                    priv.afterRequest(self, self.suppressEvents);
                }, 0);
            },
            'ajax-get': function ajaxGet() {
                $.get(this.action, this.data).done(this.done.bind(this)).fail(this.fail.bind(this));
            },
            'ajax-post': function ajaxPost() {
                this.ajax('POST');
            },
            'ajax-put': function ajaxPut() {
                this.ajax('PUT');
            },
            'ajax-delete': function ajaxDelete() {
                this.ajax('DELETE');
            },
            jsonp: function jsonp() {
                var self = this;
                var s = document.createElement('script');
                s.type = 'text/javascript';
                s.src = this.getFullUrl();
                document.body.appendChild(s);
                setTimeout(function () {
                    document.body.removeChild(s);
                    // we have no way of handling the response of JSONP
                    // but trigger the event anyway
                    priv.afterRequest(self, self.suppressEvents);
                }, 10);
            }
        },

        exec: function exec() {
            var cancel = false;
            this.reset();

            if (!priv.hasValue(this.methods[this.method])) throw 'Unsupported method: ' + this.method;

            if (priv.hasValue(this.action) && this.action !== '') {
                if (typeof this.before === 'function') {
                    priv.call(this.before, this, this);
                    if (this.cancel) return;
                }
                // don't trigger any events for beforeSubmit
                // it's typically used as a validation hook
                // if validation fails we want lojax to take no action at all
                priv.beforeSubmit(this);
                if (this.cancel) return;
                priv.beforeRequest(this, this.suppressEvents);
                if (!this.cancel) {
                    // execute the method function
                    this.methods[this.method].bind(this)();
                } else {
                    // always trigger afterRequest even if there was no request
                    // it's typically used to turn off progress bars
                    priv.afterRequest(this, this.suppressEvents);
                }
            }

            return this;
        },

        // fake promise
        then: function then(resolve, reject) {
            if (typeof resolve === 'function') {
                this.resolve.push(resolve);
                if (this.result !== null) {
                    // the response came before calling this function
                    priv.call(resolve, this, this.result);
                }
            }
            if (typeof reject === 'function') {
                this.reject.push(reject);
                if (this.error !== null) {
                    // the response came before calling this function
                    priv.call(reject, this, this.error);
                }
            }
            return this;
        },

        // fake promise
        'catch': function _catch(reject) {
            return this.then(undefined, reject);
        },

        reset: function reset() {
            this.result = null;
            this.error = null;
            this.cancel = false;
            this.resolve = [];
            this.reject = [];
        }

    };

    /***********\
     Transitions
    \***********/

    $.extend(jx.Transitions, {

        'empty-append-node': function emptyAppendNode(oldNode, newNode) {
            var $old = $(oldNode),
                $new = $(newNode);
            $old.empty().append($new);
            return $old;
        },
        'empty-append-children': function emptyAppendChildren(oldNode, newNode) {
            var $old = $(oldNode),
                $new = $(newNode);
            $old.empty().append($new.contents());
            return $old;
        },
        'append-node': function appendNode(oldNode, newNode) {
            var $old = $(oldNode),
                $new = $(newNode);
            $old.append($new);
            return $new;
        },
        'prepend-node': function prependNode(oldNode, newNode) {
            var $old = $(oldNode),
                $new = $(newNode);
            $old.prepend($new);
            return $new;
        },
        'fade-in': function fadeIn(oldNode, newNode) {
            var $old = $(oldNode),
                $new = $(newNode);
            $old.fadeOut(0).empty().append($new.contents()).fadeIn();
            return $old;
        },
        'replace': function replace(oldNode, newNode) {
            // completely replace old node with new node
            var $old = $(oldNode),
                $new = $(newNode);
            $old.replaceWith($new);
            return $new;
        }

    });

    /****************\
     Bootstrap modal 
    \****************/

    (function () {

        var bsModal = null;

        var module = {
            canHandle: function canHandle($node, request) {
                // don't create more than one modal at a time
                if ($.fn.modal && $node.is('.modal') && bsModal == null) {
                    module.createModal($node, request);
                    return true;
                }
                return false;
            },
            createModal: function createModal(content) {
                bsModal = $(content).appendTo('body').modal({
                    show: true,
                    keyboard: true
                });
                bsModal.one('hidden.bs.modal', function () {
                    if (priv.hasValue(bsModal)) {
                        $(bsModal).remove();
                        bsModal = null;
                    }
                });
                lojax.Controller.postInject(bsModal, content, request);
            }
        };

        // add API functions
        jx.createModal = function (content) {
            jx.closeModal();
            bsModal = $(content).modal({
                show: true,
                keyboard: true
            });
            bsModal.on('hidden.bs.modal', function () {
                if (priv.hasValue(bsModal)) {
                    bsModal.off('hidden.bs.modal', instance.onModalClose);
                    bsModal = null;
                }
            });
        };

        jx.closeModal = function (onModalClose) {
            if (priv.hasValue(bsModal)) {
                if ($.fn.modal) {
                    if (typeof onModalClose == 'function') {
                        bsModal.one('hidden.bs.modal', onModalClose);
                    }
                    bsModal.modal('hide');
                }
                // don't set bsModal to null here or the close handlers in controller won't fire
            }
        };

        // register
        jx.registerModule(module.canHandle);
    })();

    /***********\
      modeling
    \***********/

    // bind an element to a JSON model
    jx.bind = function (elem, model) {
        var $elem = $(elem);
        $elem.data('model', model);
        priv.setElementsFromModel($elem, model);
        // jx listens for changes from elements that have a jx-model or data-model attribute
        // so if it doesn't have one, add one
        if (!$elem.is(jx.select.model)) {
            $elem.attr(jx.select.jxModel, "");
        }
        return model;
    };

    jx.bindAllModels = function (context) {
        modeler.bindToModels(null, context);
    };

    $.extend(rexp, {
        segments: /[^\[\]\.\s]+|\[\d+\]/g,
        indexer: /\[\d+\]/
    });

    var modeler = {

        init: function init() {
            modeler.bindToModels();
            $(document).off('change', jx.select.model, modeler.updateModel).off(jx.events.afterInject, modeler.bindToModels);
            $(document).on('change', jx.select.model, modeler.updateModel).on(jx.events.afterInject, modeler.bindToModels);
        },
        bindToModels: function bindToModels(evt, context) {
            context = context || document;
            var $this,
                model,
                models = [];
            var dataModels = $(context).find(jx.select.model).add(context).filter(jx.select.model);

            // iterate over the models in context
            dataModels.each(function () {
                $this = $(this);
                // grab the data-model
                model = priv.getModel($this);
                if (!priv.hasValue(model) || model === '') {
                    // empty model, so create one from its inputs
                    model = priv.buildModelFromElements($this);
                } else {
                    priv.setElementsFromModel($this, model);
                }
                $this.data('model', model);
            });
        },

        updateModel: function updateModel(evt) {
            var name = evt.target.name;
            if (!priv.hasValue(name) || name == '') return;
            // model's change handler
            // provides simple one-way binding from HTML elements to a model
            // 'this' is the element with jx-model attribute
            var $this = $(this);
            // $target is the element that triggered the change event
            var $target = $(evt.target);
            var model = priv.getModel($this);
            var elems = $this.find('[name="' + name + '"]');

            var o = {
                target: evt.target,
                name: name,
                value: $target.val(),
                model: model,
                cancel: false
            };

            priv.triggerEvent(jx.events.beforeUpdateModel, o, $this);
            if (o.cancel) return;

            priv.setModelProperty($this, o.model, elems);
            priv.triggerEvent(jx.events.afterUpdateModel, o, $this);

            priv.propagateChange(model, $target);
        }
    };

    $.extend(jx.priv, {

        getPathSegments: function getPathSegments(path) {
            return path.match(rexp.segments);
        },
        resolvePathSegment: function resolvePathSegment(segment) {
            // is this segment an array index?
            if (rexp.indexer.test(segment)) {
                return parseInt(/\d+/.exec(segment));
            }
            return segment;
        },
        getObjectAtPath: function getObjectAtPath(root, path, forceArray) {
            // o is our placeholder
            var o = root,
                segment,
                paths = Array.isArray(path) ? path : priv.getPathSegments(path);

            for (var i = 0; i < paths.length; i++) {
                segment = priv.resolvePathSegment(paths[i]);

                // don't overwrite previously defined properties
                if (o[segment] === undefined) {
                    // if it's not the last one, we need to look ahead to see if this is supposed to be an array
                    if (i < paths.length - 1 && rexp.indexer.test(paths[i + 1])) {
                        o[segment] = [];
                    } else if (i === paths.length - 1 && forceArray) {
                        // forceArray is for arrays of varying length (list of checkboxes)
                        o[segment] = [];
                    } else if (i < paths.length - 1) {
                        // if it's not the last one, create an object for the next iteration
                        o[segment] = {};
                    } else {
                        // last one, set to null
                        o[segment] = null;
                    }
                }

                // 3 possibilities:
                // 1: last segment is a property name
                // 2: last segment is an array index
                // 3: last segment is an array

                // we don't want to return the first two
                // so if this is the last one and it's a property name or array index then return early
                // else keep going
                if (i === paths.length - 1 && (rexp.indexer.test(segment) || Array.isArray(o[segment]) === false)) {
                    return o;
                }

                o = o[segment];
            }

            return o;
        },
        setModelProperty: function setModelProperty(context, model, elems) {
            var obj, prop, type, val, segments;

            // derive an object path from the input name
            segments = priv.getPathSegments($(elems).attr('name'));

            // get the raw value
            val = priv.getValue(elems);

            // grab the object we're setting
            obj = priv.getObjectAtPath(model, segments, Array.isArray(val));

            // grab the object property
            prop = priv.resolvePathSegment(segments[segments.length - 1]);

            // attempt to resolve the data type in the model
            // if we can't get a type from the model
            // rely on the server to resolve it
            if (prop in obj) {
                type = $.type(obj[prop]);
            } else if (Array.isArray(obj) && obj.length) {
                type = $.type(obj[0]);
            }

            // cast the raw value to the appropriate type
            val = priv.castValues(val, type);

            if (Array.isArray(val) && Array.isArray(obj)) {
                // preserve the object reference in case it's referenced elsewhere
                // clear out the array and repopulate it
                obj.splice(0, obj.length);
                val.forEach(function (v) {
                    obj.push(v);
                });
            } else {
                obj[prop] = val;
            }
        },
        buildModelFromElements: function buildModelFromElements(context) {
            var model = {};

            // there may be multiple elements with the same name
            // so build a dictionary of names and elements
            var names = {};
            var elems = $(context).find('[name]');
            elems.each(function () {
                var name = $(this).attr('name');
                if (!(name in names)) {
                    names[name] = $(context).find('[name="' + name + '"]');
                }
            });

            Object.getOwnPropertyNames(names).forEach(function (name) {
                priv.setModelProperty(context, model, names[name]);
            });

            return model;
        },
        setElementsFromModel: function setElementsFromModel(context, model) {
            var value,
                type,
                name,
                $this = $(context);

            // set the inputs to the model
            $this.find('[name]').each(function () {
                name = this.name || $(this).attr('name');
                value = priv.getModelValue(model, name);
                type = $.type(value);
                // jx assumes ISO 8601 date serialization format
                // ISO 8601 is easy to parse
                // making it possible to skip the problem of converting
                // date strings to Date objects and back again in most cases
                if (type === 'date' && this.type === 'date') {
                    // date inputs expect yyyy-MM-dd
                    // keep in mind that some browsers (e.g. IE9) don't support the date input type
                    $(this).val(priv.standardDateFormat(value));
                } else if (type === 'boolean' && this.type === 'checkbox') {
                    this.checked = value;
                } else if (this.type === 'radio') {
                    this.checked = this.value == value;
                } else if (this.value !== undefined) {
                    $(this).val(value);
                } else if (this.innerHTML !== undefined) {
                    $(this).html(value == null ? '' : value.toString());
                }
            });
        },
        getModelValue: function getModelValue(root, path) {
            var obj,
                segments = priv.getPathSegments(path),
                prop = priv.resolvePathSegment(segments[segments.length - 1]);

            try {
                obj = priv.getObjectAtPath(root, segments);
                if (obj[prop] !== undefined) return obj[prop];
                return obj;
            } catch (err) {
                priv.error('Could not resolve object path: ' + path);
                priv.error(err);
            }
        },
        getValue: function getValue(elems) {
            if (elems.length === 0) return null;
            var val;
            var type = elems[0].type;
            // it's supposed to be an array if they're all the same type and they're not radios
            var isArray = elems.length > 1 && type !== 'radio' && elems.filter('[type="' + type + '"]').length === elems.length;
            if (type === 'checkbox') {
                if (isArray) {
                    // this will only include checked boxes
                    val = elems.serializeArray().map(function (nv) {
                        return nv.value;
                    });
                } else {
                    // this returns the checkbox value, not whether it's checked
                    val = elems.val();
                    // check for boolean, otherwise return val if it's checked, null if not checked
                    if (val.toLowerCase() == 'true') val = elems[0].checked.toString();else if (val.toLowerCase() == 'false') val = (!elems[0].checked).toString();else val = elems[0].checked ? val : null;
                }
            } else if (type === 'radio') {
                val = elems.serializeArray()[0].value;
            } else {
                val = isArray ? elems.serializeArray().map(function (nv) {
                    return nv.value;
                }) : elems.val();
            }
            if (!isArray && val === '') return null;
            return val;
        },
        castValues: function castValues(val, type) {
            var isArray = Array.isArray(val);
            var arr = isArray ? val : [val];
            switch (type) {
                case 'number':
                    arr = arr.filter($.isNumeric).map(parseFloat);
                    break;
                case 'boolean':
                    arr = arr.map(function (v) {
                        return v.toLowerCase() == 'true';
                    });
                    break;
                case 'null':
                case 'undefined':
                    arr = arr.map(function (v) {
                        if (/true|false/i.test(v)) {
                            // assume boolean
                            return v.toLowerCase() === 'true';
                        }
                        return v === '' ? null : v;
                    });
                    break;
                default:
                    arr = arr.map(function (v) {
                        return v === '' ? null : v;
                    });
                    break;
            }
            return isArray ? arr : arr[0];
        },
        propagateChange: function propagateChange(model, elem) {
            var $e = $(elem);
            var closest = $e.closest(jx.select.model);
            // find elements that are bound to the same model
            $(document).find(jx.select.model).not(closest).each(function () {
                var m = $(this).data('model');
                if (m === model) {
                    priv.setElementsFromModel(this, model);
                }
            });
        }

    });

    $(modeler.init);

    jx.Controller.init();
})(jQuery, lojax);

