"use strict";

(function() {

musicd.VirtualList = function(cache, columns, template) {
    var self = this;

    self.template = template;

    self._cache = cache;

    self._drawExtraItems = 50;

    self.columns = ko.observableArray(columns);
    self._items = ko.observableArray();

    self.selectedIds = ko.observableArray();
    self.currentId = ko.observable(null);

    self._highlightedIndex = ko.observable(null);

    self._inhibitItemHighlight = null;

    self._layout = {
        itemHeight: ko.observable(24),
        padderHeight: ko.observable(0),
        tableTop: ko.observable(0),
        itemsWidth: ko.observable(0),
        itemsOffset: ko.observable(0),
        itemsScrollTop: ko.observable(0)
    };

    self._layout.itemsScrollTop.equalityComparer = null;
    self._layout.itemsScrollTop = self._layout.itemsScrollTop.extend({ throttle: 50});

    self._layout.itemsHeight = ko.computed(function() {
        return (musicd.windowHeight() - self._layout.itemsOffset().top - 10);
    });

    self.itemActivate = new ko.subscribable();

    ko.computed(function() {
        self._layout.itemsHeight();
        self._layout.itemsScrollTop();

        self._refreshInternal();
    });
};

musicd.VirtualList.prototype = {
    refresh: function() {
        this._cache.clear();
        this._highlightedIndex(null);
        this._layout.itemsScrollTop(0);
        this._refreshInternal();
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

    _refreshInternal: function() {
        var self = this,
            visible = self._getVisibleRange(),
            completed = false;

        self._cache.ensureItems(visible.offset, visible.limit, function() {
            self._draw();

            completed = true;
        });

        if (!completed)
            self._draw();
    },

    _draw: function() {
        if (this._cache.totalCount === null)
            return;

        var pos = this._layout.itemsScrollTop();

        var visible = this._getVisibleRange(),
            offset = Math.max(0, visible.offset - this._drawExtraItems),
            limit = Math.min(visible.limit + this._drawExtraItems*2, this._cache.totalCount || 0);

        this._layout.tableTop(offset * this._layout.itemHeight());
        this._layout.padderHeight(this._layout.itemHeight() * (this._cache.totalCount || 0));

        var items = new Array(limit);
        for (var i = offset, ri = 0; i < offset + limit; i++, ri++)
            items[ri] = this._cache.items[i] || null;

        this._items(items);
    },

    _getVisibleRange: function() {
        var itemHeight = this._layout.itemHeight(),
            exactFirst = Math.floor(this._layout.itemsScrollTop() / itemHeight);

        return {
            offset: Math.floor(exactFirst / 2) * 2,
            limit: Math.ceil(this._layout.itemsHeight() / itemHeight) + 1
        };
    },

    _adjustHighlightedIndex: function(delta) {
        this._highlightedIndex(this._highlightedIndex() != null
            ? this._highlightedIndex() + delta
            : Math.ceil(this._layout.itemsScrollTop() / this._layout.itemHeight()), true);

        this.scrollToView();
    },

    _setScrollTop: function(scrollTop) {
        var self = this;

        clearTimeout(self._inhibitItemHighlight);
        self._inhibitItemHighlight = setTimeout(function() {
            self._inhibitItemHighlight = null;
        }, 200);

        self._layout.itemsScrollTop(scrollTop);
    },

    scrollToView: function() {
        var self = this,
            scrollTop = self._layout.itemsScrollTop(),
            scrollHeight = self._layout.itemsHeight(),
            highlightedIndex = self._highlightedIndex(),
            itemHeight = self._layout.itemHeight();

        if ((highlightedIndex + 1) * itemHeight > scrollTop + scrollHeight)
            scrollTop = (highlightedIndex + 1) * itemHeight - scrollHeight;

        if (highlightedIndex * itemHeight < scrollTop)
            scrollTop = highlightedIndex * itemHeight;

        clearTimeout(self._inhibitItemHighlight);
        self._inhibitItemHighlight = setTimeout(function() {
            self._inhibitItemHighlight = null;
        }, 200);

        self._setScrollTop(scrollTop);
    },

    presentIndex: function(index) {
        var scrollHeight = this._layout.itemsHeight(),
            itemHeight = this._layout.itemHeight(),
            topIndex = Math.max(index - Math.floor(scrollHeight  / itemHeight / 2), 0);

        this._setScrollTop(topIndex * itemHeight);
    },

    _itemDoubleClick: function(item) {
        if (item)
            this.itemActivate.notifySubscribers(item);
    },

    _itemMouseOver: function(item) {
        if (item && !this._inhibitItemHighlight)
            this._highlightedIndex(item.index);
    },

    _getItemClass: function(item) {
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

})();
