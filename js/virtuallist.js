musicd.VirtualList = function(el, rowProvider, columns) {
    this.el = $(el);
    this._rowProvider = $.throttle(500, rowProvider);
    
    this.el.addClass("virtual-list").append(
        this._headingTable = $("<table>").addClass("heading").append(
            $("<thead>").append(
                this._headingRow = $("<tr>"))),
        this._rows = $("<div>").addClass("rows").append(
            this._padder = $("<div>").addClass("padder"),
            this._table = $("<table>").append(
                this._tbody = $("<tbody>"))))
                
    this._version = 0;
    this._extraItems = 10;
    this._cache = [];
    this._totalCount = null;
    this._selectedIds = {};
    this._setColumns(columns);
    this._itemHeight = this._headingRow.first().outerHeight();
    this._resize();
    
    this.onItemActivate = new musicd.Event();
    
    this._rows.on("scroll", function() { this.update(); }.bind(this));
    this._tbody.onmethod("dblclick", "td", this, "_rowDblclick");
    $(window).onmethod("resize", null, this, "_resize");
};

musicd.VirtualList.prototype = {
    setColumns: function(columns) {
        this._setColumns(columns);
        this.update();
    },
    
    update: function(callback) {
        var y = this._rows.scrollTop(),
            eOffset = Math.max(0, Math.floor(y / this._itemHeight) - this._extraItems)
            offset = Math.floor(eOffset / 2) * 2,
            limit = Math.ceil(this.el.height() / this._itemHeight) + this._extraItems*2,
            version = (this._version = (this._version + 1) % 65536);
        
        var request = false;
        for (var i = offset; i < offset + limit; i++) {
            if (!this._cache[i]) {
                request = true;
                break;
            }
        }
        
        if (request) {
            this._rowProvider(offset, limit, function(totalCount, rows) {
                if (this._version == version) {
                    rows.forEach(function(r, index) {
                        this._cache[offset + index] = r;
                    }, this);

                    if (totalCount !== undefined && totalCount !== null)
                        this._totalCount = totalCount;

                    this._draw(offset, limit);

                    if (callback)
                        callback();
                }
            }.bind(this));
        } else {
            this._draw(offset, limit);

            if (callback)
                callback();
        }
    },

    _draw: function(offset, limit) {
        this._tbody.empty();
        this._table.css("top", offset * this._itemHeight);
    
        this._padder.height(this._itemHeight * (this._totalCount || 1000));
        
        for (var i = offset; i < offset + limit; i++) {
            var r = this._cache[i];
            if (!r)
                break;

            var tr = $("<tr>").data("item", r).data("id", r.id);;
            
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
        this.el.scrollTop(index * this._itemHeight);
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
    }
};
