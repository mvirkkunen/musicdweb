"use strict";

(function() {

var theAWord = "\x61\x6a\x61\x78";
$.request = $[theAWord];
$[theAWord + "Setup"]({
   xhrFields: { withCredentials: true},
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
    var dialog = $("#authentication");
    if (dialog.is(":visible"))
        return;
        
    function auth(e) {
        e.preventDefault();
        
        dialog.find(".error").hide();
        
        var user = $(".user").val();
        
        api.authenticate(
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
};

musicd.logOut = function() {
    document.cookie = "musicd-session=; expires=Sat, 1 Jan 2000 00:00:00 GMT";

    location.reload();
};

musicd.checkCompatibility = function() {
    var reasons = [];

    if (!(Array.prototype.forEach && window.JSON && window.localStorage))
        reasons.push("your browser doesn't seem to support modern JavaScript! Shame on you!");
    
    if (!window.Audio)
        reasons.push("your browser doesn't seem to support HTML5 Audio. Shame on you!");
    
    if (!new Audio().canPlayType("audio/mpeg"))
        reasons.push("your browser doesn't seem to support MP3. Vorbis support is on the TODO list!");
    
    if (reasons.length)
        $("#invalid-browser").show().find(".reason").text(reasons.join(", "));
};

musicd.loadQueryString = function(player, search) {
    var m = location.href.match(/#(.+)$/);
    if (m) {
        var args = musicd.parseQueryString(m[1]);

        if (args.mode)
            player.mode(musicd.PlayerMode[args.mode]);

        if (args.search)
            search.search(args.search);

        if (args.trackid) {
            search.getItem(parseInt(args.trackid, 10), function(track) {
                if (track) {
                    player.track(track);

                    if (args.autoplay)
                        player.play();
                }
            });
        }
    }
};

musicd.serializeState = function(player, search) {
    var args = [];

    args.push("search=" + encodeURIComponent(search.search()));

    if (player.track())
        args.push("trackid=" + player.track().id);

    if (player.mode() != musicd.PlayerMode.NORMAL)
        args.push("mode=" + musicd.PlayerMode[player.mode()]);

    if (player.state() == musicd.PlayerState.PLAY)
        args.push("autoplay");

    return args.join("&");
};

$(function() {
    musicd.checkCompatibility();
    
    var m = location.href.match(/\?([^#]+)/),
        qs = m ? musicd.parseQueryString(m[1]) : {};

    musicd.api = new musicd.APIClient(qs.server || "/", musicd.authenticate);
    
    var player = new musicd.Player();
    var search = new musicd.Search(player);
    var trackInfo = new musicd.TrackInfo(player.track, search.search);

    musicd.loadQueryString(player, search);

    // ugh
    musicd.linkToCurrentClick = function() {
        location.href = "#" + musicd.serializeState(player, search);
    };

    ko.applyBindings(player, $("#player")[0]);
    ko.applyBindings(player.state, $("#favicon")[0]);

    ko.applyBindings(trackInfo, $("#track-info")[0]);
    
    ko.applyBindings(search, $("#search")[0]);
});

})();
