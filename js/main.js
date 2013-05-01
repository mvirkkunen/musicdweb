"use strict";

window.musicd = {};

musicd.log = function() {
    if (console.log)
        console.log.apply(console, arguments);
};

$.request = $["\x61\x6a\x61\x78"]; // avoid the a-word
$["\x61\x6a\x61\x78Setup"]({
   xhrFields: { withCredentials: true},
   crossDomain: true
});

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

musicd.objectEquals = function(a, b) {
    if (!!a != !!b)
        return false;
        
    var key;
    for (key in a) {
        if (a[key] !== b[key])
            return false;
    }
    
    for (key in b) {
        if (a[key] !== b[key])
            return false;
    }
    
    return true;
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

musicd.authenticate = function(api) {
    var dialog = $("#authentication");
    if (dialog.is(":visible"))
        return;
        
    function auth(e) {
        e.preventDefault();
        
        dialog.find(".error").hide();
        
        var user = $(".user").val();
        
        api.authenticate(
            user,
            dialog.find(".password").val(),
            function() {
                dialog.off("click dblclick");
                dialog.find("form").off("submit");
                dialog.fadeOut();
                musicd.shader.hide();
                $("#server-status").fadeIn();
                $("#server-status .user").text(user);
            },
            function() {
                dialog.find(".error").slideDown();
                dialog.find(user ? ".password" : ".user").focus().select();
            }
        );
    }
    
    musicd.shader.show();
        
    dialog.on("click dblclick", musicd.stopPropagation);
    dialog.fadeIn()
    dialog.find(".error").hide();
    dialog.find("input[type=text]").eq(0).focus();
    dialog.find("form").on("submit", auth);
};

musicd.checkCompatibility = function() {
    var reasons = [];

    if (!(Array.prototype.forEach && window.JSON && window.localStorage))
        reasons.push("your browser doesn't seem to support modern JavaScript! Shame on you!");
    
    if (!window.Audio)
        reasons.push("your browser doesn't seem to support HTML5 Audio. Shame on you!");
    
    if (!new Audio().canPlayType("audio/mpeg"))
        reasons.push("your browser doesn't seem to support MP3. Vorbis support is on the TODO list!");
    
    if (reasons.length)
        $("#invalid-browser").show().find(".reason").text(reasons.join(", "));
};

musicd.loadQueryString = function(player, search) {
    var m = location.href.match(/#(.+)$/);
    if (m) {
        var initial = musicd.parseQueryString(m[1]);
        
        switch (initial.mode) {
            case "random":
                player.setPlayMode(musicd.Player.RANDOM);
                break;
            case "repeatlist":
                player.setPlayMode(musicd.Player.REPEAT_LIST);
                break;
            case "repeattrack":
                player.setPlayMode(musicd.Player.REPEAT_TRACK);
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
};

$(function() {
    musicd.checkCompatibility();
    
    musicd.api = new musicd.APIClient("/", musicd.authenticate);
    
    var player = new musicd.Player();
    ko.applyBindings(player, $("#player")[0]);

    var trackInfo = new musicd.TrackInfo(player.track);
    ko.applyBindings(trackInfo, $("#track-info")[0]);
    
    var search = new musicd.Search("#search", player);
    
    /*var albumBrowser = new musicd.AlbumBrowser("#album-browser", search);
    
    $(".buttons .albums").click(function(e) {
        e.stopPropagation();
        albumBrowser.open();
    });*/
    
    $("#server-status .log-out").click(function(e) {
        e.preventDefault();
        
        document.cookie = "user=; expires=Sat, 1 Jan 2000 00:00:00 GMT";
        document.cookie = "password=; expires=Sat, 1 Jan 2000 00:00:00 GMT";
        
        location.reload();
    });
    
    musicd.loadQueryString(player, search);
    
    // Below this line there be temporary hacks - beware!
    
    if (location.href.match(/[?&]albums\b/))
        albumBrowser.open();
    
    player.state.subscribe(function(state) {
        window.postMessage({
            type: "STATE_CHANGE",
            text: state == musicd.Player.PLAYING ? "play" : "pause"
        }, "*");
    });
    
    window.addEventListener("message", function(e) {
        if (e.data.type == "TOGGLE_PLAY")
            player.togglePlay();
    });
    
    $(".current-link").click(function(e) {
        e.preventDefault();
        
        var args = [];
        
        args.push("search=" + encodeURIComponent(search.getSearch()));
        
        if (player.track)
            args.push("trackid=" + player.track.id);
            
        if (player.playMode == musicd.Player.RANDOM)
            args.push("mode=random");
        else if (player.playMode == musicd.Player.REPEAT_LIST)
            args.push("mode=repeatlist");
        else if (player.playMode == musicd.Player.REPEAT_TRACK)
            args.push("mode=repeattrack");
        
        if (player.state == musicd.Player.PLAYING)
            args.push("autoplay");
        
        location.href = "#" + args.join("&");
    });
    
    $(".album-art").dblclick(function(e) {
        if (player.track)
            search.setSearch("albumid:" + player.track.albumid);
    });
});
