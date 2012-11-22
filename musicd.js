
(function($) {

$.request = $["\x61\x6a\x61\x78"]; // avoid the a-word

$.fn.onmethod = function(type, selector, object, method, preventDefault) {
    if (preventDefault) {
        this.on(type, selector, function(e) {
            e.preventDefault();

            return object[method].call(object, e);
        });
    } else {
        this.on(type, selector, object[method].bind(object));
    }
};

function APIClient(authCallback) {
    this.authCallback = authCallback;
    this.queue = [];
    //this.urlPrefix = "http://tsundere.fi:6804/";
    this.urlPrefix = "http://lumpio.dy.fi:1337/";
    this.request = null;
}

APIClient.prototype = {
    call: function(method, args, success) {
        this.queue.push({
            method: method,
            args: args,
            success: success
        });
        this._executeNext();
    },
    
    getTrackURL: function(track, seek) {
        var url = this.urlPrefix + "open?id=" + track.id;
        
        if (seek)
            url += "&seek=" + seek;
        
        return url;
    },

    _executeNext: function() {
        if (this.request || !this.queue.length)
            return;
        
        var r = this.queue[this.queue.length - 1];

        this.request = $.request({
            type: "GET",
            url: this.urlPrefix + r.method,
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
        this._executeNext();
    },

    _requestError: function(xhr) {
        if (xhr.status == 401) {
            this.authCallback(this);
        } else {
            alert("API error");
            this.request = null;

            this.queue.shift();
            this._executeNext();
        }
    },

    authenticate: function(username, password, success, error) {
        var self = this;

        $.request({
            type: "GET",
            url: this.urlPrefix + "login",
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
                self._executeNext();
            },
            error: function(xhr) {
                alert("Auth fail (" + xhr.status + " " + xhr.statusText + ")");
            }
        })
    }
};

Number.prototype.pad = function(length) {
    var s = "" + this;
    while (s.length < length)
        s = "0" + s;
    
    return s;
};

function formatTime(time, lengthHint) {
    if (!time)
        return "00:00";
    
    var s = (Math.floor((time % 3600) / 60).pad(2) + ":" +
        Math.floor(time % 60).pad(2));
    
    if ((lengthHint || time) >= 3600)
        s = Math.floor(time / 3600).pad(2) + ":" + s;
    
    return s;
}

var api = new APIClient(function() { });

var STOPPED = 0,
    PLAYING = 1,
    PAUSED = 2;

var Player = function(el, trackInfo) {
    this.el = $(el);
    this._trackInfo = $(trackInfo);
    
    this.audio = new Audio();
    window.debugaudio = this.audio;
    //this.audio.addEventListener("loadedmetadata", this._audioLoadedMetadata.bind(this), true);
    this.audio.addEventListener("timeupdate", this._audioTimeUpdate.bind(this), true);
    this.audio.addEventListener("ended", this._audioEnded.bind(this), true);
    
    var a = this.audio;
    setInterval(function() {
        var d = ("debög: "
            + " networkState: " + a.networkState
            + " seeking: " + a.seeking
            + " error: " + a.error);
        $("#debug").text(d);
    }, 1000);

    this.onaudioend = null;
    
    this.currentStart = 0;
    this.track = null;
    this.pendingSeek = null;

    this.state = STOPPED;

    this.el.onmethod("click", ".toggle-play", this, "togglePlay", true);
    this.el.onmethod("click", ".stop", this, "stop", true);
    this.el.onmethod("click", ".prev", this, "prev", true);
    this.el.onmethod("click", ".next", this, "next", true);
    
    this._seekSliderMouseDown = false;
    this._seekSlider = this.el.find(".seek").slider({
        animate: "fast",
        start: this._seekSliderStart.bind(this),
        stop: this._seekSliderStop.bind(this)
    });
    this._volSlider = this.el.find(".volume").slider({
        orientation: "vertical",
        min: 0,
        max: 100,
        value: 100,
        slide: this._volSliderChange.bind(this),
        stop: this._volSliderChange.bind(this)
    });
    this._currentTime = this.el.find(".current-time");
    
    this.stop();
    this._updateSeekable();
    this._updateCurrentTime();
};

Player.prototype = {
    _canSeek: function() {
        return !isNaN(this.audio.duration) && this.state != STOPPED;
    },

    //_audioLoadedMetadata: function() {
    //    this._updateSeekable();
    //},

    _audioTimeUpdate: function() {
        if (!this._seekSliderMouseDown)
            this._seekSlider.slider("option", "value", Math.floor(this.getCurrentTime()));
        
        this._updateCurrentTime();
    },

    _audioEnded: function() {
        if (this.onaudioend)
            this.onaudioend();
    },

    _seekSliderStart: function() {
        this._seekSliderMouseDown = true;
    },

    _seekSliderStop: function() {
        this._seekSliderMouseDown = false;

        var time = this._seekSlider.slider("value");

        this.seekTo(time);
    },
    
    _volSliderChange: function() {
        this.audio.volume = this._volSlider.slider("value") / 100;
    },

    _updateSeekable: function() {
        //var canSeek = !isNaN(this.audio.duration) && this.state != STOPPED;
        
        if (this.track) {
            this._seekSlider.slider("option", {
                disabled: false,
                min: 0,
                max: Math.floor(this.track.duration)
            });
        } else {
            this._seekSlider.slider("option", {
                disabled: true,
                min: 0,
                max: 0,
                value: 0
            });        
        }
    },
    
    getCurrentTime: function() {
        if (this.pendingSeek !== null)
            return this.pendingSeek;
        
        return this.currentStart + this.audio.currentTime;
    },
    
    _updateCurrentTime: function() {
        if (this.track) {
            this._currentTime.text(
                formatTime(this.getCurrentTime(), this.track.duration) + " / " +
                formatTime(this.track.duration));
        }
    },

    _setState: function(state) {
        if (this.state == state)
            return;

        if (state == PLAYING) {
            if (this.pendingSeek !== null) {
                this.audio.pause();
                this.audio.src = api.getTrackURL(this.track, this.pendingSeek);
                this.pendingSeek = null;
            }
            
            this.audio.play();
        } else {
            this.audio.pause();
        }
        
        $("#favicon").attr("href", "img/icon-" + ["stop", "play", "pause"][state] + ".png");

        this.state = state;
        
        if (state == STOPPED)
            this.seekTo(0);

        this.el.find(".toggle-play")
            .toggleClass("pause", this.state == PLAYING)
            .text(this.state == PLAYING ? "▮▮" : "▶");

        this._updateSeekable();
    },
    
    setTrack: function(track) {
        this.stop();
        
        var prevTrack = this.track;
        this.track = track;
        
        this.currentStart = 0;
        this.audio.src = api.getTrackURL(track);
        
        this._trackInfo.find(".track-name").toggle(!!track.title).find("span").text(track.title);
        this._trackInfo.find(".album").toggle(!!track.album).find("span").text(track.album);
        this._trackInfo.find(".artist").toggle(!!track.artist).find("span").text(track.artist);
        
        var names = [track.title, track.album, track.artist, "musicd"], title = "";
        names.forEach(function(n) {
            if (n) {
                if (title)
                    title += " :: ";
                
                title += n;
            }
        });
        
        document.title = title;
        
        if (!prevTrack || prevTrack.albumid != track.albumid) {
            var self = this;
            var albumArt = self._trackInfo.find(".album-art");
                img = new Image(),
                loadAlbumId = track.albumid,
                src = api.urlPrefix + "albumimg" + "?album=" + track.albumid + "&size=256";
                
            img.onload = function() {
                if (self.track && self.track.albumid && self.track.albumid == loadAlbumId) {
                    albumArt.queue(function(next) {
                       albumArt.attr("src", src).animate({opacity: 1}, 200); 
                       
                       next();
                    });
                }
            };
            albumArt.animate({opacity: 0}, 200);
            img.src = src;
        }
        
        this.play();
    },
    
    togglePlay: function() {
        this._setState(this.state == PLAYING ? PAUSED : PLAYING);
    },

    play: function() {
        this._setState(PLAYING);
    },

    stop: function() {
        this._setState(STOPPED);
    },

    prev: function() {
        
    },

    next: function() {
        
    },

    seekTo: function(seconds) {
        //this.audio.currentTime = seconds;
        
        this.currentStart = seconds;
        
        if (this.state == PLAYING) {
            this.audio.pause();
            this.audio.src = api.getTrackURL(this.track, seconds);
            this.audio.play();
        } else {
            this.pendingSeek = seconds;
            this._seekSlider.slider("option", "value", seconds);
        }
        
        this._updateCurrentTime();
    }
};

var VirtualList = function(el, rowProvider, itemHeight) {
    this.el = $(el);
    this._rowProvider = rowProvider;
    this._itemHeight = itemHeight;
    
    this.el.on("scroll",
        $.throttle(500, this._scroll.bind(this)));
    this._table = this.el.find("table");
    this._table.css({
        position: "absolute",
        left: 0,
        top: 0
    });
    this._tbody = this.el.find("tbody");
    this._padder = this.el.find(".padder");
    
    this._version = 0;
};

VirtualList.prototype = {
    _scroll: function() {
        this.update();
    },
    
    update: function() {
        var y = this.el.scrollTop(),
            eOffset = Math.max(0, Math.floor(y / this._itemHeight) - 20)
            offset = Math.floor(eOffset / 2) * 2,
            limit = Math.ceil(this.el.height() / this._itemHeight) + 40,
            version = (this._version = (this._version + 1) % 65536);
        
        this._rowProvider(offset, limit, function(totalCount, rows) {
            if (this._version == version) {
                this._table.empty().css("top", offset * this._itemHeight);
            
                this._padder.height(this._itemHeight * totalCount);
            
                rows.forEach(function(r) { this._table.append(r); }, this);
            }
        }.bind(this));
    },
    
    scrollTo: function(index) {
        this.el.scrollTop(index * this._itemHeight);
        this.update();
    }
};

$.widget("musicd.virtuallist", {
    _create: function() {
        this._itemHeight = options.itemHeight;
        this._list = options.list;

        this._table = this.element.find("table");
        this._tbody = this.element.find("tbody");
        this._padder = this.element.find(".padder");

        this.update();
    },

    update: function() {
        var height = this._itemHeight * this._list.length;
        this._padder.height(height);
    }
});

var props = [
    "track", "title", "artist", "album", "length", "path"
];

var Search = function(el, player) {
    this.el = $(el);

    this.player = player;
    this.player.onaudioend = this._nextSong.bind(this);
    
    this._search = this.el.find(".search input");
    this._search.focus();
    //this._results = this.el.find("tbody");
    
    this._search.onmethod("keyup", null, this, "_searchKeyUp");
    this.el.find(".track-list").onmethod("dblclick", "td", this, "_resultsRowActivate");
    this._vlist = new VirtualList(this.el.find(".tracks"),
        this._itemProvider.bind(this),
        20);
};

Search.prototype = {
    _nextSong: function() {
        // burqa
        
        var tr = $(".virtual-list tr.selected").next();
        if (tr.length) {
            this.player.setTrack(tr.data("track"));
                    
            tr.parent().find(">tr").not(tr).removeClass("selected");
            tr.addClass("selected");
        }
    },
    
    _searchKeyUp: function() {
        this._vlist.update();
    },
    
    _itemProvider: function(offset, limit, callback) {
        var self = this;
        var text = this._search.val();

        if (text.length < 3) {
            callback(0, []);
        } else {
            api.call("search", {query: text, sort: "album,track", offset: offset, limit: limit}, function(res) {
                callback(1000, res.tracks.map(function(track) {
                    var tr = $("<tr>").data("track", track);

                    tr.append($("<td>").addClass("track").text(track.track));
                    tr.append($("<td>").addClass("title").attr("title", track.title).text(track.title));
                    tr.append($("<td>").addClass("artist").attr("title", track.artist).text(track.artist));
                    tr.append($("<td>").addClass("album").attr("title", track.album).text(track.album));
                    tr.append($("<td>").addClass("duration").text(formatTime(track.duration)));
                    
                    if (self.player.track && self.player.track.id == track.id)
                        tr.addClass("selected");
                    
                    return tr;
                }));
            });
        }
    },
    
    _resultsRowActivate: function(e) {
        var tr = $(e.target).closest("tr"),
            track = tr.data("track");
        
        this.player.setTrack(track);
        
        tr.parent().find(">tr").not(tr).removeClass("selected");
        tr.addClass("selected");
    },
};

$(function() {
    var player = new Player("#player", "#track-info");
    
    var search = new Search("#search", player);
});

})(jQuery);
