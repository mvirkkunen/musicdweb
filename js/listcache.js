"use strict";

musicd.ListCache = function(itemProvider, pageSize) {
    this._itemProvider = itemProvider;
    this._pageSize = pageSize || 100;
    this.clear();
};

musicd.ListCache.prototype = {
    clear: function() {
        this.totalCount = null;
        this._totalPages = null;
        this.items = [];
        this._loaded = {};
    },
    
    getRandomItem: function(callback) {
        var haveTotalCount = function() {
            var index = Math.floor(Math.random() * this.totalCount);
            
            this.ensureItems(index, 1, function() {
                callback(this.items[index]);
            }.bind(this));
        }.bind(this);
        
        if (this.totalCount === undefined)
            this.ensureItems(0, 1, haveTotalCount);
        else
            haveTotalCount();
    },

    getItemIndex: function(id) {
        for (var page in this._loaded) {
            for (var i = page * this._pageSize, e = (page + 1) * this._pageSize;
                 i < e;
                 i++)
            {
                if (this.items[i] && this.items[i].id === id)
                    return i;
            }
        }

        return null;
    },

    getItemByIndex: function(index, callback) {
        if (index < 0 || !this.totalCount || index >= this.totalCount) {
            callback(null);
            return;
        }

        return this.ensureItems(index, 1, function() {
            callback(this.items[index]);
        }.bind(this));
    },

    ensureItems: function(offset, limit, callback) {
        var request = false, state = 0, i,
            exactFirstPage = Math.floor(offset / this._pageSize),
            firstPage = Math.max(exactFirstPage, 0),
            lastPage = Math.ceil((offset + limit) / this._pageSize),
            first, last;
        
        if (this._totalPages)
            lastPage = Math.min(lastPage, this._totalPages);
        
        for (i = firstPage; i < lastPage; i++) {
            if (state == 0) {
                if (!this._loaded[i]) {
                    first = i;
                    last = lastPage;
                    request = true;
                    state++;
                }
            } else if (state == 1) {
                if (this._loaded[i]) {
                    last = i;
                    state++;
                }
            } else if (state == 2) {
                if (!this._loaded[i]) {
                    last = lastPage;
                    break;
                }
            }
        }
        
        if (request) { 
            var reqOffset = first * this._pageSize;
            
            this._itemProvider.getItems(
                reqOffset,
                (last - first) * this._pageSize,
                this.totalCount === null,
                function(totalCount, items) {
                    for (i = firstPage; i < lastPage; i++)
                        this._loaded[i] = true;
                    
                    items.forEach(function(item, index) {
                        item.index = reqOffset + index;
                        this.items[reqOffset + index] = item;
                    }, this);
                    
                    if (typeof totalCount == "number") {
                        this.totalCount = totalCount;
                        this._totalPages = Math.max(Math.ceil(totalCount / this._pageSize), 1);
                    }
                    
                    if (callback)
                        callback();
                }.bind(this)
            );
        } else {
            if (callback)
                callback();
        }
    }
};
