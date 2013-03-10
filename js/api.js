"use strict";

(function() {

musicd.APIClient = function(url, authCallback) {
    this.authCallback = authCallback;
    this.queue = [];
    this._urlPrefix = url;
    this.request = null;
};

function requestEquals(a, b) {
    return (a.name === b.name
        && a.method === b.method
        && musicd.objectEquals(a.args, b.args));
}

musicd.APIClient.prototype = {
    call: function(name, method, args, success) {
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
            success: success
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
    
    getTrackURL: function(track, seek) {
        var url = this._urlPrefix + "open?id=" + track.id;
        
        if (seek)
            url += "&seek=" + seek;
        
        return url;
    },
    
    getAlbumImageURL: function(albumId, size) {
        return this._urlPrefix + "album/image?id=" + albumId + "&size=" + size;
    },

    _executeNext: function() {
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
            success: this._requestSuccess.bind(this),
            error: this._requestError.bind(this)
        });
    },

    _requestSuccess: function(res) {
        var r = this.queue.shift();

        r.success(res);

        this.request = null;
        this.xhr = null;

        this._executeNext();
    },

    _requestError: function(xhr) {
        this.request = null;
        this.xhr = null;
        
        if (xhr.status == 403) {
            this.authCallback(this);
        } else {
            if (xhr.getAllResponseHeaders())
                alert("API error");

            this.queue.shift();

            this._executeNext();
        }
    },

    authenticate: function(user, password, success, error) {
        $.request({
            type: "GET",
            url: this._urlPrefix + "auth",
            data: {
                user: user,
                password: password
            },
            dataType: "json",
            success: function(res) {
                if (res.auth != "ok") {
                    error();
                    return;
                }

                success();
                this._executeNext();
            }.bind(this),
            error: function(xhr) {
                alert("Auth fail (" + xhr.status + " " + xhr.statusText + ")");
            }.bind(this)
        })
    }
};    

})();
