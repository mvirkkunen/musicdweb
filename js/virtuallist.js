musicd.VirtualList = function(el, rowProvider, columns) {
    this.el = $(el);
    this._rowProvider = rowProvider;
    
    this.el.addClass("virtual-list").append(
        this._headingTable = $("<table>").addClass("heading").append(
            $("<thead>").append(
                this._headingRow = $("<tr>"))),
        this._rows = $("<div>").addClass("rows").append(
            this._padder = $("<div>").addClass("padder"),
            this._table = $("<table>").append(
                this._tbody = $("<tbody>"))))
                
    this._throttleUpdate = $.throttle(500,
        (function() { this.update(); }).bind(this));
        
    this._selectedIds = {};
    this._setColumns(columns);
    this._itemHeight = this._headingRow.first().outerHeight();
    this._resize();
    
    this._version = 0;
    this.onitemactivate = null;
    
    this._rows.on("scroll", this._throttleUpdate);
    this._tbody.onmethod("dblclick", "td", this, "_rowDblclick");
    $(window).onmethod("resize", null, this, "_resize");
};

musicd.VirtualList.prototype = {
    setColumns: function(columns) {
        this._setColumns(columns);
        this.update();
    },
    
    update: function(callback) {
        var y = this.el.scrollTop(),
            eOffset = Math.max(0, Math.floor(y / this._itemHeight) - 20)
            offset = Math.floor(eOffset / 2) * 2,
            limit = Math.ceil(this.el.height() / this._itemHeight) + 40,
            version = (this._version = (this._version + 1) % 65536);
        
        this._rowProvider(offset, limit, function(totalCount, rows) {
            if (this._version == version) {
                this._tbody.empty();
                this._table.css("top", offset * this._itemHeight);
            
                this._padder.height(this._itemHeight * totalCount);
            
                rows.forEach(function(r, index) {
                    var tr = $("<tr>").data("item", r.item).data("id", r.id);
                    
                    this._columns.forEach(function(col) {
                        var val = r.item[col.name];
                        
                        if (col.formatter)
                            val = col.formatter(val);
                        
                        var td = $("<td>").text(val);
                        
                        if (val && val.length > 10)
                            td.attr("title", val);
                            
                        if (index == 0)
                            td.addClass(col.name);
                        
                        tr.append(td);
                    }, this);
                    
                    if (this._selectedIds[r.id])
                        tr.addClass("selected");
                    
                    this._tbody.append(tr)
                }, this);
            }
            
            if (callback)
                callback();
        }.bind(this));
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
    
    _setColumns: function(columns) {
        this._columns = columns;
        
        this._headingRow.empty();
        
        columns.forEach(function(col) {
            this._headingRow.append($("<th>").addClass(col.name).text(col.title));
        }, this);
    },
    
    _rowDblclick: function(e) {
        var tr = $(e.target).closest("tr");
        if (tr.length && this.onitemactivate)
            this.onitemactivate(tr.data("item"));
    },
    
    _resize: function() {
        // burqa?
        
        this._rows.height($(window).height() - this._rows.offset().top - 10);
        
        this._headingTable.width(this._rows[0].clientWidth);
        this._throttleUpdate();
    }
};
