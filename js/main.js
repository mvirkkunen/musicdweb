"use strict";

window.musicd = {};

$.request = $["\x61\x6a\x61\x78"]; // avoid the a-word

$.fn.onmethod = function(type, selector, object, method, preventDefault) {
    return this.on(type, selector, function(e) {
        if (preventDefault)
            e.preventDefault();

        return object[method].call(object, e, this);
    });
};

$.fn.pinHeight = function() {
    return $(this).each(function() {
        $(this).css("height", $(this).height());
    });
};

$.fn.animateNaturalHeight = function(speed) {
    return $(this).each(function() {
        var currentHeight = $(this).height(),
            naturalHeight = $(this).css("height", "auto").height();
        
        $(this).height(currentHeight).animate({ height: naturalHeight }, speed);
    });
};

Number.prototype.pad = function(length) {
    var s = "" + this;
    while (s.length < length)
        s = "0" + s;
    
    return s;
};

musicd.formatTime = function(time, lengthHint) {
    if (!time)
        return "00:00";
    
    var s = (Math.floor((time % 3600) / 60).pad(2) + ":" +
        Math.floor(time % 60).pad(2));
    
    if ((lengthHint || time) >= 3600)
        s = Math.floor(time / 3600).pad(2) + ":" + s;
    
    return s;
}

musicd.Event = function Event() {
    
};

musicd.Event.prototype = {
    addListener: function(func) {
        if (!this._listeners)
            this._listeners = [];    
            
        this._listeners.push(func);
    },
    
    fire: function() {
        if (!this._listeners)
            return;
            
        var args = arguments;
        
        this._listeners.forEach(function(func) {
            func.apply(this, args);
        }, this);
    }
};

musicd.shader = {
    show: function() {
        $("#shader").fadeIn(200);
    },
    
    hide: function() {
        $("#shader").fadeOut(200);
    }
};

musicd.Session = function Session() {
    
}

musicd.Session.prototype = {
    getItem: function(key, defaultValue) {
        var val = localStorage.getItem(key);
        
        return (val !== undefined) ? val : defaultValue;
    },
    
    setItem: function(key, value) {
        localStorage.setItem(key, value);
    }
};

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
        
        console.log(r.method, JSON.stringify(r.args));
        //console.trace();

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
        if (xhr.status == 401) {
            this.authCallback(this);
        } else {
            if (xhr.getAllResponseHeaders())
                alert("API error");

            this.queue.shift();
    
            this.request = null;
            this.requestName = null;

            this._executeNext();
        }
    },

    authenticate: function(username, password, success, error) {
        $.request({
            type: "GET",
            url: this._urlPrefix + "login",
            args: {
                username: username,
                password: password
            },
            dataType: "json",
            success: function(res) {
                if (res.error) {
                    error(res.error);
                    return;
                }

                success();
                this._executeNext();
            },
            error: function(xhr) {
                alert("Auth fail (" + xhr.status + " " + xhr.statusText + ")");
            }
        }.bind(this))
    }
};

$(function() {
    musicd.api = new musicd.APIClient("http://lumpio.dy.fi:1337/");
    musicd.session = new musicd.Session();    
    
    var player = new musicd.Player("#player", "#track-info");
    
    var search = new musicd.Search("#search", player);
    
    player.onStateChange.addListener(function(state) {
        window.postMessage({
            type: "STATE_CHANGE",
            text: state == musicd.Player.PLAYING ? "play" : "pause"
        }, "*");
    });
    
    window.addEventListener("message", function(e) {
        if (e.data.type == "TOGGLE_PLAY")
            player.togglePlay();
    });
    
    var albumBrowser = new musicd.AlbumBrowser("#album-browser", search);
    
    $(".buttons .albums").click(function(e) {
        e.stopPropagation();
        albumBrowser.open();
    });
    
    if (location.href.match(/[?&]albums\b/))
        albumBrowser.open();
});
