"use strict";

(function() {

musicd.APIClient = function(url, authCallback) {
    this.authCallback = authCallback;
    this.queue = [];
    this._urlPrefix = url;
    this.request = null;
};

musicd.APIClient.prototype = {
    call: function(name, method, args, success) {
        if (name) {
            if (this.request && this.requestName && this.requestName == name)
                this.request.abort();

            this.queue = this.queue.filter(function(i) {
                return !(i.name && i.name === name);
            });
        }

        this.queue.push({
            name: name,
            method: method,
            args: args,
            success: success
        });

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
        
        if (window.console)
            console.log(r.method, JSON.stringify(r.args));

        this.request = $.request({
            type: "GET",
            url: this._urlPrefix + r.method,
            data: r.args,
            dataType: "json",
            success: this._requestSuccess.bind(this),
            error: this._requestError.bind(this)
        });
        this.requestName = r.name;
    },

    _requestSuccess: function(res) {
        var r = this.queue.shift();

        r.success(res);

        this.request = null;
        this.requestName = null;

        this._executeNext();
    },

    _requestError: function(xhr) {
        this.request = null;
        this.requestName = null;
        
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
