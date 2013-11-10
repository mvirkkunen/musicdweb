"use strict";

(function() {

var REMOTE_URL = "http://localhost:48278/";

musicd.RemoteControl = function(player) {
    this._player = player;
    this._player.state.subscribe(this._updateState, this);
    this._player.track.subscribe(this._updateTrack, this);
};

musicd.RemoteControl.prototype = {
    enable: function() {
        if (this.eventSource)
            return;

        this.eventSource = new EventSource(REMOTE_URL + "events");
        this.eventSource.addEventListener("command", this._command.bind(this));
        this.eventSource.onopen = this._updateAll.bind(this);

        this._updateAll();
    },

    disable: function() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    },

    _updateAll: function() {
        this._updateState();
        this._updateTrack();
    },

    _updateState: function() {
        if (!this.eventSource)
            return;

        $.post(REMOTE_URL + "state/" + musicd.PlayerState[this._player.state()].toLowerCase());
    },

    _updateTrack: function() {
        if (!this.eventSource)
            return;

        var track = this._player.track(),
            url = REMOTE_URL + "track";

        if (track) {
            url += "?id=" + track.id
                + "&title=" + encodeURIComponent(track.title)
                + "&artist=" + encodeURIComponent(track.artist)
                + "&album=" + encodeURIComponent(track.album)
                + "&duration=" + encodeURIComponent(track.duration);
        } else {
            url += "?id=0";
        }

        $.post(url);
    },

    _command: function(e) {
        if (!this.eventSource)
            return;

        this._player.execCommand(e.data);
    }
};

})();
