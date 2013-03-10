"use strict";

musicd.AlbumBrowser = function(el, search) {
    this._el = $(el).render("albumbrowser");
    this._ui = this._el.elementMap();
    
    this._search = search;
    this._size = 200 + 20;
    this._rowSize = 5;
    this._images = {};
    
    this._allowHover = $.debounce(200, function() {
        this._el.addClass("allow-hover");
    }.bind(this));
    
    this._cache = new ListCache(
        $.throttle(500, this._itemProvider.bind(this)),
        this._rowSize * 10);
                
    this._el.on("click dblclick", musicd.stopPropagation);

    this._ui.container.on("scroll", this.update.bind(this));
    this._ui.ul.onmethod("dblclick", "li", this, "_albumDblClick");
};

musicd.AlbumBrowser.prototype = {
    _itemProvider: function(offset, limit, reqTotal, callback) {
        musicd.api.call(
            "AlbumBrowser.albums",
            "albums",
            { limit: limit, offset: offset, total: reqTotal ? 1 : null },
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
        this._el.fadeIn();
        musicd.shader.show();
        this.update();
        
        $(document).on("click.albumbrowser", this.close.bind(this));
        $(document).on("keydown.albumbrowser", function(e) {
            if (e.which == $.ui.keyCode.ESCAPE)
                this.close();
        }.bind(this));
    },
    
    close: function() {
        $(document).off("click.albumbrowser keydown.albumbrowser");
        
        this._el.fadeOut();
        musicd.shader.hide();
    },
    
    update: function() {
        var visOffset = Math.floor(this._ui.container.scrollTop() / this._size),
            visLimit = (Math.ceil(this._ui.container.height() / this._size) + 1),
            completed = false;
        
        this._el.removeClass("allow-hover");
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
            visOffset = Math.floor(this._ui.container.scrollTop() / this._size),
            visLimit = (Math.ceil(this._ui.container.height() / this._size) + 1),
            offset = Math.max(0, visOffset),
            limit = Math.min(visLimit, totalRows);
                    
        this._ui.ul.empty().css("top", offset * this._size);
    
        this._ui.padder.height(this._size * totalRows);
        
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
            
            this._ui.ul.append(li);
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
