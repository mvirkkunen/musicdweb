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

musicd.parseQueryString = function(qs) {
    var r = {};
    
    qs.split(/&/).forEach(function(pair) {
        var p = pair.indexOf("=");
        if (p == -1)
            r[decodeURIComponent(pair)] = true;
        else
            r[decodeURIComponent(pair.substr(0, p))] = decodeURIComponent(pair.substr(p + 1));
    });
    
    return r;
};

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

$(function() {
    var reasons = [];
    
    if (!Array.prototype.forEach)
        reasons.push("your browser doesn't seem to support modern JavaScript! Shame on you!");
    
    if (!window.Audio)
        reasons.push("your browser doesn't seem to support HTML5 Audio. Shame on you!");
    
    if (!new Audio().canPlayType("audio/mpeg"))
        reasons.push("your browser doesn't seem to support MP3. Vorbis support is on the TODO list!");
    
    if (reasons.length)
        $("#invalid-browser").show().find(".reason").text(reasons.join(", "));
    
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
    
    var m = location.href.match(/#(.+)$/);
    if (m) {
        var initial = musicd.parseQueryString(m[1]);
        
        switch (initial.repeat) {
            case "list":
                player.setRepeatMode(musicd.Player.LIST);
                break;
            case "single":
                player.setRepeatMode(musicd.Player.SINGLE);
                break;
        }
        
        if (initial.search) {
            search.setSearch(initial.search, function() {
                if (initial.trackid) {
                    var track = search.getAdjacentTrack(parseInt(initial.trackid, 10), 0, function(track) {
                        if (track) {
                            player.setTrack(track);
                            
                            if (initial.autoplay)
                                player.play();
                        }
                    });
                }
            });
        }
    }
    
    $(".current-link").click(function(e) {
        e.preventDefault();
        
        var args = [];
        
        args.push("search=" + encodeURIComponent(search.getSearch()));
        
        if (player.track)
            args.push("trackid=" + player.track.id);
            
        if (player.repeatMode == musicd.Player.LIST)
            args.push("repeat=list");
        else if (player.repeatMode == musicd.Player.SINGLE)
            args.push("repeat=single");
        
        if (player.state == musicd.Player.PLAYING)
            args.push("autoplay");
        
        location.href = "#" + args.join("&");
    });
    
    $(".album-art").dblclick(function(e) {
        if (player.track)
            search.setSearch("albumid:" + player.track.albumid);
    });
});
