"use strict";

(function() {

musicd.Settings = function Settings() {
    this._settings = {};
    this._loadSettings();
};

musicd.Settings.prototype = {
    get: function(key, defaultValue) {
        var val = this._settings[key];
        
        musicd.log(key, val);
        
        return (val !== undefined) ? val : defaultValue;
    },
    
    set: function(key, value) {
        musicd.log(key, value);
        
        this._settings[key] = value;
        this._saveSettings();
    },
    
    _loadSettings: function() {
        try {
            this._settings = JSON.parse(localStorage.getItem("musicd.settings") || "{}");
        } catch (e) {
            this._settings = {};
        }
    },
    
    _saveSettings: function() {
        localStorage.setItem("musicd.settings", JSON.stringify(this._settings));
    }
};

musicd.settings = new musicd.Settings();

})();
