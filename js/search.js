"use strict";

musicd.Search = function(el, player) {
    this.el = $(el);

    this.player = player;
    this.player.onAudioEnd.addListener(function() {
        this._burkhaNavigate("next");
    }.bind(this));
    
    $(".buttons .prev").on("click", function() {
        this._burkhaNavigate("prev");
    }.bind(this));
    $(".buttons .next").on("click", function() {
        this._burkhaNavigate("next");
    }.bind(this));
    
    this._search = this.el.find(".search input");
    this._search.val("").focus();
    this._lastSearch = "";
    
    this._totalResults = this.el.find(".total-results");
    
    this._search.on("keyup", $.throttle(250, this._searchKeyUp.bind(this)));
    
    this._vlist = new musicd.VirtualList(this.el.find(".track-list"),
        this._itemProvider.bind(this),
        [
            {name: "track", title: "#"},
            {name: "title", title: "Title"},
            {name: "artist", title: "Artist"},
            {name: "album", title: "Album"},
            {name: "duration", title: "Length", formatter: musicd.formatTime},
        ]);
        
    this._vlist.onItemActivate.addListener(this._onItemActivate.bind(this));
};

musicd.Search.prototype = {
    _burkhaNavigate: function(dir) {
        var tr = $(".virtual-list tr.selected")[dir]();
        if (tr.length) {
            var item = tr.data("item");
            
            this.player.setTrack(item);
            
            this._vlist.clearSelection();
            this._vlist.setItemSelected(item.id, true);
        }
    },
    
    _isValidSearch: function(text) {
        return true;
        
        return !!text.match(/...|[\u3040-\u30FF]{2}|[\u3300-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/);
    },
    
    setSearch: function(text, callback) {
        this._search.val(text);
        this._vlist.update(callback);
    },
    
    _searchKeyUp: function() {
        var text = this._search.val();
        
        if (text !== this._lastSearch) {
            this._lastSearch = text;
            
            this._vlist.refresh();
        }
    },
    
    _itemProvider: function(offset, limit, callback) {
        var text = this._search.val();
        
        musicd.session.setItem("Search.text", text);

        if (!this._isValidSearch(text)) {
            callback(0, []);
        } else {
            var args = { search: text, sort: "album,track,title", offset: offset, limit: limit };

            if (offset == 0)
                args.total = 1;

            musicd.api.call(
                null,
                //(offset == 0 ? null : "Search.tracks"), // ensures first search is not aborted
                "tracks",
                args,
                function(res) {
                    if (offset == 0)
                        this._totalResults.text(res.total || 0);
                    
                    callback((offset == 0 ? (res.total || 0) : null), res.tracks);
                }.bind(this)
            );
        }
    },
    
    _onItemActivate: function(track) {
        this.player.setTrack(track);
        
        this._vlist.clearSelection();
        this._vlist.setItemSelected(track.id, true);
        
        //this.context.session.setItem("Search.currentTrackIndex", 
        //this.context.session.setItem("Search.currentTrack",
    }
};
