"use strict";

musicd.AlbumBrowser = function(el, search) {
    this.el = $(el);
    this._search = search;
    this._shader = $("#shader");
    this._size = 200 + 20;
    this._rowSize = 5;
    this._images = {};
    
    this._allowHover = $.debounce(200, function() {
        this.el.addClass("allow-hover");
    }.bind(this));
    
    this._cache = new ListCache(
        $.throttle(500, this._itemProvider.bind(this)),
        this._rowSize,
        10);
    
    this.el.append(
        this._container = $("<div>").addClass("container").append(
            this._padder = $("<div>").addClass("padder").append(
                this._ul = $("<ul>"))));
                
    this.el.on("click", function(e) { e.stopPropagation(); });
    $(document).on("click", this.close.bind(this));

    this._container.on("scroll", this.update.bind(this));
    this._ul.onmethod("dblclick", "li", this, "_albumDblClick");
};

musicd.AlbumBrowser.prototype = {
    _itemProvider: function(offset, limit, callback) {
        musicd.api.call(
            (offset == 0 ? null : "AlbumBrowser.albums"), // ensures first search is not aborted
            "albums",
            { limit: limit, offset: offset, total: (offset == 0) ? 1 : null },
            function(res) {
                callback((offset == 0 ? (res.total || 0) : null), res.albums);
            }.bind(this)
        );
    },
    
    _albumDblClick: function(e, item) {
        this._search.setSearch("albumid:" + $(item).data("album").id, function() {
            this._search.playFirst();
        }.bind(this));
    },
    
    open: function() {
        this.el.fadeIn();
        musicd.shader.show();
        this.update();
    },
    
    close: function() {
        this.el.fadeOut();
        musicd.shader.hide();
    },
    
    update: function() {
        var visOffset = Math.floor(this._container.scrollTop() / this._size),
            visLimit = (Math.ceil(this._container.height() / this._size) + 1),
            completed = false;
        
        this.el.removeClass("allow-hover");
        this._allowHover();
        
        this._cache.ensureItems(
            visOffset * this._rowSize,
            visLimit * this._rowSize,
            function() {
                this._draw();
                
                completed = true;
            }.bind(this)
        );
        
        if (!completed)
            this._draw();
    },

    _draw: function() {
        // delicious copypasta
        
        var totalRows = Math.ceil((this._cache.totalCount || 0) / this._rowSize),
            visOffset = Math.floor(this._container.scrollTop() / this._size),
            visLimit = (Math.ceil(this._container.height() / this._size) + 1),
            offset = Math.max(0, visOffset),
            limit = Math.min(visLimit, totalRows);
                    
        this._ul.empty().css("top", offset * this._size);
    
        this._padder.height(this._size * totalRows);
        
        for (var i = offset * this._rowSize, e = (offset + limit) * this._rowSize;
             i < e;
             i++)
        {
            var album = this._cache.items[i],
                li = $("<li>");
            
            if (album) {
                li.data("album", album);
                
                var image = this._images[album.id];
                
                if (image === false) {
                    li.append($("<div>").addClass("dummy-album-art").append($("<h3>").text(album.album || "Untitled album")));
                } else if (image) {
                    li.append(image);
                } else {
                    var div = $("<div>").addClass("dummy-album-art").append($("<h3>").text(album.album || "Untitled album"));
                    
                    div.css("opacity", 0).animate({ opacity: 1 }, 500)
                    
                    li.append(div)
                    
                    $("<img>")
                        .css("opacity", 0)
                        .onmethod("load", null, this, "_imageLoad")
                        .onmethod("error", null, this, "_imageError")
                        .appendTo(li)
                        .attr("src", musicd.api.getAlbumImageURL(album.id, 256));
                }
                
                li.append($("<div>").addClass("info").text(album.album || "Untitled album"));
            }
            
            this._ul.append(li);
        }
    },
    
    _imageLoad: function(e, img) {
        var li = $(img).parent(),
            album = li.data("album");
        
        li.find(".dummy-album-art").stop().remove();
        $(img).animate({ opacity: 1 }, 500);
        
        this._images[album.id] = img;
    },
    
    _imageError: function(e, img) {
        var li = $(img).parent(),
            album = li.data("album");
        
        this._images[album.id] = false;
        
        $(img).remove();
    }
};
