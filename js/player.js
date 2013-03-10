"use strict";

$.widget("ui.timeslider", $.ui.slider, {
    _create: function() {
        this._superApply(arguments);
        
        this.element.append(this._tsTime =
            $("<div>").addClass("slider-time")
                .append($("<div>"))
                .append(this._tsTimeText = $("<span>")).hide());
        
        this._tsMouseIn = false;
        
        this._on({
            mousemove: this._tsMouseMove,
            mouseenter: function() {
                this._tsMouseIn = true;
            },
            mouseleave: function() {
                this._tsMouseIn = false;
                
                if (!this._mouseSliding)
                    this._tsTime.hide();
            },
        });
    },
    
    _slide: function(e) {
        this._superApply(arguments);
        this._tsMouseMove(e);
    },
    
    _stop: function() {
        this._superApply(arguments);
        if (!this._tsMouseIn)
            this._tsTime.hide();
    },
    
    _tsMouseMove: function(e) {
        if (!this.elementSize) {
            this.elementSize = {
                width: this.element.outerWidth(),
                height: this.element.outerHeight()
            };
            this.elementOffset = this.element.offset();
        }
        
        var value = this._normValueFromMouse({x: e.pageX, y: e.pageY}),
            valPercent = (value - this._valueMin())
                / (this._valueMax() - this._valueMin()) * 100;
        
        this._tsTimeText.text(musicd.formatTime(value));
        this._tsTime.css({
            "marginLeft": -this._tsTime.outerWidth() / 2,
            "left": e.pageX - this.elementOffset.left
        }).show();
    }
});

musicd.Player = function(el, trackInfo) {
    this._el = $(el);
    this._ui = this._el.elementMap();
    this._trackInfo = $(trackInfo);
    this._albumArt = this._trackInfo.find(".album-art");
    
    this.audio = new Audio();
    window.debugaudio = this.audio;
    this.audio.addEventListener("timeupdate", this._audioTimeUpdate.bind(this), true);
    this.audio.addEventListener("ended", this._audioEnded.bind(this), true);

    this.onAudioEnd = new musicd.Event();
    this.onStateChange = new musicd.Event();
    this.onTrackChange = new musicd.Event();
    
    this.trackSource = null;
    this.repeatMode = musicd.Player.OFF;
    
    this.currentStart = 0;
    this.track = null;
    this.pendingSeek = null;

    this.state = musicd.Player.STOPPED;
    
    this._el.on("click dblclick", musicd.focusDefault);
    this._el.onmethod("click", ".toggle-play", this, "togglePlay", true);
    this._el.onmethod("click", ".stop", this, "stop", true);
    this._el.onmethod("click", ".prev", this, "rewindOrPrev", true);
    this._el.onmethod("click", ".next", this, "next", true);
    this._el.onmethod("change", ".repeat", this, "_repeatChange", true);
    
    this._seekSliderMouseDown = false;
    this._ui.seek.timeslider({
        animate: "fast",
        range: "min",
        start: this._seekSliderStart.bind(this),
        stop: this._seekSliderStop.bind(this)
    });
    this._ui.volume.slider({
        orientation: "vertical",
        min: 0,
        max: 100,
        value: 100,
        slide: this._volSliderChange.bind(this),
        stop: this._volSliderChange.bind(this)
    });
    
    this.stop();
    this._updateSeekable();
    this._updateCurrentTime();
    
    // Workaround for Chromium sometimes not sending the ended event
    // Perhaps related to
    // http://code.google.com/p/chromium/issues/detail?id=86830 ?
    setInterval(function() {
        if (this.audio.currentTime > 315360000) // 10 years
            this._audioEnded();
    }.bind(this), 1000);
};

$.extend(musicd.Player, {
    STOPPED: 0,
    PLAYING: 1,
    PAUSED: 2,
    
    OFF: 0,
    LIST: 1,
    SINGLE: 2,
    
    createDummyAlbumArt: function(track) {
        var div = $("<div>").addClass("dummy-album-art").append(
            $("<h3>").text(track.album || "Untitled album"),
            $("<p>").text(track.artist || "Unknown artist"));
        
        return div;
    }
});

