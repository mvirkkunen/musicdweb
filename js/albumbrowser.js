"use strict";

musicd.AlbumBrowser = function(main) {
    var self = this;

    self._main = main;

    self.cache = new musicd.ListCache(self);

    self.search = ko.observable("");
    self.searchFocus = ko.observable(true);

    self.totalResults = ko.observable(0);

    self.vlist = new musicd.VirtualList(this.cache, "widget-album-browser-grid", 220, true);

    self.vlist.itemImagesClick = function(album) {
        self._main.imageViewer().showAlbum(album);
    };

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
                total: reqTotal ? 1 : null,
                sort: "album",
                album: self.search()
            };

        musicd.api.call(
            "Search.albums",
            "albums",
            args,
            function(res) {
                if (offset == 0)
                    self.totalResults(res.total || 0);

                callback((offset == 0 ? (res.total || 0) : null), res.albums);
            }
        );
    },

    // AlbumBrowser methods

    _onItemActivate: function(album) {
        this._main.search.search("albumid:" + album.id);
        this._main.player.playFirst();
        this._main.currentTab("search");
    },

    _rootClick: function() {
        musicd.defaultFocusElement = this._search;
        this.searchFocus(true);
    }
};
