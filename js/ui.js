"use strict";

(function() {

ko.bindingHandlers.slideVisible = {
    init: function(el, valueAccessor) {
        $(el).toggle(ko.utils.unwrapObservable(valueAccessor()));
    },

    update: function(el, valueAccessor) {
        $(el)[ko.utils.unwrapObservable(valueAccessor()) ? "slideDown" : "slideUp"](200);
    }
};

ko.bindingHandlers.fadeVisible = {
    init: function(el, valueAccessor) {
        $(el).toggle(ko.utils.unwrapObservable(valueAccessor()));
    },

    update: function(el, valueAccessor) {
        $(el)[ko.utils.unwrapObservable(valueAccessor()) ? "fadeIn" : "fadeOut"](200);
    }
};

musicd.windowWidth = ko.observable(0);
musicd.windowHeight = ko.observable(0);

function updateWindowSize() {
    musicd.windowWidth($(window).width());
    musicd.windowHeight($(window).height());
}

$(window).on("resize", updateWindowSize);
$(updateWindowSize);

var layoutObservable = ko.observable(null);
layoutObservable.equalityComparer = null;

musicd.notifyLayoutChange = function() {
    layoutObservable(null);
}

$(musicd.notifyLayoutChange);

ko.bindingHandlers.offset = {
    init: function(el, valueAccessor) {
        var offset = $(el).offset(), value = valueAccessor();

        value(offset);

        layoutObservable.subscribe(function() {
            var offset = $(el).offset(), current = value();

            if (offset.top != current.top || offset.left != current.left)
                value(offset);
        });
    }
};

$.fn.onmethod = function(type, selector, object, method, preventDefault) {
    return this.on(type, selector, function(e) {
        if (preventDefault)
            e.preventDefault();

        return object[method].call(object, e, this);
    });
};

$.fn.pinHeight = function() {
    return $(this).each(function() {
        $(this).css("height", $(this).height());
    });
};

$.fn.animateNaturalHeight = function(speed) {
    return $(this).each(function() {
        var currentHeight = $(this).height(),
            naturalHeight = $(this).css("height", "auto").height();

        $(this).height(currentHeight).animate({ height: naturalHeight }, speed);
    });
};

var templateCache = {};

function collectIdElements(el, map) {
    var id = el.getAttribute("id") || el.getAttribute("data-id");

    if (!id) {
        var className = el.className;
        if (className) {
            var classBasedId = className.split(/ /)[0]
                .replace(/-([a-z])/g, function(m) { return m[1].toUpperCase(); })

            // Do not overwrite anything with class-based IDs
            if (!map[classBasedId])
                id = classBasedId;
        }
    }

    if (id)
        map[id] = $(el);

    var child;
    for (child = el.firstChild; child; child = child.nextSibling) {
        if (child.nodeType == Node.ELEMENT_NODE)
            collectIdElements(child, map);
    }
}

$.fn.elementMap = function(id) {
    var map = {};

    this.each(function() {
        collectIdElements(this, map);
    });

    return map;
};

$.template = function(id) {
    var el;

    if (!templateCache[id]) {
        el = $("#" + id);
        if (!el.length)
            throw new Error("Template '" + id + "' not found");

        templateCache[id] = el.html();
    }

    return $("<div>").html(templateCache[id]).find(">*");
};

$.fn.render = function(id) {
    return this.append($.template(id));
};

musicd.stopPropagation = function(e) {
    e.stopPropagation();
};

musicd.focusDefault = function() {
    if (musicd.defaultFocusElement
        && !musicd.defaultFocusElement.is(":focus"))
    {
        musicd.defaultFocusElement.focus();
    }
};

})();
