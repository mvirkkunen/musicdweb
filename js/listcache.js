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
        this._inFlight = {};
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

    _getCachedItemIndex: function(id) {
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

    getItemIndex: function(id, callback) {
        var self = this,
            index = self._getCachedItemIndex(id);

        if (index !== null) {
            callback(index);
            return;
        }

        this._itemProvider.getItemIndex(id, callback);
    },

    getItemByIndex: function(index, callback) {
        if (index < 0 || (this.totalCount !== null && index >= this.totalCount)) {
            callback(null);
            return;
        }

        return this.ensureItems(index, 1, function() {
            callback(index < this.totalCount
                ? this.items[index]
                : null);
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

        var key = first + "-" + last;

        if (request) {
            if (this._inFlight[key]) {
                if (callback)
                    this._inFlight[key].push(callback);

                return;
            } else {
                this._inFlight[key] = [callback];
            }

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

                    this._requestComplete(key);
                }.bind(this)
            );
        } else {
            if (callback)
                callback();
        }
    },

    _requestComplete: function(key) {
        this._inFlight[key].forEach(function(callback) {
            callback();
        });

        delete this._inFlight[key];
    }
};
