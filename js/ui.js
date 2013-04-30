"use strict";

(function() {

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

$.widget("ui.timeslider", $.ui.slider, {
    _create: function() {
        this._superApply(arguments);
        
        this.element.append(this._tsTime =
            $("<div>").addClass("slider-time")
                .append($("<div>"))
                .append(this._tsTimeText = $("<span>")).hide());
        
        this._tsMouseIn = false;
        
        this._on({
            mousemove: this._tsMouseMove,
            mouseenter: function() {
                this._tsMouseIn = true;
            },
            mouseleave: function() {
                this._tsMouseIn = false;
                
                if (!this._mouseSliding)
                    this._tsTime.hide();
            },
        });
    },
    
    _slide: function(e) {
        this._superApply(arguments);
        this._tsMouseMove(e);
    },
    
    _stop: function() {
        this._superApply(arguments);
        if (!this._tsMouseIn)
            this._tsTime.hide();
    },
    
    _tsMouseMove: function(e) {
        if (!this.elementSize) {
            this.elementSize = {
                width: this.element.outerWidth(),
                height: this.element.outerHeight()
            };
            this.elementOffset = this.element.offset();
        }
        
        var value = this._normValueFromMouse({x: e.pageX, y: e.pageY}),
            valPercent = (value - this._valueMin())
                / (this._valueMax() - this._valueMin()) * 100;
        
        this._tsTimeText.text(musicd.formatTime(value));
        this._tsTime.css({
            "marginLeft": -this._tsTime.outerWidth() / 2,
            "left": e.pageX - this.elementOffset.left
        }).show();
    }
});

// from kojqui

kojqui.bindingFactory.create({
    name: "timeslider",
    options: ["animate", "disabled", "max", "min", "orientation", "range", "step", "value", "values"],
    events: ["create", "start", "slide", "change", "stop"],
    postInit: function (element, valueAccessor) {
        var value = valueAccessor();

        if (ko.isWriteableObservable(value.value)) {
            $(element).on("timesliderstop.ko", function (ev, ui) {
                value.value(ui.value);
                value.value.notifySubscribers(ui.value, "manualChange");
            });
        }

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            $(element).off(".ko");
        });
    }
});

})();
