"use strict";

(function() {

window.musicd = {};

if (!Array.prototype.find) {
    Array.prototype.find = function(callback, thisObject) {
        for (var i = 0; i < this.length; i++) {
            if (callback.call(thisObject || window, this[i], i, this))
                return this[i];
        }

        return undefined;
    };
}

if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(callback, thisObject) {
        for (var i = 0; i < this.length; i++) {
            if (callback.call(thisObject || window, this[i], i, this))
                return i;
        }

        return -1;
    };
}

Number.prototype.pad = function(length) {
    var s = "" + this;
    while (s.length < length)
        s = "0" + s;

    return s;
};

musicd.log = function() {
    if (window.console && console.log) {
        try {
            console.log.apply(console, arguments);
        } catch (e) {
            console.log(Array.prototype.join.call(arguments, ","));
        }
    }
};

musicd.makeEnum = function() {
    var values = $.makeArray(arguments);

    for (var i = 0; i < values.length; i++)
        values[values[i]] = i;

    return values;
};

musicd.formatTime = function(time, lengthHint) {
    if (!time)
        return "00:00";

    var s = (Math.floor((time % 3600) / 60).pad(2) + ":" +
        Math.floor(time % 60).pad(2));

    if ((lengthHint || time) >= 3600)
        s = Math.floor(time / 3600).pad(2) + ":" + s;

    return s;
};

musicd.parseQueryString = function(qs) {
    var r = {};

    qs.split(/&/).forEach(function(pair) {
        var p = pair.indexOf("=");
        if (p == -1)
            r[decodeURIComponent(pair)] = true;
        else
            r[decodeURIComponent(pair.substr(0, p))] = decodeURIComponent(pair.substr(p + 1));
    });

    return r;
};

musicd.objectEquals = function(a, b) {
    if (!!a != !!b)
        return false;

    var key;
    for (key in a) {
        if (a[key] !== b[key])
            return false;
    }

    for (key in b) {
        if (a[key] !== b[key])
            return false;
    }

    return true;
};

var settings;

try {
    settings = JSON.parse(localStorage.getItem("musicd.settings") || "{}");
} catch (e) {
    settings = {};
}

musicd.setting = function(key, defaultValue) {
    var val = settings[key],
        obs = ko.observable(val !== undefined ? val : defaultValue);

    obs.subscribe(function(value) {
        settings[key] = value;
        localStorage.setItem("musicd.settings", JSON.stringify(settings));
    });

    return obs;
};

ko.extenders.integer = function(target) {
    var computed = ko.computed({
        read: target,
        write: function(value) {
            target(parseInt(value, 10));
        }
    });

    computed(target());

    return computed;
};

ko.lazyObservable = function(instantiator) {
    var value = ko.observable(),
        obs = ko.computed({
            read: function() {
                var v = value();
                if (!v)
                    value(v = instantiator());

                return v;
            },
            deferEvaluation: true
        });

    obs.peek = value;

    return obs;
};

})();