musicd.Player.prototype = {
    _repeatChange: function(e, select) {
        this.repeatMode = parseInt($(select).val(), 10);
    },
    
    setRepeatMode: function(mode) {
        this.repeatMode = mode;
        this.el.find(".repeat").val(mode);
    },
    
    _audioTimeUpdate: function() {
        if (!this._seekSliderMouseDown)
            this._ui.seek.timeslider("option", "value", Math.floor(this.getCurrentTime()));
        
        this._updateCurrentTime();
    },

    _audioEnded: function() {
        if (this.repeatMode == musicd.Player.SINGLE)
            this.seekTo(0);
        else
            this.next();
        
        this.onAudioEnd.fire();
    },

    _seekSliderStart: function() {
        this._seekSliderMouseDown = true;
    },

    _seekSliderStop: function() {
        this._seekSliderMouseDown = false;

        var time = this._ui.seek.timeslider("value");

        this.seekTo(time);
        
        musicd.focusDefault();
    },
    
    _volSliderChange: function() {
        this.audio.volume = this._ui.volume.slider("value") / 100;
    },

    _updateSeekable: function() {
        if (this.track) {
            this._ui.seek.timeslider("option", {
                disabled: false,
                min: 0,
                max: Math.floor(this.track.duration)
            });
        } else {
            this._ui.seek.timeslider("option", {
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
            this._ui.currentTime.text(
                musicd.formatTime(this.getCurrentTime(), this.track.duration) + " / " +
                musicd.formatTime(this.track.duration));
            
            musicd.session.setItem("Player.currentTime", this.getCurrentTime());
        }
    },

    _setState: function(state) {
        if (this.state == state)
            return;

        if (state == musicd.Player.PLAYING) {            
            if (this.track) {
                if (this.pendingSeek !== null) {
                    this.audio.pause();
                    this.audio.src = musicd.api.getTrackURL(this.track, this.pendingSeek);
                    this.pendingSeek = null;
                }
            
                this.audio.play();
            } else {
                this.playFirst();
            }
        } else {
            this.audio.pause();
        }
        
        $("#favicon").attr("href", "img/icon-" + ["stop", "play", "pause"][state] + ".png");

        this.state = state;
        
        if (state == musicd.Player.STOPPED)
            this.seekTo(0);

        this._ui.togglePlay
            .toggleClass("pause", this.state == musicd.Player.PLAYING)
            .text(this.state == musicd.Player.PLAYING ? "▮▮" : "▶");

        this._updateSeekable();
        
        this.onStateChange.fire(state);
    },
    
    setTrack: function(track) {
        this.stop();
        
        var prevTrack = this.track;
        this.track = track;
        
        this.currentStart = 0;
        this.audio.src = musicd.api.getTrackURL(track);
        
        this._trackInfo.find(".titles").pinHeight();
        this._trackInfo.find(".track-name").toggle(!!track.title).find("span").text(track.title);
        this._trackInfo.find(".album").toggle(!!track.album).find("span").text(track.album);
        this._trackInfo.find(".artist").toggle(!!track.artist).find("span").text(track.artist);
        this._trackInfo.find(".titles").animateNaturalHeight(400);
        
        var names = [track.title, track.album, track.artist, "musicd"], title = "";
        names.forEach(function(n) {
            if (n) {
                if (title)
                    title += " :: ";
                
                title += n;
            }
        });
        
        document.title = title;
        
        if (!prevTrack || prevTrack.albumid != track.albumid
            || prevTrack.artistid != track.artistid)
        {
            this.loadAlbumInfo(track);
        }
        
        this.play();
        
        this.onTrackChange.fire(track);
    },
    
    loadAlbumInfo: function(track) {
        var loadAlbumId = track.albumid;
        
        function unknown() {
            if (this.track && this.track.albumid === loadAlbumId) {
                this._albumArt.queue(function(next) {
                    this._albumArt.empty();
                    
                    var div = musicd.Player.createDummyAlbumArt(track);
                
                    div.css("opacity", 0).appendTo(this._albumArt).animate({opacity: 1}, 400);
                    
                    this._albumArt.animate({ height: div.outerHeight() }, 400);
                    
                    next();
                }.bind(this));
            }
        }
        
        if (this._albumArt.children().length) {
            this._albumArt.stop(true, true).queue(function(next) {
                this._albumArt.children().animate({opacity: 0}, 400, next);
            }.bind(this));
        }
        
        if (track.albumid) {        
            var img = $("<img>"),
                src = musicd.api.getAlbumImageURL(track.albumid, 256);
            
            img.one("load", function() {
                if (this.track && this.track.albumid === loadAlbumId) {
                    this._albumArt.queue(function(next) {
                        this._albumArt.empty();
                        
                        img.css("opacity", 0).appendTo(this._albumArt).animate({opacity: 1}, 400);
                        
                        this._albumArt.animate({ height: img.outerHeight() }, 400);
                       
                        next();
                    }.bind(this));
                }
            }.bind(this)).one("error", unknown.bind(this));
        
            img.attr("src", src);
        } else {
            setTimeout(unknown.bind(this), 1);
            return;
        }
    },
    
    togglePlay: function() {
        this._setState(this.state == musicd.Player.PLAYING
            ? musicd.Player.PAUSED
            : musicd.Player.PLAYING);
    },

    play: function() {
        if (!this.track) {
            this._playFirstTrack();
        } else {
            this._setState(musicd.Player.PLAYING);
        }
    },

    stop: function() {
        this._setState(musicd.Player.STOPPED);
    },
    
    playFirst: function() {
        if (!this.trackSource)
            return;
        
        this.trackSource.getFirstTrack(function(track) {
            if (track) {
                this.setTrack(track);
                this.play();
            }
        }.bind(this));
    },
    
    _playAdjacentTrack: function(delta) {
        if (!this.trackSource || !this.track)
            return;
        
        this.trackSource.getAdjacentTrack(this.track.id, delta, function(track) {
            if (track) {
                this.setTrack(track);
                this.play();
            } else if (delta < 0 || this.repeatMode == musicd.Player.LIST) {
                this.playFirst();
            } else {
                this.stop();
            }
        }.bind(this));
    },
    
    rewindOrPrev: function() {
        if (this.getCurrentTime() < 5)
            this.prev();
        else
            this.seekTo(0);
    },

    prev: function() {
        this._playAdjacentTrack(-1);
    },

    next: function() {
        this._playAdjacentTrack(1);
    },

    seekTo: function(seconds) {
        this.currentStart = seconds;
        
        if (this.state == musicd.Player.PLAYING) {
            this.audio.pause();
            this.audio.src = musicd.api.getTrackURL(this.track, seconds);
            this.audio.play();
        } else {
            this.pendingSeek = seconds;
            this._ui.seek.timeslider("option", "value", seconds);
        }
        
        this._updateCurrentTime();
    }
};
