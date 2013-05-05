"use strict";

musicd.TrackInfo = function(track, search) {
    var self = this;

    self.track = track;
    self.search = search;

    self.showAlbumArt = musicd.setting("TrackInfo.showAlbumArt", true);
    self.showLyrics = musicd.setting("TrackInfo.showLyrics", false);

    self.albumArt = new musicd.AlbumArt(track);

    self.lyricsLoading = ko.observable(false);
    self.lyrics = ko.observable(null);

    self.lyricsOffset = ko.observable();
    self.lyricsMaxHeight = ko.computed(function() {
        var offs = self.lyricsOffset();

        return offs ? (musicd.windowHeight() - offs.top - 10) + "px" : 0;
    });

    ko.computed(function() {
        if (self.showAlbumArt())
            self.albumArt.track(self.track());
    });

    ko.computed(function() {
        if (self.showLyrics()) {
            self.track();

            self.loadLyrics();
        }
    });
};

musicd.TrackInfo.prototype = {
    loadLyrics: function() {
        var self = this, track = self.track();

        self.lyrics(null);

        if (track) {
            self.lyricsLoading(true);

            musicd.api.call("lyrics", "track/lyrics", { id: track.id }, function(r) {
                self.lyricsLoading(false);
                self.lyrics(r);
            }, function (xhr) {
                self.lyricsLoading(false);

                return true;
            });

            document.title = [track.title, track.album, track.artist, "musicd"]
                .filter(function(n) { return n; }).join(" :: ");
        } else {
            document.title = "musicd";
        }

        musicd.notifyLayoutChange();
    },

    albumArtDoubleClick: function() {
        if (this.track())
            this.search("albumid:" + this.track().albumid);
    }
};

musicd.AlbumArt = function() {
    var self = this;

    self.template = "widget-album-art";

    self.track = ko.observable(null);
    self.url = ko.observable("");

    ko.computed(function() {
        var track = self.track();

        self.url((track && track.albumid)
            ? musicd.api.getAlbumImageURL(track.albumid, 256)
            : null);
    });

    self.loaded = ko.observable(false);
};
