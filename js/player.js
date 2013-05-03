"use strict";

musicd.Player = function(el) {  
    var self = this;
    
    self._audio = new musicd.AudioPlayer();
    self._audio.ended.subscribe(self._audioEnded, self);
    
    self.trackSource = null;

    self.mode = ko.observable(musicd.Player.NORMAL).extend({ integer: true });
    self.mode.subscribe(function(val) {
        self.clearHistory();
        
        if (self.mode() == musicd.Player.REPEAT_TRACK && self.track())
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
    
    self.currentStart = ko.observable(0);
    self.pendingSeek = ko.observable(false);

    self.currentTime = ko.computed({
        read: function() {
            if (self.pendingSeek())
                return self.currentStart();
            else
                return self.currentStart() + self._audio.currentTime();
        },
        write: self._currentTimeChanged.bind(self)
    });
    self.currentTimeString = ko.computed(function() {
        var track = self.track(), time = Math.floor(self.currentTime());

        return (track && time >= 0)
            ? (musicd.formatTime(time, track.duration) + " / " +
                musicd.formatTime(track.duration))
            : "--:-- / --:--";
    });

    self.state = ko.observable(musicd.Player.STOP);
    self.state.subscribe(self._stateChanged, self);

    self.volume = musicd.setting("Player.volume", 100);
    ko.computed(function() {
        self._audio.volume(self.volume());
    });
    
    self.clearHistory();
    
    self.stop();
};

$.extend(musicd.Player, {
    MAX_HISTORY: 100
});

musicd.PlayerState = musicd.makeEnum("STOP", "PLAY", "PAUSE");
musicd.PlayerMode = musicd.makeEnum("NORMAL", "RANDOM", "REPEAT_LIST", "REPEAT_TRACK");

musicd.Player.prototype = {
    _audioEnded: function() {
        if (this.mode() == musicd.PlayerMode.REPEAT_TRACK)
            this.currentTime(0);
        else
            this.next();
    },

    _stateChanged: function(state) {
        var self = this;

        if (state == musicd.PlayerState.PLAY) {
            if (self.track()) {
                if (self.pendingSeek()) {
                    self._audio.src(musicd.api.getTrackURL(self.track(), self.currentStart()));
                    self.pendingSeek(false);
                }
            
                self._audio.play();
            } else {
                self.playFirst();
            }
        } else {
            self._audio.pause();
        }
        
        if (state == musicd.PlayerState.STOP)
            self.currentTime(0);
    },
    
    _trackChanged: function(track) {
        var self = this;

        self.stop();
        
        if (!self._noHistory && self.mode() == musicd.PlayerMode.RANDOM)
            this._pushHistory(track);
        
        self.currentStart(0);
        self.pendingSeek(false);
        self._audio.src(musicd.api.getTrackURL(track));
        
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

        seconds = Math.floor(seconds);

        self.currentStart(seconds);

        if (self.state() == musicd.PlayerState.PLAY) {
            self._audio.src(musicd.api.getTrackURL(self.track(), seconds));
            self._audio.play();
        } else {
            self.pendingSeek(true);
        }
    },
    
    togglePlay: function() {
        this.state(this.state() == musicd.PlayerState.PLAY
            ? musicd.PlayerState.PAUSE
            : musicd.PlayerState.PLAY);
    },

    pause: function() {
        this.state(musicd.PlayerState.PAUSE);
    },

    play: function() {
        this.state(musicd.PlayerState.PLAY);
    },

    stop: function() {
        this.state(musicd.PlayerState.STOP);
    },
    
    playFirst: function() {
        var self = this;

        if (!self.trackSource)
            return;
        
        self.trackSource[(self.mode() == musicd.PlayerMode.RANDOM)
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
        
        if (self.mode() == musicd.PlayerMode.RANDOM) {
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
                } else if (delta < 0 || self.mode() == musicd.PlayerMode.REPEAT_LIST) {
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
