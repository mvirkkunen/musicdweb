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

ko.bindingHandlers.on = {
    init: function(el, valueAccessor, allBindingsAccessor, viewModel) {
        var el = $(el), events = valueAccessor() || {}, m;

        $.each(events, function(ev, handler) {
            if (!(m = ev.match(/^([^ ]+) (.+)/)))
                return;

            el.on(m[1], m[2], function() {
                var args = $.makeArray(arguments);
                args.unshift(ko.dataFor(this));
                handler.apply(viewModel, args);
            });
        });
    }
};

musicd.windowWidth = ko.observable(0);
musicd.windowHeight = ko.observable(0);

function updateWindowSize() {
    musicd.windowWidth($(window).width());
    musicd.windowHeight($(window).height());
}

$(window).on("resize", updateWindowSize);

var layoutSubscribable = new ko.subscribable();

musicd.notifyLayoutChange = function() {
    layoutSubscribable.notifySubscribers();
}

function offsetEqualityComparer(a, b) {
    return a && b && (a.left == b.left) && (a.top == b.top);
}

function createLayoutBindingHandler(name, equalityComparer) {
    ko.bindingHandlers[name] = {
        init: function(el, valueAccessor) {
            var value = valueAccessor();
            el = $(el);

            if (equalityComparer)
                value.equalityComparer = equalityComparer;

            layoutSubscribable.subscribe(function() {
                value(el[name]());
            });
        }
    };
};

$.fn.clientWidth = function(val) {
    if (val === undefined)
        return parseInt($(this).prop("clientWidth"), 10);

    $(this).prop("clientWidth", val + "px");
};

createLayoutBindingHandler("offset", offsetEqualityComparer);
createLayoutBindingHandler("clientWidth");
createLayoutBindingHandler("outerHeight");

ko.bindingHandlers.scrollTop = {
    init: function(el, valueAccessor, allBindingsAccessor) {
        var value = valueAccessor(), hysteresis = allBindingsAccessor().scrollTopHysteresis || 0;

        if (ko.isWriteableObservable(value)) {        
            value($(el).scrollTop());

            $(el).on("scroll", function() {
                var newValue = $(el).scrollTop();

                if (Math.abs(value() - newValue) >= hysteresis)
                    value($(el).scrollTop());
            });
        }
    },

    update: function(el, valueAccessor) {
        $(el).scrollTop(ko.utils.unwrapObservable(valueAccessor()));
    }
};

$(function() {
    updateWindowSize();
    musicd.notifyLayoutChange();
});

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

        this._setOptions({ min: 0, step: 0.1, range: "min", animate: "fast" });
        
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
    postInit: function (el, valueAccessor) {
        var value = valueAccessor(), dragging = false, jqel = $(el);

        if (value.timeValue) {
            jqel.on("timesliderstart.ko", function(ev, ui) {
                dragging = true;
            }).on("timesliderstop.ko", function(ev, ui) {
                dragging = false;

                value.timeValue(ui.value);
            });

            value.timeValue.subscribe(function(newValue) {
                newValue = Math.floor(newValue);

                if (!dragging && jqel.timeslider("value") != newValue)
                    jqel.timeslider("value", Math.floor(newValue));
            });
        }

        ko.utils.domNodeDisposal.addDisposeCallback(el, function () {
            jqel.off(".ko");
        });
    }
});

})();
