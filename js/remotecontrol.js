"use strict";

(function() {

var REMOTE_URL = "http://localhost:48278/";

musicd.RemoteControl = function(player) {
    this._player = player;
    this._player.state.subscribe(this._updateState, this);
};

musicd.RemoteControl.prototype = {
    enable: function() {
        if (this.eventSource)
            return;

        this.eventSource = new EventSource(REMOTE_URL + "events");
        this.eventSource.addEventListener("command", this._command.bind(this));
        this.eventSource.onopen = this._updateState.bind(this);

        this._updateState();
    },

    disable: function() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    },

    _updateState: function() {
        if (this.eventSource)
            $.post(REMOTE_URL + "state/" + musicd.PlayerState[this._player.state()].toLowerCase());
    },

    _command: function(e) {
        if (this.eventSource)
            this._player.execCommand(e.data);
    }
};

})();
