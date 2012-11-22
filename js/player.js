musicd.Player = function(el, trackInfo) {
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

    this.state = musicd.Player.STOPPED;

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

$.extend(musicd.Player, {
    STOPPED: 0,
    PLAYING: 1,
    PAUSED: 2
});

musicd.Player.prototype = {
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
                musicd.formatTime(this.getCurrentTime(), this.track.duration) + " / " +
                musicd.formatTime(this.track.duration));
            
            musicd.session.setItem("Player.currentTime", this.getCurrentTime());
        }
    },

    _setState: function(state) {
        if (this.state == state)
            return;

        if (state == musicd.Player.PLAYING) {
            if (this.pendingSeek !== null) {
                this.audio.pause();
                this.audio.src = musicd.api.getTrackURL(this.track, this.pendingSeek);
                this.pendingSeek = null;
            }
            
            this.audio.play();
        } else {
            this.audio.pause();
        }
        
        $("#favicon").attr("href", "img/icon-" + ["stop", "play", "pause"][state] + ".png");

        this.state = state;
        
        if (state == musicd.Player.STOPPED)
            this.seekTo(0);

        this.el.find(".toggle-play")
            .toggleClass("pause", this.state == musicd.Player.PLAYING)
            .text(this.state == musicd.Player.PLAYING ? "▮▮" : "▶");

        this._updateSeekable();
    },
    
    setTrack: function(track) {
        this.stop();
        
        var prevTrack = this.track;
        this.track = track;
        
        this.currentStart = 0;
        this.audio.src = musicd.api.getTrackURL(track);
        
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
            var albumArt = this._trackInfo.find(".album-art");
                img = new Image(),
                loadAlbumId = track.albumid,
                src = musicd.api.getAlbumImageUrl(track, 256);
                
            img.onload = function() {
                if (this.track && this.track.albumid && this.track.albumid == loadAlbumId) {
                    albumArt.queue(function(next) {
                       albumArt.attr("src", src).animate({opacity: 1}, 200); 
                       
                       next();
                    });
                }
            }.bind(this);
            albumArt.animate({opacity: 0}, 200);
            img.src = src;
        }
        
        this.play();
    },
    
    togglePlay: function() {
        this._setState(this.state == musicd.Player.PLAYING
            ? musicd.Player.PAUSED
            : musicd.Player.PLAYING);
    },

    play: function() {
        this._setState(musicd.Player.PLAYING);
    },

    stop: function() {
        this._setState(musicd.Player.STOPPED);
    },

    prev: function() {
        
    },

    next: function() {
        
    },

    seekTo: function(seconds) {
        //this.audio.currentTime = seconds;
        
        this.currentStart = seconds;
        
        if (this.state == musicd.Player.PLAYING) {
            this.audio.pause();
            this.audio.src = musicd.api.getTrackURL(this.track, seconds);
            this.audio.play();
        } else {
            this.pendingSeek = seconds;
            this._seekSlider.slider("option", "value", seconds);
        }
        
        this._updateCurrentTime();
    }
};
