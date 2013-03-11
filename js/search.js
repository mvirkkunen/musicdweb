"use strict";

musicd.Search = function(el, player) {
    this.el = $(el);

    this.player = player;
    this.player.onTrackChange.addListener(this._playerTrackChange.bind(this));
    this.player.trackSource = this;
    
    this._search = this.el.find(".search input");
    this._search.val("").focus();
    musicd.defaultFocusElement = this._search;
    this._lastSearch = "";
    
    this._totalResults = this.el.find(".total-results");
    
    this._search.on("keyup search", $.throttle(250, this._searchKeyUp.bind(this)));
    
    this._vlist = new musicd.VirtualList(this.el.find(".track-list"),
        this._itemProvider.bind(this),
        [
            {name: "track", title: "#"},
            {name: "title", title: "Title"},
            {name: "artist", title: "Artist"},
            {name: "album", title: "Album"},
            {name: "duration", title: "Length", formatter: musicd.formatTime},
        ]);
    
    this.el.on("click dblclick", function() {
        musicd.defaultFocusElement = this._search;
        musicd.focusDefault();
    }.bind(this));
    this._search.onmethod("keydown", null, this._vlist, "handleKeyEvent");
    this._vlist.onItemActivate.addListener(this._onItemActivate.bind(this));
};

musicd.Search.prototype = {
    getAdjacentTrack: function(id, delta, callback) {
        var index = this._vlist.getItemIndex(id);
        
        if (index == -1) {
            callback(null);
            return;
        }
        
        this._vlist.getItemByIndex(index + delta, function(item) {
            callback(item);
        });
    },
    
    getFirstTrack: function(callback) {
        this._vlist.getItemByIndex(0, callback);
    },
    
    playFirst: function() {
        this.getFirstTrack(function(track) {
            if (track) {
                this.player.setTrack(track);
                this.player.play();
            }
        }.bind(this));
    },
    
    _playerTrackChange: function(track) {
        this._vlist.setCurrentItem(track ? track.id : null);
    },
    
    _isValidSearch: function(text) {
        return true;
        
        return !!text.match(/...|[\u3040-\u30FF]{2}|[\u3300-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/);
    },
    
    setSearch: function(text, callback) {
        this._search.val(text);
        this._lastSearch = text;
        this._vlist.refresh(callback);
    },
    
    getSearch: function() {
        return this._search.val();
    },
    
    _searchKeyUp: function() {
        var text = this._search.val();
        
        if (text !== this._lastSearch) {
            this._lastSearch = text;
            
            this._vlist.refresh();
        }
    },
    
    _itemProvider: function(offset, limit, reqTotal, callback) {
        var text = this._search.val();

        var args = {
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
                    this._totalResults.text(res.total || 0);
                
                callback((offset == 0 ? (res.total || 0) : null), res.tracks);
            }.bind(this)
        );
    },
    
    _onItemActivate: function(track) {
        this.player.setTrack(track);
        
        this._vlist.clearSelection();
        this._vlist.setItemSelected(track.id, true);
    }
};
