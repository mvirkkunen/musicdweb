"use strict";

musicd.VirtualList = function(el, rowProvider, columns) {
    this._el = $(el).addClass("virtual-list").render("virtuallist");
    this._ui = this._el.elementMap();
    
    this._cache = new ListCache($.throttle(500, rowProvider));
                
    this._drawExtraItems = 40;
    this._drawnPos = null;
    this._selectedIds = {};
    this._currentId = null;
    this._highlightedIndex = null;
    this._setColumns(columns);
    this._itemHeight = this._ui.headingRow.first().outerHeight();
    this._resize();
    
    this.onItemActivate = new musicd.Event();
    
    this._debouncedUninhibitRowHighlight = $.debounce(200, function() {
        this._rowHighlightInhibited = false;
    }.bind(this));
    
    this._ui.rows.on("scroll", $.debounce(100, function() { this.update(); }.bind(this)));
    
    // TODO: This is just to test phone compatibility
    var isAndroid = !!navigator.userAgent.match(/android/i);
    
    this._ui.tbody.onmethod("mouseover", "tr", this, "_rowMouseOver");
    this._ui.tbody.onmethod(isAndroid ? "click" : "dblclick", "td", this, "_rowDblclick");
    $(window).onmethod("resize", null, this, "_resize");
};

