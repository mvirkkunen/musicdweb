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
    this._trackInfoUi = this._trackInfo.elementMap();
    
    //this._albumArt = this._trackInfo.find(".album-art");
    
    this.audio = new Audio();
    window.debugaudio = this.audio;
    this.audio.addEventListener("timeupdate", this._audioTimeUpdate.bind(this), true);
    this.audio.addEventListener("ended", this._audioEnded.bind(this), true);

    this.onAudioEnd = new musicd.Event();
    this.onStateChange = new musicd.Event();
    this.onTrackChange = new musicd.Event();
    
    this.trackSource = null;
    this.playMode = musicd.Player.NORMAL;
    
    this.currentStart = 0;
    this.track = null;
    this.pendingSeek = null;

    this.state = musicd.Player.STOPPED;
    
    this.clearHistory();
    
    this._el.on("click dblclick", musicd.focusDefault);
    this._el.onmethod("click", ".toggle-play", this, "togglePlay", true);
    this._el.onmethod("click", ".stop", this, "stop", true);
    this._el.onmethod("click", ".prev", this, "rewindOrPrev", true);
    this._el.onmethod("click", ".next", this, "next", true);
    this._el.onmethod("change", ".play-mode", this, "_playModeChange", true);
    
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
        value: Math.floor(musicd.settings.get("Player.volume", 1.0) * 100),
        slide: this._volSliderChange.bind(this),
        stop: this._volSliderChange.bind(this)
    });
    this._volSliderChange();
    
    this._trackInfoUi.details.toggle(musicd.settings.get("Player.trackDetailsVisible", true));
    this._trackInfoUi.toggleDetails.click(function(e) {
        e.preventDefault();
        
        var visible = !this._trackInfoUi.details.is(":visible");
        
        this._trackInfoUi.details.stop();
        musicd.settings.set("Player.trackDetailsVisible", visible);
        this._trackInfoUi.details.slideToggle();
        
        if (visible && this.track)
            this.loadAlbumInfo(this.track);
    }.bind(this));
    
    this.stop();
    this._updateSeekable();
    this._updateCurrentTime();
    
    // Workaround for Chromium sometimes not sending the ended event
    // Perhaps related to
    // http://code.google.com/p/chromium/issues/detail?id=86830 ?
    
    this._audioEndedHack = true;
    setInterval(function() {
        if (this._audioEndedHack && this.audio.currentTime > musicd.Player.TEN_YEARS) {
            this._audioEndedHack = false;
            this._audioEnded();
        }
    }.bind(this), 1000);

    // TODO: wat
    $(window).onmethod("resize", null, this, "_resize");
    this._resize();
};

$.extend(musicd.Player, {
    STOPPED: 0,
    PLAYING: 1,
    PAUSED: 2,
    
    NORMAL: 0,
    RANDOM: 1,
    REPEAT_LIST: 2,
    REPEAT_TRACK: 3,
    
    MAX_HISTORY: 100,
    
    TEN_YEARS: 315360000, // seconds
    
    createDummyAlbumArt: function(track) {
        var div = $("<div>").addClass("dummy-album-art").append(
            $("<h3>").text(track.album || "Untitled album"),
            $("<p>").text(track.artist || "Unknown artist"));
        
        return div;
    }
});

