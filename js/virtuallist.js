"use strict";

musicd.VirtualList = function(el, rowProvider, columns) {
    this.el = $(el);
    this._rowProvider = $.throttle(500, rowProvider);
    
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
    this._cache = [];
    this._totalCount = null;
    this._selectedIds = {};
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
            visFirst = Math.floor(exactFirst / 2) * 2,
            visLimit = Math.ceil(this._rows.height() / this._itemHeight) + 1,
            visLast = visFirst + visLimit,
            fullFirst = Math.max(0, visFirst - this._reqExtraItems),
            fullLast = visLast + this._reqExtraItems;
        
        if (this._totalCount !== null)
            fullLast = Math.min(this._totalCount, fullLast);
        
        var request = false, state = 0, reqFirst = fullFirst, reqLast = fullLast;
        for (var i = fullFirst; i < fullLast; i++) {
            if (state == 0) {
                if (!this._cache[i]) {
                    reqFirst = i;
                    request = true;
                    state++;
                }
            } else if (state == 1) {
                if (this._cache[i]) {
                    reqLast = i;
                    state++;
                }
            } else if (state == 2) {
                if (!this._cache[i]) {
                    reqLast = fullLast;
                    break;
                }
            }
        }
        
        if (request) {
            this._rowProvider(reqFirst, reqLast - reqFirst, function(totalCount, rows) {
                rows.forEach(function(r, index) {
                    this._cache[reqFirst + index] = r;
                }, this);
                
                if (totalCount !== undefined && totalCount !== null)
                    this._totalCount = totalCount;
        
                this._draw();
                
                if (callback)
                    callback();
            }.bind(this));
            
            this._draw();
        } else {
            this._draw();
            
            if (callback)
                callback();
        }
    },

    _draw: function() {
        // delicious copypasta
        
        if (this._totalCount === null)
            return;
        
        var exactFirst = Math.floor(this._rows.scrollTop() / this._itemHeight),
            visFirst = Math.floor(exactFirst / 2) * 2,
            visLimit = Math.ceil(this._rows.height() / this._itemHeight) + 1,
            offset = Math.max(0, visFirst - this._drawExtraItems),
            limit = Math.min(visLimit + this._drawExtraItems*2, this._totalCount);
            
        this._tbody.empty();
        this._table.css("top", offset * this._itemHeight);
    
        this._padder.height(this._itemHeight * (this._totalCount || 1000));
        
        for (var i = offset; i < offset + limit; i++) {
            var r = this._cache[i],
                tr = $("<tr>");
            
            if (r) {
                tr.data("item", r).data("id", r.id);;
                
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
    
    scrollTo: function(index) {
        this._rows.scrollTop(index * this._itemHeight);
        this.update();
    },

    refresh: function() {
        this._cache = [];
        this._totalCount = null;
        this.scrollTo(0);
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
        // burqa?
        
        this._rows.height($(window).height() - this._rows.offset().top - 10);
        
        this._headingTable.width(this._rows[0].clientWidth);
        this.update();
    }
};
