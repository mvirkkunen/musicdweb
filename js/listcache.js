"use strict";

var ListCache = function(itemProvider, pageSize, extraPages) {
    this._itemProvider = itemProvider; // function(offset, limit, callback(totalCount, items))
    this._pageSize = pageSize || 20;
    this._extraPages = extraPages || 5;
    this._version = 0;
    this.clear();
};

ListCache.prototype = {
    clear: function() {
        this.totalCount = null;
        this._totalPages = null;
        this.cleared = true;
        this._version = (this._version + 1) % 65536;
        this.items = [];
        this._loaded = {};
    },
    
    getItemIndex: function(predicate) {
        for (var page in this._loaded) {
            for (var i = page * this._pageSize, e = (page + 1) * this._pageSize;
                 i < e;
                 i++)
            {
                if (this.items[i] && predicate(this.items[i]))
                    return i;
            }
        }
        
        return -1;
    },
    
    ensureItems: function(offset, limit, callback) {
        var request = false, state = 0, i,
            exactFirstPage = Math.floor(offset / this._pageSize),
            firstPage = Math.max(exactFirstPage - this._extraPages, 0),
            lastPage = exactFirstPage + Math.ceil(limit / this._pageSize) + this._extraPages,
            first, last,
            version = this._version;
        
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
            
            this._itemProvider(
                reqOffset,
                (last - first) * this._pageSize,
                function(totalCount, items) {
                    if (this._version != version)
                        return;
                    
                    this.cleared = false;
                    
                    for (i = firstPage; i < lastPage; i++)
                        this._loaded[i] = true;
                    
                    items.forEach(function(item, index) {
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
    },
    
    _ensureItems: function(offset, limit, callback) {
        var request = false, state = 0,
            fullFirst = offset, fullLast = offset + limit,
            first, last;
        
        for (var i = fullFirst; i < fullLast; i++) {
            if (state == 0) {
                if (!this.items[i]) {
                    first = i;
                    last = fullLast;
                    request = true;
                    state++;
                }
            } else if (state == 1) {
                if (this.items[i]) {
                    last = i;
                    state++;
                }
            } else if (state == 2) {
                if (!this.items[i]) {
                    last = fullLast;
                    break;
                }
            }
        }
        
        if (request) {
            this._itemProvider(first, last - first, function(totalCount, items) {
                this.cleared = false;
                
                items.forEach(function(item, index) {
                    this.items[first + index] = item;
                }, this);
                
                if (typeof totalCount == "number")
                    this.totalCount = totalCount;
        
                callback();
            }.bind(this));
        } else {
            callback();
        }
    }
};
