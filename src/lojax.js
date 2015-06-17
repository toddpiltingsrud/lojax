/*
TODO: 
- Handle files?
- rewrite formFromModel to recurse through arrays
*/

/*
Dependencies:
jquery
*/

// namespace
var jax = jax || {};

(function ($) {

    jax.Transitions = {

        'fade-in' : function(oldPanel, newPanel) {
            $(newPanel).fadeOut(0);
            $(oldPanel).fadeOut(0).replaceWith(newPanel);
            $(newPanel).fadeIn('slow');
        },
        'flip-horizontal': function(oldPanel, newPanel) {
            var parent = $(oldPanel).parent().addClass('flip-horizontal');
            $(oldPanel).addClass('front');
            $(newPanel).addClass('back').appendTo(parent);
            setTimeout(function(){
                parent.addClass('flip');
            }, 100);
            setTimeout(function(){
                $(oldPanel).remove();
                parent.removeClass('flip').removeClass('flip-horizontal');
                $(newPanel).removeClass('back');
            }, 1000);
        },
        'flip-vertical': function (oldPanel, newPanel) {
            var parent = oldPanel.parent().addClass('flip-vertical');
            oldPanel.addClass('front');
            $(newPanel).addClass('back').appendTo(parent);
            setTimeout(function () {
                parent.addClass('flip');
            }, 100);
            setTimeout(function () {
                oldPanel.remove();
                parent.removeClass('flip').removeClass('flip-vertical');
                $(newPanel).removeClass('back');
            }, 1000);
        }
    };

    jax.Gator = function () {
        var self = this;
        this.div = null;
        this.modal = null;
        this.handleError = function (response) {
            var error = [];
            Object.getOwnPropertyNames(response).forEach(function (name) {
                if (typeof response[name] !== 'function') {
                    error.push(response[name]);
                }
            });
            console.log(error);
            alert(error);
        };
        this.hashHandled = false;

        $(function () {
            self.div = $("<div style='display:none'></div>").appendTo('body');

            $(document).on('click', '[data-method]:not([data-trigger])', self.handleRequest);
            $(document).on('change', '[data-method][data-trigger=change]', self.handleRequest);
            $(document).on('submit', '[data-method][data-trigger=submit]', self.handleRequest);
            $(document).on('jsonp', function (evt, result) {
                priv.triggerAfterRequest(result);
            });

            window.addEventListener("hashchange", self.handleHash, false);

            self.handleHash();
        });
    };

    jax.Gator.prototype = {

        handleRequest: function (evt) {
            // 'this' will be the element that was clicked
            var params = $(this).data();
            params.source = this;
            var request = new jax.Request(params);
            if (request.action === null) return;
            request.exec()
                .then(function (response) {
                    instance.injectContent(request, response);
                })
                .catch(instance.handleError);
            // ignore hash changes to allow hashes into the navigation history
            if (request.action.indexOf('#') === -1) {
                evt.preventDefault();
            }
            else {
                instance.hashHandled = true;
            }
        },

        handleHash: function () {
            if (instance.hashHandled === true) {
                instance.hashHandled = false;
                return;
            }
            var hash = window.location.hash;
            // hash has to be longer than just '#'
            if (priv.hasValue(hash) && hash.length > 1) {
                // if there's an element declared with this action, use it's configuration
                // disallow post as a security measure
                var handler = $('[data-action="' + hash + '"][data-method="ajax-get"]')
                    .add('[href="' + hash + '"][data-method="ajax-get"]').first();
                if (handler.size() > 0) {
                    var params = $(handler).data();
                    params.source = handler[0];
                    var request = new jax.Request(params);
                    request
                        .exec()
                        .then(function (response) {
                            instance.injectContent(request, response);
                        })
                        .catch(instance.handleError);
                }
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
            // inject the content into the hidden div so we can query it
            instance.div.html(response);

            instance.triggerBeforeInject(instance.div);

            // check for modal
            if (instance.modal === null) {
                newModal = $(instance.div).find('.modal');
                if (newModal.size() > 0) {
                    instance.createModal(newModal);
                }
            }

            // find all the panels in the new content
            // iterate through the panels
            $(instance.div).find('[data-jaxpanel]').each(function () {
                // match up with panels on the page
                id = $(this).data('jaxpanel');
                target = $('[data-jaxpanel="' + id + '"]').not(this);
                if (target.size() > 0) {
                    transition = jax.Transitions[$(this).attr('data-transition') || 'fade-in'];
                    transition(target, this);
                    if (priv.hasValue(request)) {
                        this.refresh = request.exec.bind(request);
                    }
                    instance.loadAsyncContent(this);
                }
            });
        },

        createModal: function (content) {
            instance.modal = $(content).appendTo('body').modal({
                show: false,
                keyboard: true
            });
            instance.modal.on('hidden.bs.modal', instance.onModalClose);
            instance.loadAsyncContent(instance.modal);
            instance.modal.modal('show');
        },

        onModalClose: function () {
            if (priv.hasValue(instance.modal)) {
                instance.modal.off('hidden.bs.modal', instance.onModalClose);
                instance.modal.modal('hide');
                $(instance.modal).remove();
                instance.modal = null;
            }
        },

        loadAsyncContent: function (root) {
            root = root || document;
            $(root).find('div[data-src]').each(function () {
                var url = $(this).data('src');
                priv.triggerBeforeRequest({
                    action: url
                });
                $(this).load(url, function () {
                    priv.triggerAfterRequest({
                        action: url
                    });
                });
            });
        }

    };

    jax.Request = function (params) {
        this.method = params.method.toLowerCase();
        this.form = priv.resolveForm(params);
        this.action = priv.resolveAction(params);
        this.model = priv.resolveModel(params);
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
                queryString = $(this.form).serialize();
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
                form = priv.buildForm(this.form, this.action);
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
        formal: function (type) {
            var form = this.getForm(type);
            form.appendTo('body');
            form[0].submit();
            // in the case of downloading a file, the page is not refreshed
            // so we still need to clean up after ourselves
            setTimeout(function () {
                form.remove();
                priv.triggerAfterRequest(this);
            }, 0);
        },
        ajax: function (type) {
            var self = this;
            var search;
            if (priv.hasValue(this.model) && typeof this.model === 'object') {
                search = this.model;
            }
            else {
                search = this.getSearch();
            }
            $.ajax({
                url: this.action,
                type: type,
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
            'put': function () {
                this.formal('put');
            },
            'delete': function () {
                this.formal('delete');
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
                this.ajax('PUT');
            },
            'ajax-delete': function () {
                this.ajax('DELETE');
            },
            jsonp: function () {
                var self = this;
                var queryString = this.getSearch();
                var url = priv.checkHash(this.action);
                var s = document.createElement("script");
                s.type = "text/javascript";
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
                    this.methods[this.method].bind(this)();
                }
                else {
                    priv.triggerAfterRequest(this);
                }
            }
            return this;
        },

        then: function (resolve, reject) {
            if (priv.hasValue(resolve)) {
                this.resolve = resolve;
                if (this.result !== null) {
                    this.resolve(this.result);
                }
            }
            if (priv.hasValue(reject)) {
                this.reject = reject;
                if (this.error !== null) {
                    this.reject(this.error);
                }
            }
            return this;
        },

        catch: function (reject) {
            return this.then(undefined, reject);
        }
    };

    jax.on = function (event, params) {
        var request = new jax.Request(params);
        $(document).on(event, function () {
            request.exec()
                .then(function (response) {
                    instance.injectContent(request, response);
                })
                .catch(instance.handleError);
        });
        return request;
    };

    jax.off = function (event) {
        $(document).off(event);
    };

    // private functions
    var priv = {
        hasValue : function (val) {
            return typeof val !== 'undefined' && val !== null;
        },
        resolveForm : function (params) {
            var form;
            if (priv.hasValue(params.form)) {
                return $(params.form);
            }
            if (priv.hasValue(params.model)) {
                // if there's a model, don't search for a form
                return null;
            }
            form = $(params.source).closest('form');
            if (form.size() === 1) {
                return form;
            }
            return null;
        },
        resolveAction : function (params) {
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
        buildForm: function (forms, action, method) {
            if ($(forms).size() > 0) {
                method = method || 'post';
                var form = $("<form method='" + method + "' action='" + action + "' style='display:none'></form>");
                var inputs = $(forms).find(':input').serializeArray();
                if (inputs.length === 0) {
                    inputs = $(forms).filter(':input').serializeArray();
                }
                inputs.forEach(function (obj) {
                    $("<input type='hidden' name='" + obj.name + "' value='" + obj.value + "' />").appendTo(form);
                });
                return form;
            }
            return forms;
        },
        formFromModel: function (model, method, action, rootName, form) {
            if (!priv.hasValue(form)) {
                method = method || 'post';
                action = action || '';
                form = $("<form method='" + method + "' action='" + action + "' style='display:none'></form>");
                rootName = '';
            }

            if (priv.hasValue(model)) {
                // populate the form

                var names = Object.getOwnPropertyNames(model);

                names.forEach(function (name) {
                    if (Array.isArray(model[name])) {
                        model[name].forEach(function(val){
                            if (priv.hasValue(val) && val !== '') {
                                // add hidden input to form
                                $("<input type='hidden' name='" + rootName + name + "' value='" + val + "' />").appendTo(form);
                            }
                        });
                    }
                    else if (typeof model[name] === 'object') {
                        // recurse through child objects
                        priv.formFromModel(model[name], method, action, rootName + name + '.', form);
                    }
                    else if (typeof model[name] !== 'function' && model[name] !== null) {
                        // add hidden input to form
                        $("<input type='hidden' name='" + rootName + name + "' value='" + model[name].toString() + "' />").appendTo(form);
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
        }
    };

    // for testing
    jax.priv = priv;

    // global
    jax.instance = new jax.Gator();

    // local
    var instance = jax.instance;

})(jQuery);