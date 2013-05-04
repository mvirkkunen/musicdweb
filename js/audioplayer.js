(function() {
    "use strict";

    var TEN_YEARS = 315360000; // seconds

    musicd.AudioPlayer = function() {
        var self = this;

        self.currentTime = ko.observable(-1);
        self.ended = new ko.subscribable();
        self.aboutToEnd = ko.subscribable();

        self._audio = new Audio();
        self._audio.addEventListener("timeupdate", self._timeUpdate.bind(self), true);
        self._audio.addEventListener("ended", self._ended.bind(self), true);
        self._audio.addEventListener("error", self._error.bind(self), true);

        self.volume = ko.observable(100);
        ko.computed(function() {
            self._audio.volume = self.volume() / 100;
        });

        self.src = ko.observable(null);
        self.src.equalityComparer = null;
        self.src.subscribe(function(val) {
            self._endedHack = true;

            self._audio.pause();
            self._audio.src = val;
            self.currentTime(0);
        });

        musicd.debugAudio = self._audio;

        // Workaround for Chromium sometimes not sending the ended event
        // Perhaps related to
        // http://code.google.com/p/chromium/issues/detail?id=86830 ?

        self._endedHack = true;
        setInterval(function() {
            if (self._endedHack && self._audio.currentTime > TEN_YEARS) {
                self._endedHack = false;
                self.currentTime(0);
                self._ended();
            }
        }, 1000);
    };

    musicd.AudioPlayer.prototype = {
        _timeUpdate: function() {
            var time = this._audio.currentTime;

            this.currentTime(time < TEN_YEARS ? time : -1);
        },

        _ended: function() {
            this.ended.notifySubscribers();
        },

        _error: function() {
            var self = this;

            self._audio.pause();

            musicd.api.isAuthenticated(function(authenticated) {
                if (authenticated) {
                    musicd.log("Audio error, skipped track " + self.src());
                    self._ended();
                } else {
                    // Dummy request to request authentication
                    musicd.api.call(
                        null,
                        "musicd",
                        {},
                        function() {
                            self.src(self.src());
                            self.play();
                        }
                    );
                }
            });
        },

        play: function() {
            this._audio.play();
        },

        pause: function() {
            this._audio.pause();
        },

        preload: function(url) {
            // TODO
            musicd.log("Preloading audio: " + url);
        }
    };

})();
