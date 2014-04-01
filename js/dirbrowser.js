"use strict";

musicd.DirBrowser = function(main) {
    var self = this;

    self._main = main;

    self.path = ko.observableArray();
    self.path.push({
        path: "",
        urlPath: "",
        name: "",
        dirs: this._directoryObservable("")
    });

    self._layout = {
        areaOffset: ko.observable(0),
        levelsWidth: ko.computed(function() {
            var cols = self.path().length;

            if (!self.path()[self.path().length - 1].dirs())
                cols--;

            return cols * 300;
        })
    };

    self._layout.areaHeight = ko.computed(function() {
        return (musicd.windowHeight() - self._layout.areaOffset().top - 10);
    });
};

musicd.DirBrowser.prototype = {
    _directoryObservable: function(path) {
        var obs = ko.observable();

        musicd.api.call(
            "DirBrowser.path." + path,
            "root" + path,
            null,
            function(r) {
                if (!r.directories.length)
                    return;

                r.directories.sort(function(a, b) {
                    a = a.name.toLowerCase();
                    b = b.name.toLowerCase();

                    return (a < b) ? -1 : (a > b) ? 1 : 0;
                });

                obs(r.directories);
            }
        );

        return obs;
    },

    _isSelected: function(index, name) {
        return (this.path().length > index + 1) && (this.path()[index + 1].name == name);
    },

    _afterAddLevel: function(el, index, dir) {
        var root = $(el).closest(".dir-browser");

        dir.dirs.subscribe(function(dirs) {
            if (!dirs)
                return;

            root.stop(true, false).animate({
                scrollLeft: root.prop("scrollWidth") - root.innerWidth()
            }, 200);
        });
    },

    _itemSelect: function(d) {
        var urlPath;

        if (this.path().length <= d.index + 1 || this.path()[d.index + 1].name != d.dir.name) {
            urlPath = d.parent.urlPath + "/" + encodeURIComponent(d.dir.name);

            this.path.splice(d.index + 1, this.path().length - d.index - 1);
            this.path.push({
                path: d.parent.path + "/" + d.dir.name,
                urlPath: urlPath,
                name: d.dir.name,
                dirs: this._directoryObservable(urlPath)
            });
        }
    },

    _itemActivate: function(d) {
        this._main.search.search("directoryprefix:" + d.parent.path + "/" + d.dir.name);
        this._main.player.playFirst();
        this._main.currentTab("search");
    }
};
