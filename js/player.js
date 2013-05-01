"use strict";

musicd.Player = function(el) {  
    var self = this;
    
    self.audio = new Audio();
    window.debugaudio = self.audio;
    self.audio.addEventListener("timeupdate", self._audioTimeUpdate.bind(self), true);
    self.audio.addEventListener("ended", self._audioEnded.bind(self), true);

    self.audioSrc = ko.observable(null);
    self.audioSrc.equalityComparer = null;
    self.audioSrc.subscribe(function(val) {
        self._audioEndedHack = true;

        self.audio.pause();
        self.audio.src = val;
        self.audioTime(0);
    });
    
    self.trackSource = null;

    self.playMode = ko.observable(musicd.Player.NORMAL).extend({ integer: true });
    self.playMode.subscribe(function(val) {
        self.clearHistory();
        
        if (self.playMode() == musicd.Player.REPEAT_TRACK && self.track())
            self._pushHistory(self.track());
    });
    
    self.track = ko.observable(null);
    self.track.subscribe(self._trackChanged, self);
    self.notSeekable = ko.computed(function() {
        return self.track() == null;
    });
    self.duration = ko.computed(function() {
        return self.track() ? self.track().duration : 0;
    });
    
    self.audioTime = ko.observable(0);
    self.currentStart = ko.observable(0);
    self.pendingSeek = ko.observable(false);

    self.currentTime = ko.computed({
        read: function() {
            if (self.pendingSeek())
                return self.currentStart();
            else
                return self.currentStart() + self.audioTime();
        },
        write: self._currentTimeChanged.bind(self)
    });
    self.currentTimeString = ko.computed(function() {
        var track = self.track(), time = Math.floor(self.currentTime());

        return (track && time < musicd.Player.TEN_YEARS)
            ? (musicd.formatTime(self.currentTime(), self.track().duration) + " / " +
                musicd.formatTime(self.track().duration))
            : "--:-- / --:--";
    });

    self.state = ko.observable(musicd.Player.STOPPED);
    self.state.subscribe(self._stateChanged, self);

    self.volume = musicd.observableSetting("Player.volume", 100);
    ko.computed(function() {
        self.audio.volume = self.volume() / 100;
    });
    
    self.clearHistory();
    
    self.stop();
    
    // Workaround for Chromium sometimes not sending the ended event
    // Perhaps related to
    // http://code.google.com/p/chromium/issues/detail?id=86830 ?
    
    self._audioEndedHack = true;
    setInterval(function() {
        if (self._audioEndedHack && self.audio.currentTime > musicd.Player.TEN_YEARS) {
            self._audioEndedHack = false;
            self._audioEnded();
        }
    }, 1000);
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
    _audioTimeUpdate: function() {
        this.audioTime(this.audio.currentTime);
    },

    _audioEnded: function() {
        if (this.playMode() == musicd.Player.REPEAT_TRACK)
            this.currentTime(0);
        else
            this.next();
    },

    _stateChanged: function() {
        var self = this, state = self.state();

        if (state == musicd.Player.PLAYING) {
            if (self.track()) {
                if (self.pendingSeek()) {
                    self.audioSrc(musicd.api.getTrackURL(self.track(), self.currentStart()));
                    self.pendingSeek(false);
                }
            
                self.audio.play();
            } else {
                self.playFirst();
            }
        } else {
            self.audio.pause();
        }
        
        $("#favicon").attr("href", "img/icon-" + ["stop", "play", "pause"][state] + ".png");
        
        if (state == musicd.Player.STOPPED)
            self.currentTime(0);
    },
    
    _trackChanged: function() {
        var self = this, track = self.track();

        self.stop();
        
        if (!self._noHistory && self.playMode() == musicd.Player.RANDOM)
            this._pushHistory(track);
        
        self.currentStart(0);
        self.audioTime(0);
        self.pendingSeek(false);
        self.audioSrc(musicd.api.getTrackURL(track));
        
        self.play();
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
    },

    clearHistory: function() {
        this._history = [];
        this._historyIndex = -1;
    },

    _currentTimeChanged: function(seconds) {
        var self = this;

        self.currentStart(seconds);

        if (self.state() == musicd.Player.PLAYING) {
            self.audioSrc(musicd.api.getTrackURL(self.track(), seconds));
            self.audio.play();
        } else {
            self.pendingSeek(true);
        }
    },
    
    togglePlay: function() {
        this.state(this.state() == musicd.Player.PLAYING
            ? musicd.Player.PAUSED
            : musicd.Player.PLAYING);
    },

    pause: function() {
        this.state(musicd.Player.PAUSED);
    },

    play: function() {
        this.state(musicd.Player.PLAYING);
    },

    stop: function() {
        this.state(musicd.Player.STOPPED);
    },
    
    playFirst: function() {
        var self = this;

        if (!self.trackSource)
            return;
        
        self.trackSource[(self.playMode() == musicd.Player.RANDOM)
            ? "getRandomTrack"
            : "getFirstTrack"]
                (function(track) {
                    if (track) {
                        self.track(track);
                        self.play();
                    }
                });
    },
    
    _playAdjacentTrack: function(delta) {
        var self = this;

        if (!self.trackSource || !self.track())
            return;
        
        if (self.playMode() == musicd.Player.RANDOM) {
            if (self._historyIndex + delta >= self._history.length) {
                self.trackSource.getRandomTrack(function(track) {
                    if (track) {
                        self.track(track);
                        self.play();
                    } else {
                        self.stop();
                    }
                });
            } else {            
                self._historyIndex = Math.max(0, self._historyIndex + delta);
                self._noHistory = true;
                self.track(this._history[self._historyIndex]);
                self._noHistory = false;
            }
        } else {        
            this.trackSource.getAdjacentTrack(self.track().id, delta, function(track) {
                if (track) {
                    self.track(track);
                    self.play();
                } else if (delta < 0 || self.playMode() == musicd.Player.REPEAT_LIST) {
                    self.playFirst();
                } else {
                    self.stop();
                }
            });
        }
    },

    prev: function() {
        this._playAdjacentTrack(-1);
    },

    next: function() {
        this._playAdjacentTrack(1);
    },

    rewindOrPrev: function() {
        var self = this;

        if (self.currentTime() < 5)
            self.prev();
        else
            self.currentTime(0);
    }
};