musicd.VirtualList.prototype = {
    setColumns: function(columns) {
        this._setColumns(columns);
        this.update();
    },
    
    update: function(callback) {
        var exactFirst = Math.floor(this._ui.rows.scrollTop() / this._itemHeight),
            visOffset = Math.floor(exactFirst / 2) * 2,
            visLimit = Math.ceil(this._ui.rows.height() / this._itemHeight) + 1,
            completed = false,
            force = false;
        
        this._cache.ensureItems(visOffset, visLimit, function() {
            this._draw(force);
            
            if (callback)
                callback();
            
            completed = true;
        }.bind(this));
        
        if (!completed) {
            this._draw();
            force = true;
        }
    },
    
    handleKeyEvent: function(e) {
        if (e.which == $.ui.keyCode.UP) {
            this._adjustHighlightedIndex(-1);
        } else if (e.which == $.ui.keyCode.DOWN) {
            this._adjustHighlightedIndex(1);
        } else if (e.which == $.ui.keyCode.PAGE_UP) {
            this._adjustHighlightedIndex(-10);
        } else if (e.which == $.ui.keyCode.PAGE_DOWN) {
            this._adjustHighlightedIndex(10);
        } else if (e.which == $.ui.keyCode.ENTER) {
            this._cache.ensureItems(this._highlightedIndex, 1, function() {
                var item = this._cache.items[this._highlightedIndex];
                if (item)
                    this.onItemActivate.fire(item);
            }.bind(this));
        }
    },

    _draw: function(force) {
        if (this._cache.cleared)
            return;
        
        var pos = this._ui.rows.scrollTop();
    
        if (!force && this._drawnPos !== null && Math.abs(this._drawnPos - pos) < 50)
            return;
        
        this._drawnPos = pos;
        
        this._inhibitRowHighlight();
        
        var exactFirst = Math.floor(this._ui.rows.scrollTop() / this._itemHeight),
            visOffset = Math.floor(exactFirst / 2) * 2,
            visLimit = Math.ceil(this._ui.rows.height() / this._itemHeight) + 1,
            offset = Math.max(0, visOffset - this._drawExtraItems),
            limit = Math.min(visLimit + this._drawExtraItems*2, this._cache.totalCount || 0);
                    
        this._ui.tbody.empty();
        this._ui.table.css("top", offset * this._itemHeight);
    
        this._ui.padder.height(this._itemHeight * (this._cache.totalCount || 0));
        
        for (var i = offset; i < offset + limit; i++) {
            var r = this._cache.items[i],
                tr = $("<tr>").data("index", i);
            
            if (r) {
                tr.data("item", r).data("id", r.id);
                
                this._columns.forEach(function(col) {
                    var val = r[col.name];
                    
                    if (col.formatter)
                        val = col.formatter(val);
                    
                    var td = $("<td>").text(val);
                    
                    if (val && val.length > 10)
                        td.attr("title", val);
                        
                    td.addClass(col.name);
                    
                    tr.append(td);
                }, this);
                
                if (this._selectedIds[r.id])
                    tr.addClass("selected");
                    
                if (this._currentId === r.id)
                    tr.addClass("current");
            } else {
                tr.addClass("loading");
                
                this._columns.forEach(function(col) {
                    tr.append($("<td>").addClass(col.name));
                }, this);
            }
            
            if (i == this._highlightedIndex)
                tr.addClass("highlighted");
            
            this._ui.tbody.append(tr)
        }
    },
    
    clearSelection: function() {
        this._selectedIds = {};
        
        this._ui.tbody.children().removeClass("selected");
    },
    
    setItemSelected: function(id, selected) {
        if (selected)
            this._selectedIds[id] = true;
        else
            delete this._selectedIds[id];
        
        this._ui.tbody.children().each(function(index, tr) {
            tr = $(tr);
            
            if (tr.data("id") == id) {
                tr.toggleClass("selected", selected);
                return false;
            }
        }.bind(this));
    },
    
    setCurrentItem: function(id) {
        if (id === this._currentId)
            return;
        
        this._currentId = id;
        
        this._ui.tbody.children().removeClass("current").filter(function() {
            return $(this).data("id") === id;
        }).addClass("current");
    },
    
    _adjustHighlightedIndex: function(delta) {
        this._inhibitRowHighlight();
        this.setHighlightedIndex(this._highlightedIndex != null
            ? this._highlightedIndex + delta
            : Math.ceil(this._ui.rows.scrollTop() / this._itemHeight), true);
    },
    
    setHighlightedIndex: function(index, scrollToView) {
        if (index === this._highlightedIndex)
            return;
        
        this._highlightedIndex = index = Math.max(0, Math.min(index, this._cache.totalCount || 0));
        
        if (scrollToView) {
            var scrollTop = this._ui.rows.scrollTop(),
                scrollHeight = this._ui.rows.height();
            
            if ((this._highlightedIndex + 1) * this._itemHeight > scrollTop + scrollHeight)
                scrollTop = (this._highlightedIndex + 1) * this._itemHeight - scrollHeight;
            
            if (this._highlightedIndex * this._itemHeight < scrollTop)
                scrollTop = this._highlightedIndex * this._itemHeight;
            
            this._ui.rows.scrollTop(scrollTop).trigger("scroll");
        }
        
        this._ui.tbody.children().removeClass("highlighted").filter(function() {
            return $(this).data("index") === index;
        }).addClass("highlighted");
    },
    
    getItemIndex: function(id) {
        if (!id)
            return -1;
        
        return this._cache.getItemIndex(function(item) {
            return item.id === id;
        });
    },
    
    getItemByIndex: function(index, callback) {
        if (index < 0 || !this._cache.totalCount || index >= this._cache.totalCount) {
            callback(null);
            return;
        }
        
        return this._cache.ensureItems(index, 1, function() {
            callback(this._cache.items[index]);
        }.bind(this));
    },
    
    scrollTo: function(index, callback) {
        this._ui.rows.scrollTop(index * this._itemHeight);
        this.update(callback);
    },

    refresh: function(callback) {
        this._cache.clear();
        this._highlightedIndex = null;
        this._drawnPos = null;
        this.scrollTo(0, callback);
    },
    
    _setColumns: function(columns) {
        this._columns = columns;
        
        this._ui.headingRow.empty();
        
        columns.forEach(function(col) {
            this._ui.headingRow.append($("<th>").addClass(col.name).text(col.title));
        }, this);
    },
    
    _rowDblclick: function(e) {
        var tr = $(e.target).closest("tr");
        if (tr.length)
            this.onItemActivate.fire(tr.data("item"));
    },
    
    _inhibitRowHighlight: function() {
        this._rowHighlightInhibited = true;
        this._debouncedUninhibitRowHighlight();
    },
    
    _rowMouseOver: function(e) {
        if (!this._rowHighlightInhibited)
            this.setHighlightedIndex($(e.target).closest("tr").data("index"), false);
    },
    
    _resize: function() {
        // TODO: remove weird dependency
        
        this._ui.rows.height($(window).height() - this._ui.rows.offset().top - 10);
        
        this._ui.headingTable.width(this._ui.rows[0].clientWidth);
        this.update();
    }
};
