"use strict";

musicd.VirtualList = function(cache, columns) {
    var self = this;

    self._cache = cache;
    
    self._drawExtraItems = 50;

    self.columns = ko.observableArray(columns);
    self._rows = ko.observableArray();
    
    self.selectedIds = ko.observableArray();
    self.currentId = ko.observable(null);

    self._highlightedIndex = ko.observable(null);
    
    self._layout = {
        itemHeight: ko.observable(20),
        padderHeight: ko.observable(0),
        tableTop: ko.observable(0),
        rowsWidth: ko.observable(0),
        rowsOffset: ko.observable(0),
        rowsScrollTop: ko.observable(0).extend({ throttle: 100 })
    };

    self._layout.rowsHeight = ko.computed(function() {
        return (musicd.windowHeight() - self._layout.rowsOffset().top - 10);
    });
    
    self.itemActivate = new ko.subscribable();

    ko.computed(function() {
        self._layout.rowsHeight();
        self._layout.rowsScrollTop();

        var visible = self._getVisibleRange(),
            completed = false;
        
        self._cache.ensureItems(visible.offset, visible.limit, function() {
            self._draw();
            
            completed = true;
        });
        
        if (!completed)
            self._draw();
    });
};

musicd.VirtualList.prototype = {
    refresh: function(callback) {
        this._cache.clear();
        this._highlightedIndex(null);
        this.scrollTo(0, callback);
    },
    
    handleKeyEvent: function(data, e) {
        var self = this;

        if (e.which == $.ui.keyCode.UP) {
            self._adjustHighlightedIndex(-1);
        } else if (e.which == $.ui.keyCode.DOWN) {
            self._adjustHighlightedIndex(1);
        } else if (e.which == $.ui.keyCode.PAGE_UP) {
            self._adjustHighlightedIndex(-10);
        } else if (e.which == $.ui.keyCode.PAGE_DOWN) {
            self._adjustHighlightedIndex(10);
        } else if (e.which == $.ui.keyCode.ENTER) {
            self._cache.ensureItems(this._highlightedIndex(), 1, function() {
                var item = self._cache.items[self._highlightedIndex()];
                if (item)
                    self.itemActivate.notifySubscribers(item);
            });
        }

        return true;
    },

    _draw: function() {
        if (this._cache.totalCount === null)
            return;

        var pos = this._layout.rowsScrollTop();

        var visible = this._getVisibleRange(),
            offset = Math.max(0, visible.offset - this._drawExtraItems),
            limit = Math.min(visible.limit + this._drawExtraItems*2, this._cache.totalCount || 0);

        musicd.log("draw!" + new Date + " " + visible.offset + " " + visible.limit);

        this._layout.tableTop(offset * this._layout.itemHeight());
        this._layout.padderHeight(this._layout.itemHeight() * (this._cache.totalCount || 0));
        
        var rows = new Array(limit);

        for (var i = offset, ri = 0; i < offset + limit; i++, ri++)
            rows[ri] = this._cache.items[i] || null;

        this._rows(rows);
    },

    _getVisibleRange: function() {
        var itemHeight = this._layout.itemHeight(),
            exactFirst = Math.floor(this._layout.rowsScrollTop() / itemHeight);

        return {
            offset: Math.floor(exactFirst / 2) * 2,
            limit: Math.ceil(this._layout.rowsHeight() / itemHeight) + 1
        };
    },
    
    _adjustHighlightedIndex: function(delta) {
        this._highlightedIndex(this._highlightedIndex() != null
            ? this._highlightedIndex() + delta
            : Math.ceil(this._layout.rowsScrollTop() / this._layout.itemHeight()), true);

        this.scrollToView();
    },

    scrollToView: function() {
        var scrollTop = this._layout.rowsScrollTop(),
            scrollHeight = this._layout.rowsHeight(),
            highlightedIndex = this._highlightedIndex(),
            itemHeight = this._layout.itemHeight();
        
        if ((highlightedIndex + 1) * itemHeight > scrollTop + scrollHeight)
            scrollTop = (highlightedIndex + 1) * itemHeight - scrollHeight;
        
        if (highlightedIndex * itemHeight < scrollTop)
            scrollTop = highlightedIndex * itemHeight;
        
        this._layout.rowsScrollTop(scrollTop);
    },

    scrollTo: function(index) {
        this._layout.rowsScrollTop(index * this._layout.itemHeight());
    },
    
    _rowDoubleClick: function(item) {
        if (item)
            this.itemActivate.notifySubscribers(item);
    },
    
    _rowMouseOver: function(item) {
        if (item)
            this._highlightedIndex(item.index);
    },

    _getRowClass: function(item) {
        if (!item)
            return "loading";

        var classes = [];

        if (item.index === this._highlightedIndex())
            classes.push("highlighted");

        if (item.id === this.currentId())
            classes.push("current");

        return classes.join(" ");
    },

    _formatCellText: function(col, item) {
        if (!item)
            return null;

        var value = item[col.name];

        return col.formatter ? col.formatter(value) : value;
    }
};
