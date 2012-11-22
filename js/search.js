musicd.Search = function(el, player) {
    this.el = $(el);

    this.player = player;
    this.player.onaudioend = this._nextSong.bind(this);
    
    this._search = this.el.find(".search input");
    this._search.focus();
    
    this._search.onmethod("keyup", null, this, "_searchKeyUp");
    
    this._vlist = new musicd.VirtualList(this.el.find(".track-list"),
        this._itemProvider.bind(this),
        [
            {name: "track", title: "#"},
            {name: "title", title: "Title"},
            {name: "artist", title: "Artist"},
            {name: "album", title: "Album"},
            {name: "duration", title: "Length", formatter: musicd.formatTime},
        ]);
    this._vlist.onitemactivate = this._onItemActivate.bind(this);
};

musicd.Search.prototype = {
    _nextSong: function() {
        // burqa
        
        var tr = $(".virtual-list tr.selected").next();
        if (tr.length) {
            var item = tr.data("item");
            
            this.player.setTrack(item);
            
            this._vlist.clearSelection();
            this._vlist.setItemSelected(item.id, true);
        }
    },
    
    _isValidSearch: function(text) {
        if (!text)
            return false;
        
        return !!text.match(/...|[\u3040-\u30FF]{2}|[\u3300-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/);
    },
    
    setSearch: function(text, callback) {
        this._search.val(text);
        this._vlist.update(callback);
    },
    
    _searchKeyUp: function() {
        this._vlist.scrollTo(0);
        this._vlist.update();
    },
    
    _itemProvider: function(offset, limit, callback) {
        var text = this._search.val();
        
        musicd.session.setItem("Search.text", text);

        if (!this._isValidSearch(text)) {
            callback(0, []);
        } else {
            musicd.api.call("search", {query: text, sort: "album,track", offset: offset, limit: limit}, function(res) {
                callback(1000, res.tracks.map(function(track) {
                    return {
                        item: track,
                        id: track.id,
                        //selected: (this.player.track && this.player.track.id == track.id)
                    }
                }));
            }.bind(this));
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
