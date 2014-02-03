"use strict";

musicd.ImageViewer = function(main) {
    var self = this;

    self._main = main;

    self.images = ko.observableArray();
    self.album = ko.observable(null);

    ko.computed(function() {
        var album = self.album();

        if (!album) {
            self.images([]);
            return;
        }

        musicd.api.call(
            "ImageViewer.images",
            "album/images",
            { id: album.id },
            function(res) {
                self.images(res.images);
            }
        );
    });
};

musicd.ImageViewer.prototype = {
    showAlbum: function(album) {
        this.album(null);
        this.album(album);

        this._main.currentTab("imageViewer");
    },

    getImageUrl: function(id, size) {
        return musicd.api.getImageURL(id, size);
    }
};
