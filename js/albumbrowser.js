"use strict";

musicd.AlbumBrowser = function(search) {
    var self = this;

    self.cache = new musicd.ListCache(self);

    self.search = ko.observable("");
    self.searchFocus = ko.observable(true);

    self.totalResults = ko.observable(0);

    self.vlist = new musicd.VirtualList(
        this.cache,
        [
            { name: "album", title: "Album" }
        ],
        "widget-virtual-grid");

    self.vlist.itemActivate.subscribe(self._onItemActivate, self);

    self.search.subscribe(function() {
        self.vlist.refresh();
    });

    self.search("");
};

musicd.AlbumBrowser.prototype = {
    // ItemProvider methods

    getItems: function(offset, limit, reqTotal, callback) {
        var self = this,
            args = {
                offset: offset,
                limit: limit,
                total: reqTotal ? 1 : null
            };

        musicd.api.call(
            "Search.albums",
            "albums",
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