musicd.Player.prototype = {
    _playModeChange: function(e, select) {
        this.setPlayMode(parseInt($(select).val(), 10));
    },
    
    setPlayMode: function(mode) {
        if (mode != this.playMode) {
            this.clearHistory();
            this.playMode = mode;
            this._ui.playMode.val(mode);
            
            if (this.playMode == musicd.Player.REPEAT_TRACK && this.track)
                this._pushHistory(this.track);
        }
    },
    
    _audioTimeUpdate: function() {
        if (!this._seekSliderMouseDown)
            this._ui.seek.timeslider("option", "value", Math.floor(this.getCurrentTime()));
        
        this._updateCurrentTime();
    },

    _audioEnded: function() {
        if (this.playMode == musicd.Player.REPEAT_TRACK)
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
        var volume = this._ui.volume.slider("value") / 100;
        
        this.audio.volume = volume;
        musicd.settings.set("Player.volume", volume);
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
            var time = this.getCurrentTime();
            
            if (time < musicd.Player.TEN_YEARS) {
                this._ui.currentTime.text(
                    musicd.formatTime(this.getCurrentTime(), this.track.duration) + " / " +
                    musicd.formatTime(this.track.duration));
            }
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
    
    setTrack: function(track, noHistory) {
        var self = this;

        this.stop();
        
        var prevTrack = this.track;
        this.track = track;
        
        if (!noHistory && this.playMode == musicd.Player.RANDOM)
            this._pushHistory(track);
        
        this.currentStart = 0;
        this._audioEndedHack = true;
        this.audio.src = musicd.api.getTrackURL(track);
        
        this._trackInfoUi.titles.pinHeight();
        this._trackInfoUi.trackName.toggle(!!track.title).find("span").text(track.title);
        this._trackInfoUi.album.toggle(!!track.album).find("span").text(track.album);
        this._trackInfoUi.artist.toggle(!!track.artist).find("span").text(track.artist);
        this._trackInfoUi.titles.animateNaturalHeight(400);
        
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

        self._trackInfoUi.lyrics.show();
        self._trackInfoUi.lyricsLoading.show();
        self._trackInfoUi.lyricsText.hide();
        self._trackInfoUi.lyricsSource.hide();
        self._trackInfoUi.lyricsUnavailable.hide();

        musicd.api.call(null, "track/lyrics", { id: track.id }, function(r) {
            self._trackInfoUi.lyricsLoading.hide();
            self._trackInfoUi.lyricsText.show().text(r.lyrics);

            if (r.source) {
                self._trackInfoUi.lyricsSource.show();
                self._trackInfoUi.lyricsSourceLink.text(r.provider).attr("href", r.source);
            }
        }, function (xhr) {
            self._trackInfoUi.lyricsLoading.hide();
            self._trackInfoUi.lyricsUnavailable.show();

            return true;
        });
        
        this.play();
        
        this.onTrackChange.fire(track);
    },

    _resize: function() {
        this._trackInfoUi.lyrics.css("maxHeight", $(window).height() - this._trackInfoUi.lyrics.offset().top - 10);
    },
    
    _pushHistory: function(track) {
        this._historyIndex++;
        
        if (this._historyIndex != this._history.length)
            this._history = this._history.slice(0, this._historyIndex);
            
        this._history.push(track);
        
        var overflow = this._history.length - musicd.Player.MAX_HISTORY;
        if (overflow > 0) {
            this._historyIndex -= overflow;
            this._history = this._history.slice(overflow);
        }
        
        musicd.log("_pushHistory", this._history, this._historyIndex);
    },
    
    loadAlbumInfo: function(track) {
        var loadAlbumId = track.albumid;
        
        function unknown() {
            if (this.track && this.track.albumid === loadAlbumId) {
                this._trackInfoUi.albumArt.queue(function(next) {
                    this._trackInfoUi.albumArt.empty();
                    
                    var div = musicd.Player.createDummyAlbumArt(track);
                
                    div.css("opacity", 0).appendTo(this._trackInfoUi.albumArt).animate({opacity: 1}, 400);
                    
                    this._trackInfoUi.albumArt.animate({ height: div.outerHeight() }, 400);
                    
                    next();
                }.bind(this));
            }
        }
        
        if (this._trackInfoUi.albumArt.children().length) {
            this._trackInfoUi.albumArt.stop(true, true).queue(function(next) {
                this._trackInfoUi.albumArt.children().animate({opacity: 0}, 400, next);
            }.bind(this));
        }
        
        if (track.albumid) {
            var img = $("<img>"),
                src = musicd.api.getAlbumImageURL(track.albumid, 256);
            
            img.one("load", function() {
                if (this.track && this.track.albumid === loadAlbumId) {
                    this._trackInfoUi.albumArt.queue(function(next) {
                        this._trackInfoUi.albumArt.empty();
                        
                        img.css("opacity", 0).appendTo(this._trackInfoUi.albumArt).animate({opacity: 1}, 400);
                        
                        this._trackInfoUi.albumArt.animate({ height: img.outerHeight() }, 400);
                       
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
            this.playFirst();
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
        
        this.trackSource[(this.playMode == musicd.Player.RANDOM)
            ? "getRandomTrack"
            : "getFirstTrack"]
                (function(track) {
                    if (track) {
                        this.setTrack(track);
                        this.play();
                    }
                }.bind(this));
    },
    
    _playAdjacentTrack: function(delta) {
        if (!this.trackSource || !this.track)
            return;
        
        if (this.playMode == musicd.Player.RANDOM) {
            if (this._historyIndex + delta >= this._history.length) {
                this.trackSource.getRandomTrack(function(track) {
                    if (track) {
                        this.setTrack(track);
                        this.play();
                    } else {
                        this.stop();
                    }
                }.bind(this));
            } else {            
                this._historyIndex = Math.max(0, this._historyIndex + delta);
                this.setTrack(this._history[this._historyIndex], true);
            }
        } else {        
            this.trackSource.getAdjacentTrack(this.track.id, delta, function(track) {
                if (track) {
                    this.setTrack(track);
                    this.play();
                } else if (delta < 0 || this.playMode == musicd.Player.REPEAT_LIST) {
                    this.playFirst();
                } else {
                    this.stop();
                }
            }.bind(this));
        }
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
    },
    
    clearHistory: function() {
        this._history = [];
        this._historyIndex = -1;
    }
};
