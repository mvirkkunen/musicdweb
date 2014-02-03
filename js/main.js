"use strict";

(function() {

var theAWord = "\x61\x6a\x61\x78";
$.request = $[theAWord];
$[theAWord + "Setup"]({
   crossDomain: true
});

musicd.shader = {
    show: function() {
        $("#shader").fadeIn(200);
    },

    hide: function() {
        $("#shader").fadeOut(200);
    }
};

musicd.authenticate = function(api) {

};

musicd.checkCompatibility = function() {
    var reasons = [];

    if (!(Array.prototype.forEach && window.JSON && window.localStorage))
        reasons.push("your browser doesn't seem to support modern JavaScript! Shame on you!");

    if (!window.Audio)
        reasons.push("your browser doesn't seem to support HTML5 Audio. Shame on you!");
    else if (!new Audio().canPlayType("audio/mpeg"))
        reasons.push("your browser doesn't seem to support MP3. Vorbis support is on the TODO list!");

    if (reasons.length)
        $("#invalid-browser").show().find(".reason").text(reasons.join(", "));
};

musicd.Main = function() {
    var self = this;

    self.player = new musicd.Player();
    self.search = new musicd.Search(self.player);
    self.albumBrowser = new musicd.AlbumBrowser(self);
    self.imageViewer = new musicd.ImageViewer(self);
    self.trackInfo = new musicd.TrackInfo(self);
    self.remoteControl = new musicd.RemoteControl(self.player);

    self.enableRemoteControl = musicd.setting("Main.enableRemoteControl", false);
    ko.computed(function() {
        self.remoteControl[self.enableRemoteControl() ? "enable" : "disable"]();
    });

    // TODO: remove weird URL param
    self.currentTab = ko.observable(location.href.match(/\balbums\b/) ? "albumBrowser" : "search");

    self.tabs = [
        { name: "search", text: "Tracks" },
        { name: "albumBrowser", text: "Albums" },
        { name: "settings", text: "Settings" },
        {
            name: "imageViewer",
            text: "Images",
            visible: self.imageViewer.album
        }
    ]

    self.tabClick = function(tab) {
        self.currentTab(tab.name);
    };

    setTimeout(function() {
        self.currentTab.subscribe(musicd.notifyLayoutChange)
    }, 0);
};

musicd.Main.prototype = {
    loadQueryString: function() {
        var self = this;

        var m = location.href.match(/#(.+)$/);
        if (m) {
            var args = musicd.parseQueryString(m[1]);

            if (args.mode)
                self.player.mode(musicd.PlayerMode[args.mode]);

            if (args.search)
                self.search.search(args.search);

            if (args.trackid) {
                self.search.getItem(parseInt(args.trackid, 10), function(track) {
                    if (track) {
                        self.player.track(track);

                        if (args.autoplay)
                            self.player.play();
                    }
                });
            }
        }
    },

    authenticate: function() {
        // TODO: Make this use knockout as well

        var dialog = $("#authentication");
        if (dialog.is(":visible"))
            return;

        function auth(e) {
            e.preventDefault();

            dialog.find(".error").hide();

            var user = $(".user").val();

            musicd.api.authenticate(
                user,
                dialog.find(".password").val(),
                function() {
                    dialog.off("click dblclick");
                    dialog.find("form").off("submit");
                    dialog.fadeOut();
                    musicd.shader.hide();
                    $("#server-status").fadeIn();
                    $("#server-status .user").text(user);
                },
                function() {
                    dialog.find(".error").slideDown();
                    dialog.find(user ? ".password" : ".user").focus().select();
                }
            );
        }

        musicd.shader.show();

        dialog.on("click dblclick", musicd.stopPropagation);
        dialog.fadeIn()
        dialog.find(".error").hide();
        dialog.find("input[type=text]").eq(0).focus();
        dialog.find("form").on("submit", auth);
    },

    logOut: function() {
        document.cookie = "musicd-session=; expires=Sat, 1 Jan 2000 00:00:00 GMT";

        location.reload();
    },

    linkToCurrentClick: function() {
        location.href = "#" + this._serializeState();
    },

    _serializeState: function() {
        var args = [];

        args.push("search=" + encodeURIComponent(this.search.search()));

        if (this.player.track())
            args.push("trackid=" + this.player.track().id);

        if (this.player.mode() != musicd.PlayerMode.NORMAL)
            args.push("mode=" + musicd.PlayerMode[this.player.mode()]);

        if (this.player.state() == musicd.PlayerState.PLAY)
            args.push("autoplay");

        return args.join("&");
    }
};

$(function() {
    musicd.checkCompatibility();

    var m = location.href.match(/\?([^#]+)/),
        qs = m ? musicd.parseQueryString(m[1]) : {};

    var main = new musicd.Main();

    musicd.api = new musicd.APIClient(qs.server || "/", main.authenticate.bind(main));

    main.loadQueryString();

    ko.applyBindings(main);
    ko.applyBindings(main.player.state, $("#favicon")[0]);
});

})();
