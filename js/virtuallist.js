"use strict";

musicd.VirtualList = function(el, rowProvider, columns) {
    this.el = $(el);
    this._cache = new ListCache($.throttle(500, rowProvider));
    
    this.el.addClass("virtual-list").append(
        this._menuButton = $("<a>")
            .addClass("menu-button")
            .attr("href", "#")
            .click(function(e) {
                e.preventDefault();
                $(this).animate({ right: "+=80" }, 200);
            })
            .text("▼"),
        this._headingTable = $("<table>").addClass("heading").append(
            $("<thead>").append(
                this._headingRow = $("<tr>"))),
        this._rows = $("<div>").addClass("rows").append(
            this._padder = $("<div>").addClass("padder").append(
                this._table = $("<table>").append(
                    this._tbody = $("<tbody>")))));
                
    this._reqExtraItems = 100;
    this._drawExtraItems = 40;
    this._selectedIds = {};
    this._currentId = null;
    this._setColumns(columns);
    this._itemHeight = this._headingRow.first().outerHeight();
    this._resize();
    
    this.onItemActivate = new musicd.Event();
    
    this._rows.on("scroll", $.debounce(100, function() { this.update(); }).bind(this));
    this._tbody.onmethod("dblclick", "td", this, "_rowDblclick");
    $(window).onmethod("resize", null, this, "_resize");
};

musicd.VirtualList.prototype = {
    setColumns: function(columns) {
        this._setColumns(columns);
        this.update();
    },
    
    update: function(callback) {
        var exactFirst = Math.floor(this._rows.scrollTop() / this._itemHeight),
            visOffset = Math.floor(exactFirst / 2) * 2,
            visLimit = Math.ceil(this._rows.height() / this._itemHeight) + 1,
            completed = false;
        
        this._cache.ensureItems(visOffset, visLimit, function() {
            this._draw();
            
            if (callback)
                callback();
            
            completed = true;
        }.bind(this));
        
        if (!completed)
            this._draw();
    },

    _draw: function() {
        if (this._cache.cleared)
            return;
            
        // delicious copypasta
        
        var exactFirst = Math.floor(this._rows.scrollTop() / this._itemHeight),
            visOffset = Math.floor(exactFirst / 2) * 2,
            visLimit = Math.ceil(this._rows.height() / this._itemHeight) + 1,
            offset = Math.max(0, visOffset - this._drawExtraItems),
            limit = Math.min(visLimit + this._drawExtraItems*2, this._cache.totalCount || 0);
                    
        this._tbody.empty();
        this._table.css("top", offset * this._itemHeight);
    
        this._padder.height(this._itemHeight * (this._cache.totalCount || 0));
        
        for (var i = offset; i < offset + limit; i++) {
            var r = this._cache.items[i],
                tr = $("<tr>");
            
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
            
            this._tbody.append(tr)
        }
    },
    
    clearSelection: function() {
        this._selectedIds = {};
        
        this._tbody.children().removeClass("selected");
    },
    
    setItemSelected: function(id, selected) {
        if (selected)
            this._selectedIds[id] = true;
        else
            delete this._selectedIds[id];
        
        this._tbody.children().each(function(index, tr) {
            tr = $(tr);
            
            if (tr.data("id") == id) {
                tr.toggleClass("selected", selected);
                return false;
            }
        }.bind(this));
    },
    
    setCurrentItem: function(id) {
        this._currentId = id;
        
        this._draw();
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
        this._rows.scrollTop(index * this._itemHeight);
        this.update(callback);
    },

    refresh: function(callback) {
        this._cache.clear();
        this.scrollTo(0, callback);
    },
    
    _setColumns: function(columns) {
        this._columns = columns;
        
        this._headingRow.empty();
        
        columns.forEach(function(col) {
            this._headingRow.append($("<th>").addClass(col.name).text(col.title));
        }, this);
    },
    
    _rowDblclick: function(e) {
        var tr = $(e.target).closest("tr");
        if (tr.length)
            this.onItemActivate.fire(tr.data("item"));
    },
    
    _resize: function() {
        // TODO: weird dependency
        
        this._rows.height($(window).height() - this._rows.offset().top - 10);
        
        this._headingTable.width(this._rows[0].clientWidth);
        this.update();
    }
};
