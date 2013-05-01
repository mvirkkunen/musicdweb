"use strict";

musicd.Search = function(player) {
    var self = this;

    this.cache = new musicd.ListCache(self._itemProvider.bind(self));

    this.player = player;
    this.player.track.subscribe(this._playerTrackChange.bind(this));
    this.player.trackSource = this;

    this.search = ko.observable("");
    this.searchFocus = ko.observable(true);
    
    this.totalResults = ko.observable(0);
    
    this.vlist = new musicd.VirtualList(
        this.cache,
        [
            { name: "track", title: "#" },
            { name: "title", title: "Title" },
            { name: "artist", title: "Artist" },
            { name: "album", title: "Album" },
            { name: "duration", title: "Length", formatter: musicd.formatTime },
        ]);
    
    this.vlist.itemActivate.subscribe(this._onItemActivate.bind(this));

    ko.computed(function() {
        self.search();

        self.vlist.refresh();
    });
};

musicd.Search.prototype = {
    // TrackSource methods
    
    getAdjacentTrack: function(id, delta, callback) {
        var index = this.cache.getItemIndex(id);
        
        if (index == -1) {
            callback(null);
            return;
        }
        
        this.cache.getItemByIndex(index + delta, function(item) {
            callback(item);
        });
    },
    
    getFirstTrack: function(callback) {
        this.cache.getItemByIndex(0, callback);
    },
    
    getRandomTrack: function(callback) {
        this.cache.getRandomItem(callback);
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
    
    _playerTrackChange: function(track) {
        this.vlist.currentId(track ? track.id : null);
    },
    
    _isValidSearch: function(text) {
        return !!text.match(/...|[\u3040-\u30FF]{2}|[\u3300-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/);
    },
    
    _searchKeyUp: function() {
        var text = this._search.val();
        
        if (text !== this._lastSearch) {
            this._lastSearch = text;
            
            this._vlist.refresh();
            this.player.clearHistory();
        }
    },
    
    _itemProvider: function(offset, limit, reqTotal, callback) {
        var self = this,
            text = self.search(),
            args = {
                sort: "album,track,title",
                offset: offset,
                limit: limit,
                total: reqTotal ? 1 : null
            };
        
        // TODO: remove when parsing implemented on server side
        var m;
        if (m = text.match(/^albumid:(\d+)$/i))
            args.albumid = m[1];
        else
            args.search = text;

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
    
    _onItemActivate: function(track) {
        this.player.track(track);

        this.vlist.selectedIds([track.id])
    },

    _rootClick: function() {
        musicd.defaultFocusElement = this._search;
        this.searchFocus(true);
    }
};
