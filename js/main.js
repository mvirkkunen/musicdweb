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

var templateCache = {};

function collectIdElements(el, map) {
    var id = el.getAttribute("id") || el.getAttribute("data-id");
    
    if (!id) {
        var className = el.className;
        if (className) {
            var classBasedId = className.split(/ /)[0]
                .replace(/-([a-z])/g, function(m) { return m[1].toUpperCase(); })
            
            // Do not overwrite anything with class-based IDs
            if (!map[classBasedId])
                id = classBasedId;
        }
    }
    
    if (id)
        map[id] = $(el);
    
    var child;
    for (child = el.firstChild; child; child = child.nextSibling) {
        if (child.nodeType == Node.ELEMENT_NODE)
            collectIdElements(child, map);
    }
}

$.fn.elementMap = function(id) {
    var map = {};
    
    this.each(function() {
        collectIdElements(this, map);
    });
    
    return map;
};

$.template = function(id) {
    var el;
    
    if (!templateCache[id]) {
        el = $("#" + id);
        if (!el.length)
            throw new Error("Template '" + id + "' not found");
        
        templateCache[id] = el.html();
    }
    
    return $("<div>").html(templateCache[id]).find(">*");
};

$.fn.render = function(id) {
    return this.append($.template(id));
};

musicd.stopPropagation = function(e) {
    e.stopPropagation();
};

musicd.focusDefault = function() {
    if (musicd.defaultFocusElement
        && !musicd.defaultFocusElement.is(":focus"))
    {
        musicd.defaultFocusElement.focus();
    }
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

$(function() {
    var reasons = [];

    if (!(Array.prototype.forEach && window.JSON && window.localStorage))
        reasons.push("your browser doesn't seem to support modern JavaScript! Shame on you!");
    
    if (!window.Audio)
        reasons.push("your browser doesn't seem to support HTML5 Audio. Shame on you!");
    
    if (!new Audio().canPlayType("audio/mpeg"))
        reasons.push("your browser doesn't seem to support MP3. Vorbis support is on the TODO list!");
    
    if (reasons.length)
        $("#invalid-browser").show().find(".reason").text(reasons.join(", "));
    
    musicd.api = new musicd.APIClient("/", musicd.authenticate);
    
    var player = new musicd.Player("#player", "#track-info");
    
    var search = new musicd.Search("#search", player);
    
    var albumBrowser = new musicd.AlbumBrowser("#album-browser", search);
    
    $(".buttons .albums").click(function(e) {
        e.stopPropagation();
        albumBrowser.open();
    });
    
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
    
    $("#server-status .log-out").click(function(e) {
        e.preventDefault();
        
        document.cookie = "user=; expires=Sat, 1 Jan 2000 00:00:00 GMT";
        document.cookie = "password=; expires=Sat, 1 Jan 2000 00:00:00 GMT";
        
        location.reload();
    });
    
    // Below this line there be temporary hacks - beware!
    
    if (location.href.match(/[?&]albums\b/))
        albumBrowser.open();
    
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
