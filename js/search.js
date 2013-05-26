"use strict";

musicd.Search = function(player) {
    var self = this;

    self.cache = new musicd.ListCache(self);

    self.player = player;
    self.player.track.subscribe(self._playerTrackChange.bind(self));
    self.player.trackSource = self;

    self.search = ko.observable("");
    self.searchFocus = ko.observable(true);
    
    self.totalResults = ko.observable(0);
    
    self.vlist = new musicd.VirtualList(
        this.cache,
        [
            { name: "track", title: "#" },
            { name: "title", title: "Title" },
            { name: "artist", title: "Artist" },
            { name: "album", title: "Album" },
            { name: "duration", title: "Length", formatter: musicd.formatTime },
        ]);
    
    self.vlist.itemActivate.subscribe(self._onItemActivate, self);

    self.search.subscribe(function() {
        self.player.clearHistory();
        self.vlist.refresh();
    });

    self.search("");
};

musicd.Search.prototype = {
    // TrackSource methods
    
    getAdjacentTrack: function(id, delta, callback) {
        var self = this;

        self.cache.getItemIndex(id, function(index) {
            if (index === null) {
                callback(null);
                return;
            }

            self.cache.getItemByIndex(index + delta, function(item) {
                callback(item);
            });
        });
    },
    
    getFirstTrack: function(callback) {
        this.cache.getItemByIndex(0, callback);
    },
    
    getRandomTrack: function(callback) {
        this.cache.getRandomItem(callback);
    },

    jumpToTrack: function(id) {
        var self = this;

        self.cache.getItemIndex(id, function(index) {
            if (index === null)
                return;

            self.vlist.presentIndex(index);
        });
    },

    // ItemProvider methods

    getItems: function(offset, limit, reqTotal, callback) {
        var self = this,
            args = $.extend({
                offset: offset,
                limit: limit,
                total: reqTotal ? 1 : null
            }, self._getSearchArgs())

        musicd.api.call(
            "Search.tracks",
            "tracks",
            args,
            function(res) {
                if (offset == 0)
                    self.totalResults(res.total || 0);
                
                callback((offset == 0 ? (res.total || 0) : null), res.tracks);
            }
        );
    },

    getItemIndex: function(id, callback) {
        var self = this;

        musicd.api.call(
            "Search.trackIndex",
            "track/index",
            $.extend({ id: id }, this._getSearchArgs()),
            function(res) {
                callback(res.index == -1 ? null : res.index);
            }
        );
    },

    getItem: function(id, callback) {
        musicd.api.call(
            null,
            "tracks",
            { trackid: id},
            function(res) {
                callback(res && res.tracks && res.tracks[0]);
            }
        );
    },

    // Search methods

    playFirst: function() {
        this.getFirstTrack(function(track) {
            if (track) {
                this.player.setTrack(track);
                this.player.play();
            }
        }.bind(this));
    },

    _getSearchArgs: function() {
        var text = this.search(),
            args = {
                sort: "album,track,title"
            };

        // TODO: remove if parsing implemented on server side
        var m;
        if (m = text.match(/^albumid:(\d+)$/i))
            args.albumid = m[1];
        else if (m = text.match(/^artistid:(\d+)$/i))
            args.artistid = m[1];
        else
            args.search = text;

        return args;
    },
    
    _playerTrackChange: function(track) {
        this.vlist.currentId(track ? track.id : null);
    },

    _isValidSearch: function(text) {
        return !!text.match(/...|[\u3040-\u30FF]{2}|[\u3300-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/);
    },

    _onItemActivate: function(track) {
        this.player.track(track);

        this.vlist.selectedIds([track.id])
    },

    _rootClick: function() {
        musicd.defaultFocusElement = this._search;
        this.searchFocus(true);
    }
};
