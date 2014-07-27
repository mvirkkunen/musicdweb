"use strict";

(function() {

musicd.APIClient = function(main, urlPrefix, authCallback) {
    this._main = main;
    this._urlPrefix = urlPrefix;
    this.authCallback = authCallback;
    this.queue = [];
    this.request = null;
    this.loading = ko.observable(false);
};

function requestEquals(a, b) {
    return (a.name === b.name
        && a.method === b.method
        && musicd.objectEquals(a.args, b.args));
}

musicd.APIClient.prototype = {
    call: function(name, method, args, success, error) {
        if (args) {
            var key;
            for (key in args) {
                if (args[key] === null)
                    delete args[key];
            }
        }

        var r = {
            name: name,
            method: method,
            args: args,
            success: success,
            error: error
        };

        if (name) {
            if (this.request && this.request.name === name) {
                if (requestEquals(this.request, r))
                    return;

                this.xhr.abort();
            }

            this.queue = this.queue.filter(function(i) {
                return !(i.name && i.name === name);
            });
        }

        this.queue.push(r);

        this._executeNext();
    },

    isAuthenticated: function(callback) {
        // TODO: Use a more sensible method to ping
        $.request({
            type: "GET",
            url: this._urlPrefix + "tracks?limit=1",
            dataType: "json",
            xhrFields: { withCredentials: true},
            success: function(r) { callback(true); },
            error: function(xhr) {
                if (xhr.status != 403)
                    alert("/musicd returned weird status");

                callback(false);
            }
        });
    },

    getTrackURL: function(track, seek) {
        var url = this._urlPrefix + "open?id=" + track.id;

        seek = Math.floor(seek);
        if (seek)
            url += "&seek=" + seek;

        return url;
    },

    getImageURL: function(albumId, size) {
        return this._urlPrefix + "image?id=" + albumId + (size ? "&size=" + size : "");
    },

    getAlbumImageURL: function(albumId, size) {
        return this._urlPrefix + "album/image?id=" + albumId + (size ? "&size=" + size : "");
    },

    _executeNext: function() {
        this.loading(!!this.queue.length);

        if (this.request || !this.queue.length)
            return;

        var r = this.queue[0];

        musicd.log(r.method, JSON.stringify(r.args));

        this.request = r;
        this.xhr = $.request({
            type: "GET",
            url: this._urlPrefix + r.method,
            data: r.args,
            dataType: "json",
            xhrFields: { withCredentials: true},
            success: this._requestSuccess.bind(this),
            error: this._requestError.bind(this)
        });
    },

    _requestSuccess: function(res) {
        var r = this.queue.shift();

        try {
            r.success(res);
        } catch (e) { musicd.log(e, e.stack); }

        this.request = null;
        this.xhr = null;

        this._executeNext();
    },

    _requestError: function(xhr) {
        var r = this.request;

        this.request = null;
        this.xhr = null;

        if (xhr.status == 403) {
            this.authCallback(this);
        } else {
            if (xhr.getAllResponseHeaders()) {
                var handled = false;

                try {
                    if (r.error)
                        handled = r.error();
                } catch (e) { musicd.log(e, e.stack); }

                if (!handled)
                    this._main.reportError("API error: " + xhr.status);
            }

            this.queue.shift();

            this._executeNext();
        }
    },

    authenticate: function(user, password, success, error) {
        var self = this;

        $.request({
            type: "GET",
            url: this._urlPrefix + "auth",
            data: {
                user: user,
                password: password
            },
            dataType: "json",
            xhrFields: { withCredentials: true},
            success: function(res) {
                if (res.auth != "ok") {
                    error();
                    return;
                }

                success();
                self._executeNext();
            },
            error: function(xhr) {
                self._main.reportError("API error in authenticate(): " + xhr.status);
            }
        })
    }
};

})();
