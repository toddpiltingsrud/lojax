/*
TODO: 
- Handle files?
- rewrite formFromModel to recurse through arrays
- refactor: diagram everything out and reorganize
- handle request timeouts
- raise an event on AJAX errors
- use MutationObserver to detect creation of async elements: div[data-src]
- provide a mechanism for pre-loading resources and caching them on the client
- implement dependency declarations
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
        this.cache = {};

        $(function () {
            self.div = $("<div style='display:none'></div>").appendTo('body');

            $(document).on('click', '[data-request],[jx-request]', self.handleRequest);
            $(document).on('click', '[data-method]:not([data-trigger]),[jx-method]:not([jx-trigger])', self.handleRequest);
            $(document).on('change', '[data-method][data-trigger*=change],[jx-method][jx-trigger*=change]', self.handleRequest);
            $(document).on('keydown', '[data-method][data-trigger*=enter],[jx-method][jx-trigger*=enter]', self.handleEnterKey);

            window.addEventListener("hashchange", self.handleHash, false);

            self.loadAsyncContent();

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

            instance.executeRequest(params);

            evt.stopPropagation();

            evt.preventDefault();
        },

        executeRequest: function (params) {
            var request = new jax.Request(params);
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

        getRequest: function (elem) {
            var params, $elem = $(elem);
            if ($elem.is('[data-request]')) {
                params = JSON.parse($elem.data('request').replace(/'/g, '"'));
            }
            else if ($elem.is('[jx-request]')) {
                params = JSON.parse($elem.attr('jx-request').replace(/'/g, '"'));
            }
            else {
                params = $elem.data();

            }
            params.source = elem;
            return new jax.Request(params);
        },

        handleEnterKey: function (evt) {
            if (evt.which == 13) {
                instance.handleRequest.call(this, evt);
            }
        },

        handleHash: function () {
            // grab the current hash and request it with ajax-get

            var handler, request, hash = window.location.hash;

            if (priv.hasHash()) {

                // If there's no anchor with this name, handle with default settings.
                // We want to support url-only access, and we don't want to clutter 
                // the url with request settings like transition and target. That 
                // means that there must be enough information already in the page 
                // or in the response to properly handle the response.
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

        // provides an opportunity to manipulate the content before it gets displayed to the user
        triggerBeforeInject: function (arg) {
            $.event.trigger({
                type: 'beforeInject',
                source: arg
            }, arg);
        },

        injectContent: function (request, response) {
            var id, target, newModal, transition;

            instance.triggerBeforeInject(instance.div);

            if (request.target) {
                transition = priv.resolveTransition(request, request.target);
                transition(request.target, response);
                request.target.refresh = request;
                instance.loadAsyncContent(request.target);
                return;
            }

            // inject the content into the hidden div so we can query it
            instance.div.html(response);

            // check for modal
            if (instance.modal === null && $(instance.div).find('.modal').size() > 0) {
                newModal = $(instance.div).find('.modal');
                instance.createModal(newModal);
            }

            // find all the panels in the new content
            // iterate through the panels
            $(instance.div).find('[data-jaxpanel]').each(function () {
                // match up with panels on the page
                id = $(this).data('jaxpanel');
                target = $('[data-jaxpanel="' + id + '"]').not(this);

                if (target.size() > 0) {
                    foundMatches = true;
                    transition = priv.resolveTransition(request, this);
                    transition(target, this);
                    if (priv.hasValue(request)) {
                        this.refresh = request.exec.bind(request);
                    }
                    instance.loadAsyncContent(this);
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
                var type = $(this).data('type');
                priv.triggerBeforeRequest({
                    action: url
                });
                $(this).load(url, function () {
                    priv.triggerAfterRequest({
                        action: url
                    });
                });
            });
        },

        handleError: function (response) {
            instance.triggerAjaxErrorEvents(response);
            if (response.handled) return;
            var error = [];
            Object.getOwnPropertyNames(response).forEach(function (name) {
                if (typeof response[name] !== 'function') {
                    error.push(response[name]);
                }
            });
            console.log(response);
            console.log(response.responseText);
        },

        triggerAjaxErrorEvents: function (err) {
            $.event.trigger({
                type: 'ajaxError',
                source: err
            }, err);
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
                priv.triggerAfterRequest(self);
            }, 0);
        },
        ajax: function (type) {
            var self = this;
            var search;
            if (priv.hasValue(this.model)) {
                search = this.model;
            }
            else {
                search = this.getSearch();
            }
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
            priv.triggerAfterRequest(this);
        },
        fail: function (error) {
            this.error = error;
            if (priv.hasValue(this.reject)) {
                this.reject(error);
            }
            priv.triggerAfterRequest(this);
        },
        methods: {
            get: function () {
                var queryString = this.getSearch();
                var url = priv.checkHash(this.action);
                window.location = url + '?' + queryString;
                priv.triggerAfterRequest(this);
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
                    priv.triggerAfterRequest(self);
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
                priv.triggerBeforeRequest(this);
                if (this.cancel == false) {
                    // execute the method function
                    this.methods[this.method].bind(this)();
                }
                else {
                    priv.triggerAfterRequest(this);
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
        },
        'fade-in': function (oldPanel, newPanel) {
            // text must be handled differently than HTML nodes
            children = $(newPanel).children();
            if (children.size() > 0) {
                oldPanel.fadeOut(0).empty().append(children).fadeIn();
            }
            else {
                oldPanel.fadeOut(0).empty().text($(newPanel).text()).fadeIn();
            }
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
        },
        'append': function (oldPanel, newPanel) {
            // useful for paging
            $(newPanel).children().fadeOut(0).appendTo(oldPanel).fadeIn('slow');
        },
        'prepend': function (oldPanel, newPanel) {
            // useful for adding new rows to tables, for example
            $(newPanel).fadeOut(0).prependTo(oldPanel).fadeIn('slow');
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

    // private functions
    var priv = {
        hasValue: function (val) {
            return typeof val !== 'undefined' && val !== null;
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
            if (form.size() === 1) {
                return form;
            }
            return null;
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

                var names = Object.getOwnPropertyNames(model);

                names.forEach(function (name) {
                    if (Array.isArray(model[name])) {
                        model[name].forEach(function (val) {
                            if (priv.hasValue(val) && val !== '') {
                                // add hidden input to form
                                $("<input type='hidden' />").appendTo(form).prop('name', rootName + name).val(val);
                            }
                        });
                    }
                    else if (typeof model[name] === 'object') {
                        // recurse through child objects
                        priv.formFromModel(model[name], method, action, rootName + name + '.', form);
                    }
                    else if (typeof model[name] !== 'function' && model[name] !== null) {
                        // add hidden input to form
                        $("<input type='hidden' />").appendTo(form).prop('name', rootName + name).val(model[name].toString());
                    }
                });
            }

            return form;
        },
        triggerBeforeRequest: function (arg) {
            $.event.trigger({
                type: 'beforeRequest',
                source: arg
            }, arg);
        },
        triggerAfterRequest: function (arg) {
            $.event.trigger({
                type: 'afterRequest',
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
        }
    };

    // for testing
    jax.priv = priv;

    // global
    jax.instance = new jax.Gator();

    // local
    var instance = jax.instance;

})(jQuery);