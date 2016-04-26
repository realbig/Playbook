!function ($) {
  "use strict";

  var FOUNDATION_VERSION = '6.1.0';

  // Global Foundation object
  // This is attached to the window, or used as a module for AMD/Browserify
  var Foundation = {
    version: FOUNDATION_VERSION,

    /**
     * Stores initialized plugins.
     */
    _plugins: {},

    /**
     * Stores generated unique ids for plugin instances
     */
    _uuids: [],
    /**
     * Stores currently active plugins.
     */
    _activePlugins: {},

    /**
     * Returns a boolean for RTL support
     */
    rtl: function () {
      return $('html').attr('dir') === 'rtl';
    },
    /**
     * Defines a Foundation plugin, adding it to the `Foundation` namespace and the list of plugins to initialize when reflowing.
     * @param {Object} plugin - The constructor of the plugin.
     */
    plugin: function (plugin, name) {
      // Object key to use when adding to global Foundation object
      // Examples: Foundation.Reveal, Foundation.OffCanvas
      var className = name || functionName(plugin);
      // Object key to use when storing the plugin, also used to create the identifying data attribute for the plugin
      // Examples: data-reveal, data-off-canvas
      var attrName = hyphenate(className);

      // Add to the Foundation object and the plugins list (for reflowing)
      this._plugins[attrName] = this[className] = plugin;
    },
    /**
     * @function
     * Creates a pointer to an instance of a Plugin within the Foundation._activePlugins object.
     * Sets the `[data-pluginName="uniqueIdHere"]`, allowing easy access to any plugin's internal methods.
     * Also fires the initialization event for each plugin, consolidating repeditive code.
     * @param {Object} plugin - an instance of a plugin, usually `this` in context.
     * @fires Plugin#init
     */
    registerPlugin: function (plugin, name) {
      var pluginName = name ? hyphenate(name) : functionName(plugin.constructor).toLowerCase();
      plugin.uuid = this.GetYoDigits(6, pluginName);

      if (!plugin.$element.attr('data-' + pluginName)) {
        plugin.$element.attr('data-' + pluginName, plugin.uuid);
      }
      if (!plugin.$element.data('zfPlugin')) {
        plugin.$element.data('zfPlugin', plugin);
      }
      /**
       * Fires when the plugin has initialized.
       * @event Plugin#init
       */
      plugin.$element.trigger('init.zf.' + pluginName);

      this._uuids.push(plugin.uuid);

      return;
    },
    /**
     * @function
     * Removes the pointer for an instance of a Plugin from the Foundation._activePlugins obj.
     * Also fires the destroyed event for the plugin, consolidating repeditive code.
     * @param {Object} plugin - an instance of a plugin, usually `this` in context.
     * @fires Plugin#destroyed
     */
    unregisterPlugin: function (plugin) {
      var pluginName = hyphenate(functionName(plugin.$element.data('zfPlugin').constructor));

      this._uuids.splice(this._uuids.indexOf(plugin.uuid), 1);
      plugin.$element.removeAttr('data-' + pluginName).removeData('zfPlugin')
      /**
       * Fires when the plugin has been destroyed.
       * @event Plugin#destroyed
       */
      .trigger('destroyed.zf.' + pluginName);
      for (var prop in plugin) {
        plugin[prop] = null; //clean up script to prep for garbage collection.
      }
      return;
    },

    /**
     * @function
     * Causes one or more active plugins to re-initialize, resetting event listeners, recalculating positions, etc.
     * @param {String} plugins - optional string of an individual plugin key, attained by calling `$(element).data('pluginName')`, or string of a plugin class i.e. `'dropdown'`
     * @default If no argument is passed, reflow all currently active plugins.
     */
    reInit: function (plugins) {
      var isJQ = plugins instanceof $;
      try {
        if (isJQ) {
          plugins.each(function () {
            $(this).data('zfPlugin')._init();
          });
        } else {
          var type = typeof plugins,
              _this = this,
              fns = {
            'object': function (plgs) {
              plgs.forEach(function (p) {
                $('[data-' + p + ']').foundation('_init');
              });
            },
            'string': function () {
              $('[data-' + plugins + ']').foundation('_init');
            },
            'undefined': function () {
              this['object'](Object.keys(_this._plugins));
            }
          };
          fns[type](plugins);
        }
      } catch (err) {
        console.error(err);
      } finally {
        return plugins;
      }
    },

    /**
     * returns a random base-36 uid with namespacing
     * @function
     * @param {Number} length - number of random base-36 digits desired. Increase for more random strings.
     * @param {String} namespace - name of plugin to be incorporated in uid, optional.
     * @default {String} '' - if no plugin name is provided, nothing is appended to the uid.
     * @returns {String} - unique id
     */
    GetYoDigits: function (length, namespace) {
      length = length || 6;
      return Math.round(Math.pow(36, length + 1) - Math.random() * Math.pow(36, length)).toString(36).slice(1) + (namespace ? '-' + namespace : '');
    },
    /**
     * Initialize plugins on any elements within `elem` (and `elem` itself) that aren't already initialized.
     * @param {Object} elem - jQuery object containing the element to check inside. Also checks the element itself, unless it's the `document` object.
     * @param {String|Array} plugins - A list of plugins to initialize. Leave this out to initialize everything.
     */
    reflow: function (elem, plugins) {

      // If plugins is undefined, just grab everything
      if (typeof plugins === 'undefined') {
        plugins = Object.keys(this._plugins);
      }
      // If plugins is a string, convert it to an array with one item
      else if (typeof plugins === 'string') {
          plugins = [plugins];
        }

      var _this = this;

      // Iterate through each plugin
      $.each(plugins, function (i, name) {
        // Get the current plugin
        var plugin = _this._plugins[name];

        // Localize the search to all elements inside elem, as well as elem itself, unless elem === document
        var $elem = $(elem).find('[data-' + name + ']').addBack('[data-' + name + ']');

        // For each plugin found, initialize it
        $elem.each(function () {
          var $el = $(this),
              opts = {};
          // Don't double-dip on plugins
          if ($el.data('zfPlugin')) {
            console.warn("Tried to initialize " + name + " on an element that already has a Foundation plugin.");
            return;
          }

          if ($el.attr('data-options')) {
            var thing = $el.attr('data-options').split(';').forEach(function (e, i) {
              var opt = e.split(':').map(function (el) {
                return el.trim();
              });
              if (opt[0]) opts[opt[0]] = parseValue(opt[1]);
            });
          }
          try {
            $el.data('zfPlugin', new plugin($(this), opts));
          } catch (er) {
            console.error(er);
          } finally {
            return;
          }
        });
      });
    },
    getFnName: functionName,
    transitionend: function ($elem) {
      var transitions = {
        'transition': 'transitionend',
        'WebkitTransition': 'webkitTransitionEnd',
        'MozTransition': 'transitionend',
        'OTransition': 'otransitionend'
      };
      var elem = document.createElement('div'),
          end;

      for (var t in transitions) {
        if (typeof elem.style[t] !== 'undefined') {
          end = transitions[t];
        }
      }
      if (end) {
        return end;
      } else {
        end = setTimeout(function () {
          $elem.triggerHandler('transitionend', [$elem]);
        }, 1);
        return 'transitionend';
      }
    }
  };

  Foundation.util = {
    /**
     * Function for applying a debounce effect to a function call.
     * @function
     * @param {Function} func - Function to be called at end of timeout.
     * @param {Number} delay - Time in ms to delay the call of `func`.
     * @returns function
     */
    throttle: function (func, delay) {
      var timer = null;

      return function () {
        var context = this,
            args = arguments;

        if (timer === null) {
          timer = setTimeout(function () {
            func.apply(context, args);
            timer = null;
          }, delay);
        }
      };
    }
  };

  // TODO: consider not making this a jQuery function
  // TODO: need way to reflow vs. re-initialize
  /**
   * The Foundation jQuery method.
   * @param {String|Array} method - An action to perform on the current jQuery object.
   */
  var foundation = function (method) {
    var type = typeof method,
        $meta = $('meta.foundation-mq'),
        $noJS = $('.no-js');

    if (!$meta.length) {
      $('<meta class="foundation-mq">').appendTo(document.head);
    }
    if ($noJS.length) {
      $noJS.removeClass('no-js');
    }

    if (type === 'undefined') {
      //needs to initialize the Foundation object, or an individual plugin.
      Foundation.MediaQuery._init();
      Foundation.reflow(this);
    } else if (type === 'string') {
      //an individual method to invoke on a plugin or group of plugins
      var args = Array.prototype.slice.call(arguments, 1); //collect all the arguments, if necessary
      var plugClass = this.data('zfPlugin'); //determine the class of plugin

      if (plugClass !== undefined && plugClass[method] !== undefined) {
        //make sure both the class and method exist
        if (this.length === 1) {
          //if there's only one, call it directly.
          plugClass[method].apply(plugClass, args);
        } else {
          this.each(function (i, el) {
            //otherwise loop through the jQuery collection and invoke the method on each
            plugClass[method].apply($(el).data('zfPlugin'), args);
          });
        }
      } else {
        //error for no class or no method
        throw new ReferenceError("We're sorry, '" + method + "' is not an available method for " + (plugClass ? functionName(plugClass) : 'this element') + '.');
      }
    } else {
      //error for invalid argument type
      throw new TypeError("We're sorry, '" + type + "' is not a valid parameter. You must use a string representing the method you wish to invoke.");
    }
    return this;
  };

  window.Foundation = Foundation;
  $.fn.foundation = foundation;

  // Polyfill for requestAnimationFrame
  (function () {
    if (!Date.now || !window.Date.now) window.Date.now = Date.now = function () {
      return new Date().getTime();
    };

    var vendors = ['webkit', 'moz'];
    for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
      var vp = vendors[i];
      window.requestAnimationFrame = window[vp + 'RequestAnimationFrame'];
      window.cancelAnimationFrame = window[vp + 'CancelAnimationFrame'] || window[vp + 'CancelRequestAnimationFrame'];
    }
    if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
      var lastTime = 0;
      window.requestAnimationFrame = function (callback) {
        var now = Date.now();
        var nextTime = Math.max(lastTime + 16, now);
        return setTimeout(function () {
          callback(lastTime = nextTime);
        }, nextTime - now);
      };
      window.cancelAnimationFrame = clearTimeout;
    }
    /**
     * Polyfill for performance.now, required by rAF
     */
    if (!window.performance || !window.performance.now) {
      window.performance = {
        start: Date.now(),
        now: function () {
          return Date.now() - this.start;
        }
      };
    }
  })();
  if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
      if (typeof this !== 'function') {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
      }

      var aArgs = Array.prototype.slice.call(arguments, 1),
          fToBind = this,
          fNOP = function () {},
          fBound = function () {
        return fToBind.apply(this instanceof fNOP ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
      };

      if (this.prototype) {
        // native functions don't have a prototype
        fNOP.prototype = this.prototype;
      }
      fBound.prototype = new fNOP();

      return fBound;
    };
  }
  // Polyfill to get the name of a function in IE9
  function functionName(fn) {
    if (Function.prototype.name === undefined) {
      var funcNameRegex = /function\s([^(]{1,})\(/;
      var results = funcNameRegex.exec(fn.toString());
      return results && results.length > 1 ? results[1].trim() : "";
    } else if (fn.prototype === undefined) {
      return fn.constructor.name;
    } else {
      return fn.prototype.constructor.name;
    }
  }
  function parseValue(str) {
    if (/true/.test(str)) return true;else if (/false/.test(str)) return false;else if (!isNaN(str * 1)) return parseFloat(str);
    return str;
  }
  // Convert PascalCase to kebab-case
  // Thank you: http://stackoverflow.com/a/8955580
  function hyphenate(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}(jQuery);
/**
 * DropdownMenu module.
 * @module foundation.dropdown-menu
 * @requires foundation.util.keyboard
 * @requires foundation.util.box
 * @requires foundation.util.nest
 */
!function ($, Foundation) {
  'use strict';

  /**
   * Creates a new instance of DropdownMenu.
   * @class
   * @fires DropdownMenu#init
   * @param {jQuery} element - jQuery object to make into a dropdown menu.
   * @param {Object} options - Overrides to the default plugin settings.
   */

  function DropdownMenu(element, options) {
    this.$element = element;
    this.options = $.extend({}, DropdownMenu.defaults, this.$element.data(), options);

    Foundation.Nest.Feather(this.$element, 'dropdown');
    this._init();

    Foundation.registerPlugin(this, 'DropdownMenu');
    Foundation.Keyboard.register('DropdownMenu', {
      'ENTER': 'open',
      'SPACE': 'open',
      'ARROW_RIGHT': 'next',
      'ARROW_UP': 'up',
      'ARROW_DOWN': 'down',
      'ARROW_LEFT': 'previous',
      'ESCAPE': 'close'
    });
  }

  /**
   * Default settings for plugin
   */
  DropdownMenu.defaults = {
    /**
     * Disallows hover events from opening submenus
     * @option
     * @example false
     */
    disableHover: false,
    /**
     * Allow a submenu to automatically close on a mouseleave event, if not clicked open.
     * @option
     * @example true
     */
    autoclose: true,
    /**
     * Amount of time to delay opening a submenu on hover event.
     * @option
     * @example 50
     */
    hoverDelay: 50,
    /**
     * Allow a submenu to open/remain open on parent click event. Allows cursor to move away from menu.
     * @option
     * @example true
     */
    clickOpen: false,
    /**
     * Amount of time to delay closing a submenu on a mouseleave event.
     * @option
     * @example 500
     */

    closingTime: 500,
    /**
     * Position of the menu relative to what direction the submenus should open. Handled by JS.
     * @option
     * @example 'left'
     */
    alignment: 'left',
    /**
     * Allow clicks on the body to close any open submenus.
     * @option
     * @example true
     */
    closeOnClick: true,
    /**
     * Class applied to vertical oriented menus, Foundation default is `vertical`. Update this if using your own class.
     * @option
     * @example 'vertical'
     */
    verticalClass: 'vertical',
    /**
     * Class applied to right-side oriented menus, Foundation default is `align-right`. Update this if using your own class.
     * @option
     * @example 'align-right'
     */
    rightClass: 'align-right',
    /**
     * Boolean to force overide the clicking of links to perform default action, on second touch event for mobile.
     * @option
     * @example false
     */
    forceFollow: true
  };
  /**
   * Initializes the plugin, and calls _prepareMenu
   * @private
   * @function
   */
  DropdownMenu.prototype._init = function () {
    var subs = this.$element.find('li.is-dropdown-submenu-parent');
    this.$element.children('.is-dropdown-submenu-parent').children('.is-dropdown-submenu').addClass('first-sub');

    this.$menuItems = this.$element.find('[role="menuitem"]');
    this.$tabs = this.$element.children('[role="menuitem"]');
    this.isVert = this.$element.hasClass(this.options.verticalClass);
    this.$tabs.find('ul.is-dropdown-submenu').addClass(this.options.verticalClass);

    if (this.$element.hasClass(this.options.rightClass) || this.options.alignment === 'right') {
      this.options.alignment = 'right';
      subs.addClass('is-left-arrow opens-left');
    } else {
      subs.addClass('is-right-arrow opens-right');
    }
    if (!this.isVert) {
      this.$tabs.filter('.is-dropdown-submenu-parent').removeClass('is-right-arrow is-left-arrow opens-right opens-left').addClass('is-down-arrow');
    }
    this.changed = false;
    this._events();
  };
  /**
   * Adds event listeners to elements within the menu
   * @private
   * @function
   */
  DropdownMenu.prototype._events = function () {
    var _this = this,
        hasTouch = 'ontouchstart' in window || typeof window.ontouchstart !== 'undefined',
        parClass = 'is-dropdown-submenu-parent',
        delay;

    if (this.options.clickOpen || hasTouch) {
      this.$menuItems.on('click.zf.dropdownmenu touchstart.zf.dropdownmenu', function (e) {
        var $elem = $(e.target).parentsUntil('ul', '.' + parClass),
            hasSub = $elem.hasClass(parClass),
            hasClicked = $elem.attr('data-is-click') === 'true',
            $sub = $elem.children('.is-dropdown-submenu');

        if (hasSub) {
          if (hasClicked) {
            if (!_this.options.closeOnClick || !_this.options.clickOpen && !hasTouch || _this.options.forceFollow && hasTouch) {
              return;
            } else {
              e.stopImmediatePropagation();
              e.preventDefault();
              _this._hide($elem);
            }
          } else {
            e.preventDefault();
            e.stopImmediatePropagation();
            _this._show($elem.children('.is-dropdown-submenu'));
            $elem.add($elem.parentsUntil(_this.$element, '.' + parClass)).attr('data-is-click', true);
          }
        } else {
          return;
        }
      });
    }

    if (!this.options.disableHover) {
      this.$menuItems.on('mouseenter.zf.dropdownmenu', function (e) {
        e.stopImmediatePropagation();
        var $elem = $(this),
            hasSub = $elem.hasClass(parClass);

        if (hasSub) {
          clearTimeout(delay);
          delay = setTimeout(function () {
            _this._show($elem.children('.is-dropdown-submenu'));
          }, _this.options.hoverDelay);
        }
      }).on('mouseleave.zf.dropdownmenu', function (e) {
        var $elem = $(this),
            hasSub = $elem.hasClass(parClass);
        if (hasSub && _this.options.autoclose) {
          if ($elem.attr('data-is-click') === 'true' && _this.options.clickOpen) {
            return false;
          }

          // clearTimeout(delay);
          delay = setTimeout(function () {
            _this._hide($elem);
          }, _this.options.closingTime);
        }
      });
    }
    this.$menuItems.on('keydown.zf.dropdownmenu', function (e) {
      var $element = $(e.target).parentsUntil('ul', '[role="menuitem"]'),
          isTab = _this.$tabs.index($element) > -1,
          $elements = isTab ? _this.$tabs : $element.siblings('li').add($element),
          $prevElement,
          $nextElement;

      $elements.each(function (i) {
        if ($(this).is($element)) {
          $prevElement = $elements.eq(i - 1);
          $nextElement = $elements.eq(i + 1);
          return;
        }
      });

      var nextSibling = function () {
        if (!$element.is(':last-child')) $nextElement.children('a:first').focus();
      },
          prevSibling = function () {
        $prevElement.children('a:first').focus();
      },
          openSub = function () {
        var $sub = $element.children('ul.is-dropdown-submenu');
        if ($sub.length) {
          _this._show($sub);
          $element.find('li > a:first').focus();
        } else {
          return;
        }
      },
          closeSub = function () {
        //if ($element.is(':first-child')) {
        var close = $element.parent('ul').parent('li');
        close.children('a:first').focus();
        _this._hide(close);
        //}
      };
      var functions = {
        open: openSub,
        close: function () {
          _this._hide(_this.$element);
          _this.$menuItems.find('a:first').focus(); // focus to first element
        },
        handled: function () {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      };

      if (isTab) {
        if (_this.vertical) {
          // vertical menu
          if (_this.options.alignment === 'left') {
            // left aligned
            $.extend(functions, {
              down: nextSibling,
              up: prevSibling,
              next: openSub,
              previous: closeSub
            });
          } else {
            // right aligned
            $.extend(functions, {
              down: nextSibling,
              up: prevSibling,
              next: closeSub,
              previous: openSub
            });
          }
        } else {
          // horizontal menu
          $.extend(functions, {
            next: nextSibling,
            previous: prevSibling,
            down: openSub,
            up: closeSub
          });
        }
      } else {
        // not tabs -> one sub
        if (_this.options.alignment === 'left') {
          // left aligned
          $.extend(functions, {
            next: openSub,
            previous: closeSub,
            down: nextSibling,
            up: prevSibling
          });
        } else {
          // right aligned
          $.extend(functions, {
            next: closeSub,
            previous: openSub,
            down: nextSibling,
            up: prevSibling
          });
        }
      }
      Foundation.Keyboard.handleKey(e, 'DropdownMenu', functions);
    });
  };
  /**
   * Adds an event handler to the body to close any dropdowns on a click.
   * @function
   * @private
   */
  DropdownMenu.prototype._addBodyHandler = function () {
    var $body = $(document.body),
        _this = this;
    $body.off('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu').on('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu', function (e) {
      var $link = _this.$element.find(e.target);
      if ($link.length) {
        return;
      }

      _this._hide();
      $body.off('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu');
    });
  };
  /**
   * Opens a dropdown pane, and checks for collisions first.
   * @param {jQuery} $sub - ul element that is a submenu to show
   * @function
   * @private
   * @fires DropdownMenu#show
   */
  DropdownMenu.prototype._show = function ($sub) {
    var idx = this.$tabs.index(this.$tabs.filter(function (i, el) {
      return $(el).find($sub).length > 0;
    }));
    var $sibs = $sub.parent('li.is-dropdown-submenu-parent').siblings('li.is-dropdown-submenu-parent');
    this._hide($sibs, idx);
    $sub.css('visibility', 'hidden').addClass('js-dropdown-active').attr({ 'aria-hidden': false }).parent('li.is-dropdown-submenu-parent').addClass('is-active').attr({ 'aria-selected': true, 'aria-expanded': true });
    var clear = Foundation.Box.ImNotTouchingYou($sub, null, true);
    if (!clear) {
      var oldClass = this.options.alignment === 'left' ? '-right' : '-left',
          $parentLi = $sub.parent('.is-dropdown-submenu-parent');
      $parentLi.removeClass('opens' + oldClass).addClass('opens-' + this.options.alignment);
      clear = Foundation.Box.ImNotTouchingYou($sub, null, true);
      if (!clear) {
        $parentLi.removeClass('opens-' + this.options.alignment).addClass('opens-inner');
      }
      this.changed = true;
    }
    $sub.css('visibility', '');
    if (this.options.closeOnClick) {
      this._addBodyHandler();
    }
    /**
     * Fires when the new dropdown pane is visible.
     * @event DropdownMenu#show
     */
    this.$element.trigger('show.zf.dropdownmenu', [$sub]);
  };
  /**
   * Hides a single, currently open dropdown pane, if passed a parameter, otherwise, hides everything.
   * @function
   * @param {jQuery} $elem - element with a submenu to hide
   * @param {Number} idx - index of the $tabs collection to hide
   * @private
   */
  DropdownMenu.prototype._hide = function ($elem, idx) {
    var $toClose;
    if ($elem && $elem.length) {
      $toClose = $elem;
    } else if (idx !== undefined) {
      $toClose = this.$tabs.not(function (i, el) {
        return i === idx;
      });
    } else {
      $toClose = this.$element;
    }
    var somethingToClose = $toClose.hasClass('is-active') || $toClose.find('.is-active').length > 0;

    if (somethingToClose) {
      $toClose.find('li.is-active').add($toClose).attr({
        'aria-selected': false,
        'aria-expanded': false,
        'data-is-click': false
      }).removeClass('is-active');

      $toClose.find('ul.js-dropdown-active').attr({
        'aria-hidden': true
      }).removeClass('js-dropdown-active');

      if (this.changed || $toClose.find('opens-inner').length) {
        var oldClass = this.options.alignment === 'left' ? 'right' : 'left';
        $toClose.find('li.is-dropdown-submenu-parent').add($toClose).removeClass('opens-inner opens-' + this.options.alignment).addClass('opens-' + oldClass);
        this.changed = false;
      }
      /**
       * Fires when the open menus are closed.
       * @event DropdownMenu#hide
       */
      this.$element.trigger('hide.zf.dropdownmenu', [$toClose]);
    }
  };
  /**
   * Destroys the plugin.
   * @function
   */
  DropdownMenu.prototype.destroy = function () {
    this.$menuItems.off('.zf.dropdownmenu').removeAttr('data-is-click').removeClass('is-right-arrow is-left-arrow is-down-arrow opens-right opens-left opens-inner');
    Foundation.Nest.Burn(this.$element, 'dropdown');
    Foundation.unregisterPlugin(this);
  };

  Foundation.plugin(DropdownMenu, 'DropdownMenu');
}(jQuery, window.Foundation);
/**
 * OffCanvas module.
 * @module foundation.offcanvas
 * @requires foundation.util.triggers
 * @requires foundation.util.motion
 */
!function ($, Foundation) {

  'use strict';

  /**
   * Creates a new instance of an off-canvas wrapper.
   * @class
   * @fires OffCanvas#init
   * @param {Object} element - jQuery object to initialize.
   * @param {Object} options - Overrides to the default plugin settings.
   */

  function OffCanvas(element, options) {
    this.$element = element;
    this.options = $.extend({}, OffCanvas.defaults, this.$element.data(), options);
    this.$lastTrigger = $();

    this._init();
    this._events();

    Foundation.registerPlugin(this, 'OffCanvas');
  }

  OffCanvas.defaults = {
    /**
     * Allow the user to click outside of the menu to close it.
     * @option
     * @example true
     */
    closeOnClick: true,
    /**
     * Amount of time in ms the open and close transition requires. If none selected, pulls from body style.
     * @option
     * @example 500
     */
    transitionTime: 0,
    /**
     * Direction the offcanvas opens from. Determines class applied to body.
     * @option
     * @example left
     */
    position: 'left',
    /**
     * Force the page to scroll to top on open.
     */
    forceTop: true,
    /**
     * Allow the offcanvas to be sticky while open. Does nothing if Sass option `$maincontent-prevent-scroll === true`.
     * Performance in Safari OSX/iOS is not great.
     */
    // isSticky: false,
    /**
     * Allow the offcanvas to remain open for certain breakpoints. Can be used with `isSticky`.
     * @option
     * @example false
     */
    isRevealed: false,
    /**
     * Breakpoint at which to reveal. JS will use a RegExp to target standard classes, if changing classnames, pass your class @`revealClass`.
     * @option
     * @example reveal-for-large
     */
    revealOn: null,
    /**
     * Force focus to the offcanvas on open. If true, will focus the opening trigger on close.
     * @option
     * @example true
     */
    autoFocus: true,
    /**
     * Class used to force an offcanvas to remain open. Foundation defaults for this are `reveal-for-large` & `reveal-for-medium`.
     * @option
     * TODO improve the regex testing for this.
     * @example reveal-for-large
     */
    revealClass: 'reveal-for-',
    /**
     * Triggers optional focus trapping when opening an offcanvas. Sets tabindex of [data-off-canvas-content] to -1 for accessibility purposes.
     * @option
     * @example true
     */
    trapFocus: false
  };

  /**
   * Initializes the off-canvas wrapper by adding the exit overlay (if needed).
   * @function
   * @private
   */
  OffCanvas.prototype._init = function () {
    var id = this.$element.attr('id');

    this.$element.attr('aria-hidden', 'true');

    // Find triggers that affect this element and add aria-expanded to them
    $(document).find('[data-open="' + id + '"], [data-close="' + id + '"], [data-toggle="' + id + '"]').attr('aria-expanded', 'false').attr('aria-controls', id);

    // Add a close trigger over the body if necessary
    if (this.options.closeOnClick) {
      if ($('.js-off-canvas-exit').length) {
        this.$exiter = $('.js-off-canvas-exit');
      } else {
        var exiter = document.createElement('div');
        exiter.setAttribute('class', 'js-off-canvas-exit');
        $('[data-off-canvas-content]').append(exiter);

        this.$exiter = $(exiter);
      }
    }

    this.options.isRevealed = this.options.isRevealed || new RegExp(this.options.revealClass, 'g').test(this.$element[0].className);

    if (this.options.isRevealed) {
      this.options.revealOn = this.options.revealOn || this.$element[0].className.match(/(reveal-for-medium|reveal-for-large)/g)[0].split('-')[2];
      this._setMQChecker();
    }
    if (!this.options.transitionTime) {
      this.options.transitionTime = parseFloat(window.getComputedStyle($('[data-off-canvas-wrapper]')[0]).transitionDuration) * 1000;
    }
  };

  /**
   * Adds event handlers to the off-canvas wrapper and the exit overlay.
   * @function
   * @private
   */
  OffCanvas.prototype._events = function () {
    this.$element.off('.zf.trigger .zf.offcanvas').on({
      'open.zf.trigger': this.open.bind(this),
      'close.zf.trigger': this.close.bind(this),
      'toggle.zf.trigger': this.toggle.bind(this),
      'keydown.zf.offcanvas': this._handleKeyboard.bind(this)
    });

    if (this.$exiter.length) {
      var _this = this;
      this.$exiter.on({ 'click.zf.offcanvas': this.close.bind(this) });
    }
  };
  /**
   * Applies event listener for elements that will reveal at certain breakpoints.
   * @private
   */
  OffCanvas.prototype._setMQChecker = function () {
    var _this = this;

    $(window).on('changed.zf.mediaquery', function () {
      if (Foundation.MediaQuery.atLeast(_this.options.revealOn)) {
        _this.reveal(true);
      } else {
        _this.reveal(false);
      }
    }).one('load.zf.offcanvas', function () {
      if (Foundation.MediaQuery.atLeast(_this.options.revealOn)) {
        _this.reveal(true);
      }
    });
  };
  /**
   * Handles the revealing/hiding the off-canvas at breakpoints, not the same as open.
   * @param {Boolean} isRevealed - true if element should be revealed.
   * @function
   */
  OffCanvas.prototype.reveal = function (isRevealed) {
    var $closer = this.$element.find('[data-close]');
    if (isRevealed) {
      this.close();
      this.isRevealed = true;
      // if(!this.options.forceTop){
      //   var scrollPos = parseInt(window.pageYOffset);
      //   this.$element[0].style.transform = 'translate(0,' + scrollPos + 'px)';
      // }
      // if(this.options.isSticky){ this._stick(); }
      this.$element.off('open.zf.trigger toggle.zf.trigger');
      if ($closer.length) {
        $closer.hide();
      }
    } else {
      this.isRevealed = false;
      // if(this.options.isSticky || !this.options.forceTop){
      //   this.$element[0].style.transform = '';
      //   $(window).off('scroll.zf.offcanvas');
      // }
      this.$element.on({
        'open.zf.trigger': this.open.bind(this),
        'toggle.zf.trigger': this.toggle.bind(this)
      });
      if ($closer.length) {
        $closer.show();
      }
    }
  };

  /**
   * Opens the off-canvas menu.
   * @function
   * @param {Object} event - Event object passed from listener.
   * @param {jQuery} trigger - element that triggered the off-canvas to open.
   * @fires OffCanvas#opened
   */
  OffCanvas.prototype.open = function (event, trigger) {
    if (this.$element.hasClass('is-open') || this.isRevealed) {
      return;
    }
    var _this = this,
        $body = $(document.body);
    $('body').scrollTop(0);
    // window.pageYOffset = 0;

    // if(!this.options.forceTop){
    //   var scrollPos = parseInt(window.pageYOffset);
    //   this.$element[0].style.transform = 'translate(0,' + scrollPos + 'px)';
    //   if(this.$exiter.length){
    //     this.$exiter[0].style.transform = 'translate(0,' + scrollPos + 'px)';
    //   }
    // }
    /**
     * Fires when the off-canvas menu opens.
     * @event OffCanvas#opened
     */
    Foundation.Move(this.options.transitionTime, this.$element, function () {
      $('[data-off-canvas-wrapper]').addClass('is-off-canvas-open is-open-' + _this.options.position);

      _this.$element.addClass('is-open');

      // if(_this.options.isSticky){
      //   _this._stick();
      // }
    });
    this.$element.attr('aria-hidden', 'false').trigger('opened.zf.offcanvas');

    if (trigger) {
      this.$lastTrigger = trigger.attr('aria-expanded', 'true');
    }
    if (this.options.autoFocus) {
      this.$element.one('finished.zf.animate', function () {
        _this.$element.find('a, button').eq(0).focus();
      });
    }
    if (this.options.trapFocus) {
      $('[data-off-canvas-content]').attr('tabindex', '-1');
      this._trapFocus();
    }
  };
  /**
   * Traps focus within the offcanvas on open.
   * @private
   */
  OffCanvas.prototype._trapFocus = function () {
    var focusable = Foundation.Keyboard.findFocusable(this.$element),
        first = focusable.eq(0),
        last = focusable.eq(-1);

    focusable.off('.zf.offcanvas').on('keydown.zf.offcanvas', function (e) {
      if (e.which === 9 || e.keycode === 9) {
        if (e.target === last[0] && !e.shiftKey) {
          e.preventDefault();
          first.focus();
        }
        if (e.target === first[0] && e.shiftKey) {
          e.preventDefault();
          last.focus();
        }
      }
    });
  };
  /**
   * Allows the offcanvas to appear sticky utilizing translate properties.
   * @private
   */
  // OffCanvas.prototype._stick = function(){
  //   var elStyle = this.$element[0].style;
  //
  //   if(this.options.closeOnClick){
  //     var exitStyle = this.$exiter[0].style;
  //   }
  //
  //   $(window).on('scroll.zf.offcanvas', function(e){
  //     console.log(e);
  //     var pageY = window.pageYOffset;
  //     elStyle.transform = 'translate(0,' + pageY + 'px)';
  //     if(exitStyle !== undefined){ exitStyle.transform = 'translate(0,' + pageY + 'px)'; }
  //   });
  //   // this.$element.trigger('stuck.zf.offcanvas');
  // };
  /**
   * Closes the off-canvas menu.
   * @function
   * @param {Function} cb - optional cb to fire after closure.
   * @fires OffCanvas#closed
   */
  OffCanvas.prototype.close = function (cb) {
    if (!this.$element.hasClass('is-open') || this.isRevealed) {
      return;
    }

    var _this = this;

    //  Foundation.Move(this.options.transitionTime, this.$element, function(){
    $('[data-off-canvas-wrapper]').removeClass('is-off-canvas-open is-open-' + _this.options.position);
    _this.$element.removeClass('is-open');
    // Foundation._reflow();
    // });
    this.$element.attr('aria-hidden', 'true')
    /**
     * Fires when the off-canvas menu opens.
     * @event OffCanvas#closed
     */
    .trigger('closed.zf.offcanvas');
    // if(_this.options.isSticky || !_this.options.forceTop){
    //   setTimeout(function(){
    //     _this.$element[0].style.transform = '';
    //     $(window).off('scroll.zf.offcanvas');
    //   }, this.options.transitionTime);
    // }

    this.$lastTrigger.attr('aria-expanded', 'false');
    if (this.options.trapFocus) {
      $('[data-off-canvas-content]').removeAttr('tabindex');
    }
  };

  /**
   * Toggles the off-canvas menu open or closed.
   * @function
   * @param {Object} event - Event object passed from listener.
   * @param {jQuery} trigger - element that triggered the off-canvas to open.
   */
  OffCanvas.prototype.toggle = function (event, trigger) {
    if (this.$element.hasClass('is-open')) {
      this.close(event, trigger);
    } else {
      this.open(event, trigger);
    }
  };

  /**
   * Handles keyboard input when detected. When the escape key is pressed, the off-canvas menu closes, and focus is restored to the element that opened the menu.
   * @function
   * @private
   */
  OffCanvas.prototype._handleKeyboard = function (event) {
    if (event.which !== 27) return;

    event.stopPropagation();
    event.preventDefault();
    this.close();
    this.$lastTrigger.focus();
  };
  /**
   * Destroys the offcanvas plugin.
   * @function
   */
  OffCanvas.prototype.destroy = function () {
    this.close();
    this.$element.off('.zf.trigger .zf.offcanvas');
    this.$exiter.off('.zf.offcanvas');

    Foundation.unregisterPlugin(this);
  };

  Foundation.plugin(OffCanvas, 'OffCanvas');
}(jQuery, Foundation);
!function (Foundation, window) {
  /**
   * Compares the dimensions of an element to a container and determines collision events with container.
   * @function
   * @param {jQuery} element - jQuery object to test for collisions.
   * @param {jQuery} parent - jQuery object to use as bounding container.
   * @param {Boolean} lrOnly - set to true to check left and right values only.
   * @param {Boolean} tbOnly - set to true to check top and bottom values only.
   * @default if no parent object passed, detects collisions with `window`.
   * @returns {Boolean} - true if collision free, false if a collision in any direction.
   */
  var ImNotTouchingYou = function (element, parent, lrOnly, tbOnly) {
    var eleDims = GetDimensions(element),
        top,
        bottom,
        left,
        right;

    if (parent) {
      var parDims = GetDimensions(parent);

      bottom = eleDims.offset.top + eleDims.height <= parDims.height + parDims.offset.top;
      top = eleDims.offset.top >= parDims.offset.top;
      left = eleDims.offset.left >= parDims.offset.left;
      right = eleDims.offset.left + eleDims.width <= parDims.width;
    } else {
      bottom = eleDims.offset.top + eleDims.height <= eleDims.windowDims.height + eleDims.windowDims.offset.top;
      top = eleDims.offset.top >= eleDims.windowDims.offset.top;
      left = eleDims.offset.left >= eleDims.windowDims.offset.left;
      right = eleDims.offset.left + eleDims.width <= eleDims.windowDims.width;
    }
    var allDirs = [bottom, top, left, right];

    if (lrOnly) {
      return left === right === true;
    }
    if (tbOnly) {
      return top === bottom === true;
    }

    return allDirs.indexOf(false) === -1;
  };

  /**
   * Uses native methods to return an object of dimension values.
   * @function
   * @param {jQuery || HTML} element - jQuery object or DOM element for which to get the dimensions. Can be any element other that document or window.
   * @returns {Object} - nested object of integer pixel values
   * TODO - if element is window, return only those values.
   */
  var GetDimensions = function (elem, test) {
    elem = elem.length ? elem[0] : elem;

    if (elem === window || elem === document) {
      throw new Error("I'm sorry, Dave. I'm afraid I can't do that.");
    }

    var rect = elem.getBoundingClientRect(),
        parRect = elem.parentNode.getBoundingClientRect(),
        winRect = document.body.getBoundingClientRect(),
        winY = window.pageYOffset,
        winX = window.pageXOffset;

    return {
      width: rect.width,
      height: rect.height,
      offset: {
        top: rect.top + winY,
        left: rect.left + winX
      },
      parentDims: {
        width: parRect.width,
        height: parRect.height,
        offset: {
          top: parRect.top + winY,
          left: parRect.left + winX
        }
      },
      windowDims: {
        width: winRect.width,
        height: winRect.height,
        offset: {
          top: winY,
          left: winX
        }
      }
    };
  };
  /**
   * Returns an object of top and left integer pixel values for dynamically rendered elements,
   * such as: Tooltip, Reveal, and Dropdown
   * @function
   * @param {jQuery} element - jQuery object for the element being positioned.
   * @param {jQuery} anchor - jQuery object for the element's anchor point.
   * @param {String} position - a string relating to the desired position of the element, relative to it's anchor
   * @param {Number} vOffset - integer pixel value of desired vertical separation between anchor and element.
   * @param {Number} hOffset - integer pixel value of desired horizontal separation between anchor and element.
   * @param {Boolean} isOverflow - if a collision event is detected, sets to true to default the element to full width - any desired offset.
   * TODO alter/rewrite to work with `em` values as well/instead of pixels
   */
  var GetOffsets = function (element, anchor, position, vOffset, hOffset, isOverflow) {
    var $eleDims = GetDimensions(element),

    // var $eleDims = GetDimensions(element),
    $anchorDims = anchor ? GetDimensions(anchor) : null;
    // $anchorDims = anchor ? GetDimensions(anchor) : null;
    switch (position) {
      case 'top':
        return {
          left: $anchorDims.offset.left,
          top: $anchorDims.offset.top - ($eleDims.height + vOffset)
        };
        break;
      case 'left':
        return {
          left: $anchorDims.offset.left - ($eleDims.width + hOffset),
          top: $anchorDims.offset.top
        };
        break;
      case 'right':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset,
          top: $anchorDims.offset.top
        };
        break;
      case 'center top':
        return {
          left: $anchorDims.offset.left + $anchorDims.width / 2 - $eleDims.width / 2,
          top: $anchorDims.offset.top - ($eleDims.height + vOffset)
        };
        break;
      case 'center bottom':
        return {
          left: isOverflow ? hOffset : $anchorDims.offset.left + $anchorDims.width / 2 - $eleDims.width / 2,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
        break;
      case 'center left':
        return {
          left: $anchorDims.offset.left - ($eleDims.width + hOffset),
          top: $anchorDims.offset.top + $anchorDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'center right':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset + 1,
          top: $anchorDims.offset.top + $anchorDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'center':
        return {
          left: $eleDims.windowDims.offset.left + $eleDims.windowDims.width / 2 - $eleDims.width / 2,
          top: $eleDims.windowDims.offset.top + $eleDims.windowDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'reveal':
        return {
          left: ($eleDims.windowDims.width - $eleDims.width) / 2,
          top: $eleDims.windowDims.offset.top + vOffset
        };
      case 'reveal full':
        return {
          left: $eleDims.windowDims.offset.left,
          top: $eleDims.windowDims.offset.top
        };
        break;
      default:
        return {
          left: $anchorDims.offset.left,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
    }
  };
  Foundation.Box = {
    ImNotTouchingYou: ImNotTouchingYou,
    GetDimensions: GetDimensions,
    GetOffsets: GetOffsets
  };
}(window.Foundation, window);
/*******************************************
 *                                         *
 * This util was created by Marius Olbertz *
 * Please thank Marius on GitHub /owlbertz *
 * or the web http://www.mariusolbertz.de/ *
 *                                         *
 ******************************************/
!function ($, Foundation) {
  'use strict';

  Foundation.Keyboard = {};

  var keyCodes = {
    9: 'TAB',
    13: 'ENTER',
    27: 'ESCAPE',
    32: 'SPACE',
    37: 'ARROW_LEFT',
    38: 'ARROW_UP',
    39: 'ARROW_RIGHT',
    40: 'ARROW_DOWN'
  };

  /*
   * Constants for easier comparing.
   * Can be used like Foundation.parseKey(event) === Foundation.keys.SPACE
   */
  var keys = function (kcs) {
    var k = {};
    for (var kc in kcs) k[kcs[kc]] = kcs[kc];
    return k;
  }(keyCodes);

  Foundation.Keyboard.keys = keys;

  /**
   * Parses the (keyboard) event and returns a String that represents its key
   * Can be used like Foundation.parseKey(event) === Foundation.keys.SPACE
   * @param {Event} event - the event generated by the event handler
   * @return String key - String that represents the key pressed
   */
  var parseKey = function (event) {
    var key = keyCodes[event.which || event.keyCode] || String.fromCharCode(event.which).toUpperCase();
    if (event.shiftKey) key = 'SHIFT_' + key;
    if (event.ctrlKey) key = 'CTRL_' + key;
    if (event.altKey) key = 'ALT_' + key;
    return key;
  };
  Foundation.Keyboard.parseKey = parseKey;

  // plain commands per component go here, ltr and rtl are merged based on orientation
  var commands = {};

  /**
   * Handles the given (keyboard) event
   * @param {Event} event - the event generated by the event handler
   * @param {String} component - Foundation component's name, e.g. Slider or Reveal
   * @param {Objects} functions - collection of functions that are to be executed
   */
  var handleKey = function (event, component, functions) {
    var commandList = commands[component],
        keyCode = parseKey(event),
        cmds,
        command,
        fn;
    if (!commandList) return console.warn('Component not defined!');

    if (typeof commandList.ltr === 'undefined') {
      // this component does not differentiate between ltr and rtl
      cmds = commandList; // use plain list
    } else {
        // merge ltr and rtl: if document is rtl, rtl overwrites ltr and vice versa
        if (Foundation.rtl()) cmds = $.extend({}, commandList.ltr, commandList.rtl);else cmds = $.extend({}, commandList.rtl, commandList.ltr);
      }
    command = cmds[keyCode];

    fn = functions[command];
    if (fn && typeof fn === 'function') {
      // execute function  if exists
      fn.apply();
      if (functions.handled || typeof functions.handled === 'function') {
        // execute function when event was handled
        functions.handled.apply();
      }
    } else {
      if (functions.unhandled || typeof functions.unhandled === 'function') {
        // execute function when event was not handled
        functions.unhandled.apply();
      }
    }
  };
  Foundation.Keyboard.handleKey = handleKey;

  /**
   * Finds all focusable elements within the given `$element`
   * @param {jQuery} $element - jQuery object to search within
   * @return {jQuery} $focusable - all focusable elements within `$element`
   */
  var findFocusable = function ($element) {
    return $element.find('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, *[tabindex], *[contenteditable]').filter(function () {
      if (!$(this).is(':visible') || $(this).attr('tabindex') < 0) {
        return false;
      } //only have visible elements and those that have a tabindex greater or equal 0
      return true;
    });
  };
  Foundation.Keyboard.findFocusable = findFocusable;

  /**
   * Returns the component name name
   * @param {Object} component - Foundation component, e.g. Slider or Reveal
   * @return String componentName
   */

  var register = function (componentName, cmds) {
    commands[componentName] = cmds;
  };
  Foundation.Keyboard.register = register;
}(jQuery, window.Foundation);
!function ($, Foundation) {

  // Default set of media queries
  var defaultQueries = {
    'default': 'only screen',
    landscape: 'only screen and (orientation: landscape)',
    portrait: 'only screen and (orientation: portrait)',
    retina: 'only screen and (-webkit-min-device-pixel-ratio: 2),' + 'only screen and (min--moz-device-pixel-ratio: 2),' + 'only screen and (-o-min-device-pixel-ratio: 2/1),' + 'only screen and (min-device-pixel-ratio: 2),' + 'only screen and (min-resolution: 192dpi),' + 'only screen and (min-resolution: 2dppx)'
  };

  var MediaQuery = {
    queries: [],
    current: '',

    /**
     * Checks if the screen is at least as wide as a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to check.
     * @returns {Boolean} `true` if the breakpoint matches, `false` if it's smaller.
     */
    atLeast: function (size) {
      var query = this.get(size);

      if (query) {
        return window.matchMedia(query).matches;
      }

      return false;
    },

    /**
     * Gets the media query of a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to get.
     * @returns {String|null} - The media query of the breakpoint, or `null` if the breakpoint doesn't exist.
     */
    get: function (size) {
      for (var i in this.queries) {
        var query = this.queries[i];
        if (size === query.name) return query.value;
      }

      return null;
    },

    /**
     * Initializes the media query helper, by extracting the breakpoint list from the CSS and activating the breakpoint watcher.
     * @function
     * @private
     */
    _init: function () {
      var self = this;
      var extractedStyles = $('.foundation-mq').css('font-family');
      var namedQueries;

      namedQueries = parseStyleToObject(extractedStyles);

      for (var key in namedQueries) {
        self.queries.push({
          name: key,
          value: 'only screen and (min-width: ' + namedQueries[key] + ')'
        });
      }

      this.current = this._getCurrentSize();

      this._watcher();

      // Extend default queries
      // namedQueries = $.extend(defaultQueries, namedQueries);
    },

    /**
     * Gets the current breakpoint name by testing every breakpoint and returning the last one to match (the biggest one).
     * @function
     * @private
     * @returns {String} Name of the current breakpoint.
     */
    _getCurrentSize: function () {
      var matched;

      for (var i in this.queries) {
        var query = this.queries[i];

        if (window.matchMedia(query.value).matches) {
          matched = query;
        }
      }

      if (typeof matched === 'object') {
        return matched.name;
      } else {
        return matched;
      }
    },

    /**
     * Activates the breakpoint watcher, which fires an event on the window whenever the breakpoint changes.
     * @function
     * @private
     */
    _watcher: function () {
      var _this = this;

      $(window).on('resize.zf.mediaquery', function () {
        var newSize = _this._getCurrentSize();

        if (newSize !== _this.current) {
          // Broadcast the media query change on the window
          $(window).trigger('changed.zf.mediaquery', [newSize, _this.current]);

          // Change the current media query
          _this.current = newSize;
        }
      });
    }
  };

  Foundation.MediaQuery = MediaQuery;

  // matchMedia() polyfill - Test a CSS media type/query in JS.
  // Authors & copyright (c) 2012: Scott Jehl, Paul Irish, Nicholas Zakas, David Knight. Dual MIT/BSD license
  window.matchMedia || (window.matchMedia = function () {
    'use strict';

    // For browsers that support matchMedium api such as IE 9 and webkit

    var styleMedia = window.styleMedia || window.media;

    // For those that don't support matchMedium
    if (!styleMedia) {
      var style = document.createElement('style'),
          script = document.getElementsByTagName('script')[0],
          info = null;

      style.type = 'text/css';
      style.id = 'matchmediajs-test';

      script.parentNode.insertBefore(style, script);

      // 'style.currentStyle' is used by IE <= 8 and 'window.getComputedStyle' for all other browsers
      info = 'getComputedStyle' in window && window.getComputedStyle(style, null) || style.currentStyle;

      styleMedia = {
        matchMedium: function (media) {
          var text = '@media ' + media + '{ #matchmediajs-test { width: 1px; } }';

          // 'style.styleSheet' is used by IE <= 8 and 'style.textContent' for all other browsers
          if (style.styleSheet) {
            style.styleSheet.cssText = text;
          } else {
            style.textContent = text;
          }

          // Test if media query is true or false
          return info.width === '1px';
        }
      };
    }

    return function (media) {
      return {
        matches: styleMedia.matchMedium(media || 'all'),
        media: media || 'all'
      };
    };
  }());

  // Thank you: https://github.com/sindresorhus/query-string
  function parseStyleToObject(str) {
    var styleObject = {};

    if (typeof str !== 'string') {
      return styleObject;
    }

    str = str.trim().slice(1, -1); // browsers re-quote string style values

    if (!str) {
      return styleObject;
    }

    styleObject = str.split('&').reduce(function (ret, param) {
      var parts = param.replace(/\+/g, ' ').split('=');
      var key = parts[0];
      var val = parts[1];
      key = decodeURIComponent(key);

      // missing `=` should be `null`:
      // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
      val = val === undefined ? null : decodeURIComponent(val);

      if (!ret.hasOwnProperty(key)) {
        ret[key] = val;
      } else if (Array.isArray(ret[key])) {
        ret[key].push(val);
      } else {
        ret[key] = [ret[key], val];
      }
      return ret;
    }, {});

    return styleObject;
  }
}(jQuery, Foundation);
/**
 * Motion module.
 * @module foundation.motion
 */
!function ($, Foundation) {

  var initClasses = ['mui-enter', 'mui-leave'];
  var activeClasses = ['mui-enter-active', 'mui-leave-active'];

  function animate(isIn, element, animation, cb) {
    element = $(element).eq(0);

    if (!element.length) return;

    var initClass = isIn ? initClasses[0] : initClasses[1];
    var activeClass = isIn ? activeClasses[0] : activeClasses[1];

    // Set up the animation
    reset();
    element.addClass(animation).css('transition', 'none');
    //  .addClass(initClass);
    // if(isIn) element.show();
    requestAnimationFrame(function () {
      element.addClass(initClass);
      if (isIn) element.show();
    });
    // Start the animation
    requestAnimationFrame(function () {
      element[0].offsetWidth;
      element.css('transition', '');
      element.addClass(activeClass);
    });
    // Move(500, element, function(){
    //   // element[0].offsetWidth;
    //   element.css('transition', '');
    //   element.addClass(activeClass);
    // });

    // Clean up the animation when it finishes
    element.one(Foundation.transitionend(element), finish); //.one('finished.zf.animate', finish);

    // Hides the element (for out animations), resets the element, and runs a callback
    function finish() {
      if (!isIn) element.hide();
      reset();
      if (cb) cb.apply(element);
    }

    // Resets transitions and removes motion-specific classes
    function reset() {
      element[0].style.transitionDuration = 0;
      element.removeClass(initClass + ' ' + activeClass + ' ' + animation);
    }
  }

  var Motion = {
    animateIn: function (element, animation, /*duration,*/cb) {
      animate(true, element, animation, cb);
    },

    animateOut: function (element, animation, /*duration,*/cb) {
      animate(false, element, animation, cb);
    }
  };

  var Move = function (duration, elem, fn) {
    var anim,
        prog,
        start = null;
    // console.log('called');

    function move(ts) {
      if (!start) start = window.performance.now();
      // console.log(start, ts);
      prog = ts - start;
      fn.apply(elem);

      if (prog < duration) {
        anim = window.requestAnimationFrame(move, elem);
      } else {
        window.cancelAnimationFrame(anim);
        elem.trigger('finished.zf.animate', [elem]).triggerHandler('finished.zf.animate', [elem]);
      }
    }
    anim = window.requestAnimationFrame(move);
  };

  Foundation.Move = Move;
  Foundation.Motion = Motion;
}(jQuery, Foundation);
!function ($, Foundation) {
  'use strict';

  Foundation.Nest = {
    Feather: function (menu, type) {
      menu.attr('role', 'menubar');
      type = type || 'zf';
      var items = menu.find('li').attr({ 'role': 'menuitem' }),
          subMenuClass = 'is-' + type + '-submenu',
          subItemClass = subMenuClass + '-item',
          hasSubClass = 'is-' + type + '-submenu-parent';
      menu.find('a:first').attr('tabindex', 0);
      items.each(function () {
        var $item = $(this),
            $sub = $item.children('ul');
        if ($sub.length) {
          $item.addClass('has-submenu ' + hasSubClass).attr({
            'aria-haspopup': true,
            'aria-selected': false,
            'aria-expanded': false,
            'aria-label': $item.children('a:first').text()
          });
          $sub.addClass('submenu ' + subMenuClass).attr({
            'data-submenu': '',
            'aria-hidden': true,
            'role': 'menu'
          });
        }
        if ($item.parent('[data-submenu]').length) {
          $item.addClass('is-submenu-item ' + subItemClass);
        }
      });
      return;
    },
    Burn: function (menu, type) {
      var items = menu.find('li').removeAttr('tabindex'),
          subMenuClass = 'is-' + type + '-submenu',
          subItemClass = subMenuClass + '-item',
          hasSubClass = 'is-' + type + '-submenu-parent';

      // menu.find('.is-active').removeClass('is-active');
      menu.find('*')
      // menu.find('.' + subMenuClass + ', .' + subItemClass + ', .is-active, .has-submenu, .is-submenu-item, .submenu, [data-submenu]')
      .removeClass(subMenuClass + ' ' + subItemClass + ' ' + hasSubClass + ' has-submenu is-submenu-item submenu is-active').removeAttr('data-submenu').css('display', '');

      // console.log(      menu.find('.' + subMenuClass + ', .' + subItemClass + ', .has-submenu, .is-submenu-item, .submenu, [data-submenu]')
      //           .removeClass(subMenuClass + ' ' + subItemClass + ' has-submenu is-submenu-item submenu')
      //           .removeAttr('data-submenu'));
      // items.each(function(){
      //   var $item = $(this),
      //       $sub = $item.children('ul');
      //   if($item.parent('[data-submenu]').length){
      //     $item.removeClass('is-submenu-item ' + subItemClass);
      //   }
      //   if($sub.length){
      //     $item.removeClass('has-submenu');
      //     $sub.removeClass('submenu ' + subMenuClass).removeAttr('data-submenu');
      //   }
      // });
    }
  };
}(jQuery, window.Foundation);
jQuery(function ($) {

    $(document).ready(function () {

        $(document).foundation();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvdW5kYXRpb24uY29yZS5qcyIsImZvdW5kYXRpb24uZHJvcGRvd25NZW51LmpzIiwiZm91bmRhdGlvbi5vZmZjYW52YXMuanMiLCJmb3VuZGF0aW9uLnV0aWwuYm94LmpzIiwiZm91bmRhdGlvbi51dGlsLmtleWJvYXJkLmpzIiwiZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnkuanMiLCJmb3VuZGF0aW9uLnV0aWwubW90aW9uLmpzIiwiZm91bmRhdGlvbi51dGlsLm5lc3QuanMiLCJmb3VuZGF0aW9uLWluaXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQyxVQUFTLENBQVQsRUFBWTtBQUNiOztBQUVBLE1BQUkscUJBQXFCLE9BQXpCOzs7O0FBSUEsTUFBSSxhQUFhO0FBQ2YsYUFBUyxrQkFETTs7Ozs7QUFNZixjQUFVLEVBTks7Ozs7O0FBV2YsWUFBUSxFQVhPOzs7O0FBZWYsb0JBQWdCLEVBZkQ7Ozs7O0FBb0JmLFNBQUssWUFBVTtBQUNiLGFBQU8sRUFBRSxNQUFGLEVBQVUsSUFBVixDQUFlLEtBQWYsTUFBMEIsS0FBakM7QUFDRCxLQXRCYzs7Ozs7QUEyQmYsWUFBUSxVQUFTLE1BQVQsRUFBaUIsSUFBakIsRUFBdUI7OztBQUc3QixVQUFJLFlBQWEsUUFBUSxhQUFhLE1BQWIsQ0FBekI7OztBQUdBLFVBQUksV0FBWSxVQUFVLFNBQVYsQ0FBaEI7OztBQUdBLFdBQUssUUFBTCxDQUFjLFFBQWQsSUFBMEIsS0FBSyxTQUFMLElBQWtCLE1BQTVDO0FBQ0QsS0FyQ2M7Ozs7Ozs7OztBQThDZixvQkFBZ0IsVUFBUyxNQUFULEVBQWlCLElBQWpCLEVBQXNCO0FBQ3BDLFVBQUksYUFBYSxPQUFPLFVBQVUsSUFBVixDQUFQLEdBQXlCLGFBQWEsT0FBTyxXQUFwQixFQUFpQyxXQUFqQyxFQUExQztBQUNBLGFBQU8sSUFBUCxHQUFjLEtBQUssV0FBTCxDQUFpQixDQUFqQixFQUFvQixVQUFwQixDQUFkOztBQUVBLFVBQUcsQ0FBQyxPQUFP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ZUFBZSxRQUFRLElBQVIsR0FBZSxVQURsQztVQUVJLGVBQWUsZUFBZSxPQUZsQztVQUdJLGNBQWMsUUFBUSxJQUFSLEdBQWUsaUJBSGpDOzs7QUFNQSxXQUFLLElBQUwsQ0FBVSxHQUFWOztBQUFBLE9BRUssV0FGTCxDQUVpQixlQUFlLEdBQWYsR0FBcUIsWUFBckIsR0FBb0MsR0FBcEMsR0FBMEMsV0FBMUMsR0FBd0QsZ0RBRnpFLEVBR0ssVUFITCxDQUdnQixjQUhoQixFQUdnQyxHQUhoQyxDQUdvQyxTQUhwQyxFQUcrQyxFQUgvQzs7Ozs7Ozs7Ozs7Ozs7OztBQW1CRDtBQTNEZSxHQUFsQjtBQTZERCxDQS9EQSxDQStEQyxNQS9ERCxFQStEUyxPQUFPLFVBL0RoQixDQUFEO0FDQUEsT0FBUSxVQUFVLENBQVYsRUFBYzs7QUFFbEIsTUFBRyxRQUFILEVBQWMsS0FBZCxDQUFxQixZQUFXOztBQUU1QixVQUFHLFFBQUgsRUFBYyxVQUFkO0FBRUgsS0FKRDtBQU1ILENBUkQiLCJmaWxlIjoic2NyaXB0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiIWZ1bmN0aW9uKCQpIHtcblwidXNlIHN0cmljdFwiO1xuXG52YXIgRk9VTkRBVElPTl9WRVJTSU9OID0gJzYuMS4wJztcblxuLy8gR2xvYmFsIEZvdW5kYXRpb24gb2JqZWN0XG4vLyBUaGlzIGlzIGF0dGFjaGVkIHRvIHRoZSB3aW5kb3csIG9yIHVzZWQgYXMgYSBtb2R1bGUgZm9yIEFNRC9Ccm93c2VyaWZ5XG52YXIgRm91bmRhdGlvbiA9IHtcbiAgdmVyc2lvbjogRk9VTkRBVElPTl9WRVJTSU9OLFxuXG4gIC8qKlxuICAgKiBTdG9yZXMgaW5pdGlhbGl6ZWQgcGx1Z2lucy5cbiAgICovXG4gIF9wbHVnaW5zOiB7fSxcblxuICAvKipcbiAgICogU3RvcmVzIGdlbmVyYXRlZCB1bmlxdWUgaWRzIGZvciBwbHVnaW4gaW5zdGFuY2VzXG4gICAqL1xuICBfdXVpZHM6IFtdLFxuICAvKipcbiAgICogU3RvcmVzIGN1cnJlbnRseSBhY3RpdmUgcGx1Z2lucy5cbiAgICovXG4gIF9hY3RpdmVQbHVnaW5zOiB7fSxcblxuICAvKipcbiAgICogUmV0dXJucyBhIGJvb2xlYW4gZm9yIFJUTCBzdXBwb3J0XG4gICAqL1xuICBydGw6IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuICQoJ2h0bWwnKS5hdHRyKCdkaXInKSA9PT0gJ3J0bCc7XG4gIH0sXG4gIC8qKlxuICAgKiBEZWZpbmVzIGEgRm91bmRhdGlvbiBwbHVnaW4sIGFkZGluZyBpdCB0byB0aGUgYEZvdW5kYXRpb25gIG5hbWVzcGFjZSBhbmQgdGhlIGxpc3Qgb2YgcGx1Z2lucyB0byBpbml0aWFsaXplIHdoZW4gcmVmbG93aW5nLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGx1Z2luIC0gVGhlIGNvbnN0cnVjdG9yIG9mIHRoZSBwbHVnaW4uXG4gICAqL1xuICBwbHVnaW46IGZ1bmN0aW9uKHBsdWdpbiwgbmFtZSkge1xuICAgIC8vIE9iamVjdCBrZXkgdG8gdXNlIHdoZW4gYWRkaW5nIHRvIGdsb2JhbCBGb3VuZGF0aW9uIG9iamVjdFxuICAgIC8vIEV4YW1wbGVzOiBGb3VuZGF0aW9uLlJldmVhbCwgRm91bmRhdGlvbi5PZmZDYW52YXNcbiAgICB2YXIgY2xhc3NOYW1lID0gKG5hbWUgfHwgZnVuY3Rpb25OYW1lKHBsdWdpbikpO1xuICAgIC8vIE9iamVjdCBrZXkgdG8gdXNlIHdoZW4gc3RvcmluZyB0aGUgcGx1Z2luLCBhbHNvIHVzZWQgdG8gY3JlYXRlIHRoZSBpZGVudGlmeWluZyBkYXRhIGF0dHJpYnV0ZSBmb3IgdGhlIHBsdWdpblxuICAgIC8vIEV4YW1wbGVzOiBkYXRhLXJldmVhbCwgZGF0YS1vZmYtY2FudmFzXG4gICAgdmFyIGF0dHJOYW1lICA9IGh5cGhlbmF0ZShjbGFzc05hbWUpO1xuXG4gICAgLy8gQWRkIHRvIHRoZSBGb3VuZGF0aW9uIG9iamVjdCBhbmQgdGhlIHBsdWdpbnMgbGlzdCAoZm9yIHJlZmxvd2luZylcbiAgICB0aGlzLl9wbHVnaW5zW2F0dHJOYW1lXSA9IHRoaXNbY2xhc3NOYW1lXSA9IHBsdWdpbjtcbiAgfSxcbiAgLyoqXG4gICAqIEBmdW5jdGlvblxuICAgKiBDcmVhdGVzIGEgcG9pbnRlciB0byBhbiBpbnN0YW5jZSBvZiBhIFBsdWdpbiB3aXRoaW4gdGhlIEZvdW5kYXRpb24uX2FjdGl2ZVBsdWdpbnMgb2JqZWN0LlxuICAgKiBTZXRzIHRoZSBgW2RhdGEtcGx1Z2luTmFtZT1cInVuaXF1ZUlkSGVyZVwiXWAsIGFsbG93aW5nIGVhc3kgYWNjZXNzIHRvIGFueSBwbHVnaW4ncyBpbnRlcm5hbCBtZXRob2RzLlxuICAgKiBBbHNvIGZpcmVzIHRoZSBpbml0aWFsaXphdGlvbiBldmVudCBmb3IgZWFjaCBwbHVnaW4sIGNvbnNvbGlkYXRpbmcgcmVwZWRpdGl2ZSBjb2RlLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGx1Z2luIC0gYW4gaW5zdGFuY2Ugb2YgYSBwbHVnaW4sIHVzdWFsbHkgYHRoaXNgIGluIGNvbnRleHQuXG4gICAqIEBmaXJlcyBQbHVnaW4jaW5pdFxuICAgKi9cbiAgcmVnaXN0ZXJQbHVnaW46IGZ1bmN0aW9uKHBsdWdpbiwgbmFtZSl7XG4gICAgdmFyIHBsdWdpbk5hbWUgPSBuYW1lID8gaHlwaGVuYXRlKG5hbWUpIDogZnVuY3Rpb25OYW1lKHBsdWdpbi5jb25zdHJ1Y3RvcikudG9Mb3dlckNhc2UoKTtcbiAgICBwbHVnaW4udXVpZCA9IHRoaXMuR2V0WW9EaWdpdHMoNiwgcGx1Z2luTmFtZSk7XG5cbiAgICBpZighcGx1Z2luLiRlbGVtZW50LmF0dHIoJ2RhdGEtJyArIHBsdWdpbk5hbWUpKXsgcGx1Z2luLiRlbGVtZW50LmF0dHIoJ2RhdGEtJyArIHBsdWdpbk5hbWUsIHBsdWdpbi51dWlkKTsgfVxuICAgIGlmKCFwbHVnaW4uJGVsZW1lbnQuZGF0YSgnemZQbHVnaW4nKSl7IHBsdWdpbi4kZWxlbWVudC5kYXRhKCd6ZlBsdWdpbicsIHBsdWdpbik7IH1cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBwbHVnaW4gaGFzIGluaXRpYWxpemVkLlxuICAgICAgICAgICAqIEBldmVudCBQbHVnaW4jaW5pdFxuICAgICAgICAgICAqL1xuICAgIHBsdWdpbi4kZWxlbWVudC50cmlnZ2VyKCdpbml0LnpmLicgKyBwbHVnaW5OYW1lKTtcblxuICAgIHRoaXMuX3V1aWRzLnB1c2gocGx1Z2luLnV1aWQpO1xuXG4gICAgcmV0dXJuO1xuICB9LFxuICAvKipcbiAgICogQGZ1bmN0aW9uXG4gICAqIFJlbW92ZXMgdGhlIHBvaW50ZXIgZm9yIGFuIGluc3RhbmNlIG9mIGEgUGx1Z2luIGZyb20gdGhlIEZvdW5kYXRpb24uX2FjdGl2ZVBsdWdpbnMgb2JqLlxuICAgKiBBbHNvIGZpcmVzIHRoZSBkZXN0cm95ZWQgZXZlbnQgZm9yIHRoZSBwbHVnaW4sIGNvbnNvbGlkYXRpbmcgcmVwZWRpdGl2ZSBjb2RlLlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGx1Z2luIC0gYW4gaW5zdGFuY2Ugb2YgYSBwbHVnaW4sIHVzdWFsbHkgYHRoaXNgIGluIGNvbnRleHQuXG4gICAqIEBmaXJlcyBQbHVnaW4jZGVzdHJveWVkXG4gICAqL1xuICB1bnJlZ2lzdGVyUGx1Z2luOiBmdW5jdGlvbihwbHVnaW4pe1xuICAgIHZhciBwbHVnaW5OYW1lID0gaHlwaGVuYXRlKGZ1bmN0aW9uTmFtZShwbHVnaW4uJGVsZW1lbnQuZGF0YSgnemZQbHVnaW4nKS5jb25zdHJ1Y3RvcikpO1xuXG4gICAgdGhpcy5fdXVpZHMuc3BsaWNlKHRoaXMuX3V1aWRzLmluZGV4T2YocGx1Z2luLnV1aWQpLCAxKTtcbiAgICBwbHVnaW4uJGVsZW1lbnQucmVtb3ZlQXR0cignZGF0YS0nICsgcGx1Z2luTmFtZSkucmVtb3ZlRGF0YSgnemZQbHVnaW4nKVxuICAgICAgICAgIC8qKlxuICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIHBsdWdpbiBoYXMgYmVlbiBkZXN0cm95ZWQuXG4gICAgICAgICAgICogQGV2ZW50IFBsdWdpbiNkZXN0cm95ZWRcbiAgICAgICAgICAgKi9cbiAgICAgICAgICAudHJpZ2dlcignZGVzdHJveWVkLnpmLicgKyBwbHVnaW5OYW1lKTtcbiAgICBmb3IodmFyIHByb3AgaW4gcGx1Z2luKXtcbiAgICAgIHBsdWdpbltwcm9wXSA9IG51bGw7Ly9jbGVhbiB1cCBzY3JpcHQgdG8gcHJlcCBmb3IgZ2FyYmFnZSBjb2xsZWN0aW9uLlxuICAgIH1cbiAgICByZXR1cm47XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBmdW5jdGlvblxuICAgKiBDYXVzZXMgb25lIG9yIG1vcmUgYWN0aXZlIHBsdWdpbnMgdG8gcmUtaW5pdGlhbGl6ZSwgcmVzZXR0aW5nIGV2ZW50IGxpc3RlbmVycywgcmVjYWxjdWxhdGluZyBwb3NpdGlvbnMsIGV0Yy5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHBsdWdpbnMgLSBvcHRpb25hbCBzdHJpbmcgb2YgYW4gaW5kaXZpZHVhbCBwbHVnaW4ga2V5LCBhdHRhaW5lZCBieSBjYWxsaW5nIGAkKGVsZW1lbnQpLmRhdGEoJ3BsdWdpbk5hbWUnKWAsIG9yIHN0cmluZyBvZiBhIHBsdWdpbiBjbGFzcyBpLmUuIGAnZHJvcGRvd24nYFxuICAgKiBAZGVmYXVsdCBJZiBubyBhcmd1bWVudCBpcyBwYXNzZWQsIHJlZmxvdyBhbGwgY3VycmVudGx5IGFjdGl2ZSBwbHVnaW5zLlxuICAgKi9cbiAgIHJlSW5pdDogZnVuY3Rpb24ocGx1Z2lucyl7XG4gICAgIHZhciBpc0pRID0gcGx1Z2lucyBpbnN0YW5jZW9mICQ7XG4gICAgIHRyeXtcbiAgICAgICBpZihpc0pRKXtcbiAgICAgICAgIHBsdWdpbnMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAkKHRoaXMpLmRhdGEoJ3pmUGx1Z2luJykuX2luaXQoKTtcbiAgICAgICAgIH0pO1xuICAgICAgIH1lbHNle1xuICAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgcGx1Z2lucyxcbiAgICAgICAgIF90aGlzID0gdGhpcyxcbiAgICAgICAgIGZucyA9IHtcbiAgICAgICAgICAgJ29iamVjdCc6IGZ1bmN0aW9uKHBsZ3Mpe1xuICAgICAgICAgICAgIHBsZ3MuZm9yRWFjaChmdW5jdGlvbihwKXtcbiAgICAgICAgICAgICAgICQoJ1tkYXRhLScrIHAgKyddJykuZm91bmRhdGlvbignX2luaXQnKTtcbiAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgfSxcbiAgICAgICAgICAgJ3N0cmluZyc6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgJCgnW2RhdGEtJysgcGx1Z2lucyArJ10nKS5mb3VuZGF0aW9uKCdfaW5pdCcpO1xuICAgICAgICAgICB9LFxuICAgICAgICAgICAndW5kZWZpbmVkJzogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICB0aGlzWydvYmplY3QnXShPYmplY3Qua2V5cyhfdGhpcy5fcGx1Z2lucykpO1xuICAgICAgICAgICB9XG4gICAgICAgICB9O1xuICAgICAgICAgZm5zW3R5cGVdKHBsdWdpbnMpO1xuICAgICAgIH1cbiAgICAgfWNhdGNoKGVycil7XG4gICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICB9ZmluYWxseXtcbiAgICAgICByZXR1cm4gcGx1Z2lucztcbiAgICAgfVxuICAgfSxcblxuICAvKipcbiAgICogcmV0dXJucyBhIHJhbmRvbSBiYXNlLTM2IHVpZCB3aXRoIG5hbWVzcGFjaW5nXG4gICAqIEBmdW5jdGlvblxuICAgKiBAcGFyYW0ge051bWJlcn0gbGVuZ3RoIC0gbnVtYmVyIG9mIHJhbmRvbSBiYXNlLTM2IGRpZ2l0cyBkZXNpcmVkLiBJbmNyZWFzZSBmb3IgbW9yZSByYW5kb20gc3RyaW5ncy5cbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZSAtIG5hbWUgb2YgcGx1Z2luIHRvIGJlIGluY29ycG9yYXRlZCBpbiB1aWQsIG9wdGlvbmFsLlxuICAgKiBAZGVmYXVsdCB7U3RyaW5nfSAnJyAtIGlmIG5vIHBsdWdpbiBuYW1lIGlzIHByb3ZpZGVkLCBub3RoaW5nIGlzIGFwcGVuZGVkIHRvIHRoZSB1aWQuXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IC0gdW5pcXVlIGlkXG4gICAqL1xuICBHZXRZb0RpZ2l0czogZnVuY3Rpb24obGVuZ3RoLCBuYW1lc3BhY2Upe1xuICAgIGxlbmd0aCA9IGxlbmd0aCB8fCA2O1xuICAgIHJldHVybiBNYXRoLnJvdW5kKChNYXRoLnBvdygzNiwgbGVuZ3RoICsgMSkgLSBNYXRoLnJhbmRvbSgpICogTWF0aC5wb3coMzYsIGxlbmd0aCkpKS50b1N0cmluZygzNikuc2xpY2UoMSkgKyAobmFtZXNwYWNlID8gJy0nICsgbmFtZXNwYWNlIDogJycpO1xuICB9LFxuICAvKipcbiAgICogSW5pdGlhbGl6ZSBwbHVnaW5zIG9uIGFueSBlbGVtZW50cyB3aXRoaW4gYGVsZW1gIChhbmQgYGVsZW1gIGl0c2VsZikgdGhhdCBhcmVuJ3QgYWxyZWFkeSBpbml0aWFsaXplZC5cbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW0gLSBqUXVlcnkgb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnQgdG8gY2hlY2sgaW5zaWRlLiBBbHNvIGNoZWNrcyB0aGUgZWxlbWVudCBpdHNlbGYsIHVubGVzcyBpdCdzIHRoZSBgZG9jdW1lbnRgIG9iamVjdC5cbiAgICogQHBhcmFtIHtTdHJpbmd8QXJyYXl9IHBsdWdpbnMgLSBBIGxpc3Qgb2YgcGx1Z2lucyB0byBpbml0aWFsaXplLiBMZWF2ZSB0aGlzIG91dCB0byBpbml0aWFsaXplIGV2ZXJ5dGhpbmcuXG4gICAqL1xuICByZWZsb3c6IGZ1bmN0aW9uKGVsZW0sIHBsdWdpbnMpIHtcblxuICAgIC8vIElmIHBsdWdpbnMgaXMgdW5kZWZpbmVkLCBqdXN0IGdyYWIgZXZlcnl0aGluZ1xuICAgIGlmICh0eXBlb2YgcGx1Z2lucyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHBsdWdpbnMgPSBPYmplY3Qua2V5cyh0aGlzLl9wbHVnaW5zKTtcbiAgICB9XG4gICAgLy8gSWYgcGx1Z2lucyBpcyBhIHN0cmluZywgY29udmVydCBpdCB0byBhbiBhcnJheSB3aXRoIG9uZSBpdGVtXG4gICAgZWxzZSBpZiAodHlwZW9mIHBsdWdpbnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICBwbHVnaW5zID0gW3BsdWdpbnNdO1xuICAgIH1cblxuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggZWFjaCBwbHVnaW5cbiAgICAkLmVhY2gocGx1Z2lucywgZnVuY3Rpb24oaSwgbmFtZSkge1xuICAgICAgLy8gR2V0IHRoZSBjdXJyZW50IHBsdWdpblxuICAgICAgdmFyIHBsdWdpbiA9IF90aGlzLl9wbHVnaW5zW25hbWVdO1xuXG4gICAgICAvLyBMb2NhbGl6ZSB0aGUgc2VhcmNoIHRvIGFsbCBlbGVtZW50cyBpbnNpZGUgZWxlbSwgYXMgd2VsbCBhcyBlbGVtIGl0c2VsZiwgdW5sZXNzIGVsZW0gPT09IGRvY3VtZW50XG4gICAgICB2YXIgJGVsZW0gPSAkKGVsZW0pLmZpbmQoJ1tkYXRhLScrbmFtZSsnXScpLmFkZEJhY2soJ1tkYXRhLScrbmFtZSsnXScpO1xuXG4gICAgICAvLyBGb3IgZWFjaCBwbHVnaW4gZm91bmQsIGluaXRpYWxpemUgaXRcbiAgICAgICRlbGVtLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciAkZWwgPSAkKHRoaXMpLFxuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICAvLyBEb24ndCBkb3VibGUtZGlwIG9uIHBsdWdpbnNcbiAgICAgICAgaWYgKCRlbC5kYXRhKCd6ZlBsdWdpbicpKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKFwiVHJpZWQgdG8gaW5pdGlhbGl6ZSBcIituYW1lK1wiIG9uIGFuIGVsZW1lbnQgdGhhdCBhbHJlYWR5IGhhcyBhIEZvdW5kYXRpb24gcGx1Z2luLlwiKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZigkZWwuYXR0cignZGF0YS1vcHRpb25zJykpe1xuICAgICAgICAgIHZhciB0aGluZyA9ICRlbC5hdHRyKCdkYXRhLW9wdGlvbnMnKS5zcGxpdCgnOycpLmZvckVhY2goZnVuY3Rpb24oZSwgaSl7XG4gICAgICAgICAgICB2YXIgb3B0ID0gZS5zcGxpdCgnOicpLm1hcChmdW5jdGlvbihlbCl7IHJldHVybiBlbC50cmltKCk7IH0pO1xuICAgICAgICAgICAgaWYob3B0WzBdKSBvcHRzW29wdFswXV0gPSBwYXJzZVZhbHVlKG9wdFsxXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5e1xuICAgICAgICAgICRlbC5kYXRhKCd6ZlBsdWdpbicsIG5ldyBwbHVnaW4oJCh0aGlzKSwgb3B0cykpO1xuICAgICAgICB9Y2F0Y2goZXIpe1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXIpO1xuICAgICAgICB9ZmluYWxseXtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBnZXRGbk5hbWU6IGZ1bmN0aW9uTmFtZSxcbiAgdHJhbnNpdGlvbmVuZDogZnVuY3Rpb24oJGVsZW0pe1xuICAgIHZhciB0cmFuc2l0aW9ucyA9IHtcbiAgICAgICd0cmFuc2l0aW9uJzogJ3RyYW5zaXRpb25lbmQnLFxuICAgICAgJ1dlYmtpdFRyYW5zaXRpb24nOiAnd2Via2l0VHJhbnNpdGlvbkVuZCcsXG4gICAgICAnTW96VHJhbnNpdGlvbic6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAgICdPVHJhbnNpdGlvbic6ICdvdHJhbnNpdGlvbmVuZCdcbiAgICB9O1xuICAgIHZhciBlbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG4gICAgICAgIGVuZDtcblxuICAgIGZvciAodmFyIHQgaW4gdHJhbnNpdGlvbnMpe1xuICAgICAgaWYgKHR5cGVvZiBlbGVtLnN0eWxlW3RdICE9PSAndW5kZWZpbmVkJyl7XG4gICAgICAgIGVuZCA9IHRyYW5zaXRpb25zW3RdO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihlbmQpe1xuICAgICAgcmV0dXJuIGVuZDtcbiAgICB9ZWxzZXtcbiAgICAgIGVuZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgJGVsZW0udHJpZ2dlckhhbmRsZXIoJ3RyYW5zaXRpb25lbmQnLCBbJGVsZW1dKTtcbiAgICAgIH0sIDEpO1xuICAgICAgcmV0dXJuICd0cmFuc2l0aW9uZW5kJztcbiAgICB9XG4gIH1cbn07XG5cblxuRm91bmRhdGlvbi51dGlsID0ge1xuICAvKipcbiAgICogRnVuY3Rpb24gZm9yIGFwcGx5aW5nIGEgZGVib3VuY2UgZWZmZWN0IHRvIGEgZnVuY3Rpb24gY2FsbC5cbiAgICogQGZ1bmN0aW9uXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgLSBGdW5jdGlvbiB0byBiZSBjYWxsZWQgYXQgZW5kIG9mIHRpbWVvdXQuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheSAtIFRpbWUgaW4gbXMgdG8gZGVsYXkgdGhlIGNhbGwgb2YgYGZ1bmNgLlxuICAgKiBAcmV0dXJucyBmdW5jdGlvblxuICAgKi9cbiAgdGhyb3R0bGU6IGZ1bmN0aW9uIChmdW5jLCBkZWxheSkge1xuICAgIHZhciB0aW1lciA9IG51bGw7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzO1xuXG4gICAgICBpZiAodGltZXIgPT09IG51bGwpIHtcbiAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgIHRpbWVyID0gbnVsbDtcbiAgICAgICAgfSwgZGVsYXkpO1xuICAgICAgfVxuICAgIH07XG4gIH1cbn07XG5cbi8vIFRPRE86IGNvbnNpZGVyIG5vdCBtYWtpbmcgdGhpcyBhIGpRdWVyeSBmdW5jdGlvblxuLy8gVE9ETzogbmVlZCB3YXkgdG8gcmVmbG93IHZzLiByZS1pbml0aWFsaXplXG4vKipcbiAqIFRoZSBGb3VuZGF0aW9uIGpRdWVyeSBtZXRob2QuXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheX0gbWV0aG9kIC0gQW4gYWN0aW9uIHRvIHBlcmZvcm0gb24gdGhlIGN1cnJlbnQgalF1ZXJ5IG9iamVjdC5cbiAqL1xudmFyIGZvdW5kYXRpb24gPSBmdW5jdGlvbihtZXRob2QpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgbWV0aG9kLFxuICAgICAgJG1ldGEgPSAkKCdtZXRhLmZvdW5kYXRpb24tbXEnKSxcbiAgICAgICRub0pTID0gJCgnLm5vLWpzJyk7XG5cbiAgaWYoISRtZXRhLmxlbmd0aCl7XG4gICAgJCgnPG1ldGEgY2xhc3M9XCJmb3VuZGF0aW9uLW1xXCI+JykuYXBwZW5kVG8oZG9jdW1lbnQuaGVhZCk7XG4gIH1cbiAgaWYoJG5vSlMubGVuZ3RoKXtcbiAgICAkbm9KUy5yZW1vdmVDbGFzcygnbm8tanMnKTtcbiAgfVxuXG4gIGlmKHR5cGUgPT09ICd1bmRlZmluZWQnKXsvL25lZWRzIHRvIGluaXRpYWxpemUgdGhlIEZvdW5kYXRpb24gb2JqZWN0LCBvciBhbiBpbmRpdmlkdWFsIHBsdWdpbi5cbiAgICBGb3VuZGF0aW9uLk1lZGlhUXVlcnkuX2luaXQoKTtcbiAgICBGb3VuZGF0aW9uLnJlZmxvdyh0aGlzKTtcbiAgfWVsc2UgaWYodHlwZSA9PT0gJ3N0cmluZycpey8vYW4gaW5kaXZpZHVhbCBtZXRob2QgdG8gaW52b2tlIG9uIGEgcGx1Z2luIG9yIGdyb3VwIG9mIHBsdWdpbnNcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7Ly9jb2xsZWN0IGFsbCB0aGUgYXJndW1lbnRzLCBpZiBuZWNlc3NhcnlcbiAgICB2YXIgcGx1Z0NsYXNzID0gdGhpcy5kYXRhKCd6ZlBsdWdpbicpOy8vZGV0ZXJtaW5lIHRoZSBjbGFzcyBvZiBwbHVnaW5cblxuICAgIGlmKHBsdWdDbGFzcyAhPT0gdW5kZWZpbmVkICYmIHBsdWdDbGFzc1ttZXRob2RdICE9PSB1bmRlZmluZWQpey8vbWFrZSBzdXJlIGJvdGggdGhlIGNsYXNzIGFuZCBtZXRob2QgZXhpc3RcbiAgICAgIGlmKHRoaXMubGVuZ3RoID09PSAxKXsvL2lmIHRoZXJlJ3Mgb25seSBvbmUsIGNhbGwgaXQgZGlyZWN0bHkuXG4gICAgICAgICAgcGx1Z0NsYXNzW21ldGhvZF0uYXBwbHkocGx1Z0NsYXNzLCBhcmdzKTtcbiAgICAgIH1lbHNle1xuICAgICAgICB0aGlzLmVhY2goZnVuY3Rpb24oaSwgZWwpey8vb3RoZXJ3aXNlIGxvb3AgdGhyb3VnaCB0aGUgalF1ZXJ5IGNvbGxlY3Rpb24gYW5kIGludm9rZSB0aGUgbWV0aG9kIG9uIGVhY2hcbiAgICAgICAgICBwbHVnQ2xhc3NbbWV0aG9kXS5hcHBseSgkKGVsKS5kYXRhKCd6ZlBsdWdpbicpLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfWVsc2V7Ly9lcnJvciBmb3Igbm8gY2xhc3Mgb3Igbm8gbWV0aG9kXG4gICAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJXZSdyZSBzb3JyeSwgJ1wiICsgbWV0aG9kICsgXCInIGlzIG5vdCBhbiBhdmFpbGFibGUgbWV0aG9kIGZvciBcIiArIChwbHVnQ2xhc3MgPyBmdW5jdGlvbk5hbWUocGx1Z0NsYXNzKSA6ICd0aGlzIGVsZW1lbnQnKSArICcuJyk7XG4gICAgfVxuICB9ZWxzZXsvL2Vycm9yIGZvciBpbnZhbGlkIGFyZ3VtZW50IHR5cGVcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiV2UncmUgc29ycnksICdcIiArIHR5cGUgKyBcIicgaXMgbm90IGEgdmFsaWQgcGFyYW1ldGVyLiBZb3UgbXVzdCB1c2UgYSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBtZXRob2QgeW91IHdpc2ggdG8gaW52b2tlLlwiKTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cbndpbmRvdy5Gb3VuZGF0aW9uID0gRm91bmRhdGlvbjtcbiQuZm4uZm91bmRhdGlvbiA9IGZvdW5kYXRpb247XG5cbi8vIFBvbHlmaWxsIGZvciByZXF1ZXN0QW5pbWF0aW9uRnJhbWVcbihmdW5jdGlvbigpIHtcbiAgaWYgKCFEYXRlLm5vdyB8fCAhd2luZG93LkRhdGUubm93KVxuICAgIHdpbmRvdy5EYXRlLm5vdyA9IERhdGUubm93ID0gZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTsgfTtcblxuICB2YXIgdmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHZlbmRvcnMubGVuZ3RoICYmICF3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lOyArK2kpIHtcbiAgICAgIHZhciB2cCA9IHZlbmRvcnNbaV07XG4gICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZwKydSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9ICh3aW5kb3dbdnArJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ11cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHx8IHdpbmRvd1t2cCsnQ2FuY2VsUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ10pO1xuICB9XG4gIGlmICgvaVAoYWR8aG9uZXxvZCkuKk9TIDYvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpXG4gICAgfHwgIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgIXdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSkge1xuICAgIHZhciBsYXN0VGltZSA9IDA7XG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgICB2YXIgbmV4dFRpbWUgPSBNYXRoLm1heChsYXN0VGltZSArIDE2LCBub3cpO1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHsgY2FsbGJhY2sobGFzdFRpbWUgPSBuZXh0VGltZSk7IH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRUaW1lIC0gbm93KTtcbiAgICB9O1xuICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNsZWFyVGltZW91dDtcbiAgfVxuICAvKipcbiAgICogUG9seWZpbGwgZm9yIHBlcmZvcm1hbmNlLm5vdywgcmVxdWlyZWQgYnkgckFGXG4gICAqL1xuICBpZighd2luZG93LnBlcmZvcm1hbmNlIHx8ICF3aW5kb3cucGVyZm9ybWFuY2Uubm93KXtcbiAgICB3aW5kb3cucGVyZm9ybWFuY2UgPSB7XG4gICAgICBzdGFydDogRGF0ZS5ub3coKSxcbiAgICAgIG5vdzogZnVuY3Rpb24oKXsgcmV0dXJuIERhdGUubm93KCkgLSB0aGlzLnN0YXJ0OyB9XG4gICAgfTtcbiAgfVxufSkoKTtcbmlmICghRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQpIHtcbiAgRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbihvVGhpcykge1xuICAgIGlmICh0eXBlb2YgdGhpcyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gY2xvc2VzdCB0aGluZyBwb3NzaWJsZSB0byB0aGUgRUNNQVNjcmlwdCA1XG4gICAgICAvLyBpbnRlcm5hbCBJc0NhbGxhYmxlIGZ1bmN0aW9uXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGdW5jdGlvbi5wcm90b3R5cGUuYmluZCAtIHdoYXQgaXMgdHJ5aW5nIHRvIGJlIGJvdW5kIGlzIG5vdCBjYWxsYWJsZScpO1xuICAgIH1cblxuICAgIHZhciBhQXJncyAgID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICAgICAgZlRvQmluZCA9IHRoaXMsXG4gICAgICAgIGZOT1AgICAgPSBmdW5jdGlvbigpIHt9LFxuICAgICAgICBmQm91bmQgID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIGZUb0JpbmQuYXBwbHkodGhpcyBpbnN0YW5jZW9mIGZOT1BcbiAgICAgICAgICAgICAgICAgPyB0aGlzXG4gICAgICAgICAgICAgICAgIDogb1RoaXMsXG4gICAgICAgICAgICAgICAgIGFBcmdzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgIH07XG5cbiAgICBpZiAodGhpcy5wcm90b3R5cGUpIHtcbiAgICAgIC8vIG5hdGl2ZSBmdW5jdGlvbnMgZG9uJ3QgaGF2ZSBhIHByb3RvdHlwZVxuICAgICAgZk5PUC5wcm90b3R5cGUgPSB0aGlzLnByb3RvdHlwZTtcbiAgICB9XG4gICAgZkJvdW5kLnByb3RvdHlwZSA9IG5ldyBmTk9QKCk7XG5cbiAgICByZXR1cm4gZkJvdW5kO1xuICB9O1xufVxuLy8gUG9seWZpbGwgdG8gZ2V0IHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gaW4gSUU5XG5mdW5jdGlvbiBmdW5jdGlvbk5hbWUoZm4pIHtcbiAgaWYgKEZ1bmN0aW9uLnByb3RvdHlwZS5uYW1lID09PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgZnVuY05hbWVSZWdleCA9IC9mdW5jdGlvblxccyhbXihdezEsfSlcXCgvO1xuICAgIHZhciByZXN1bHRzID0gKGZ1bmNOYW1lUmVnZXgpLmV4ZWMoKGZuKS50b1N0cmluZygpKTtcbiAgICByZXR1cm4gKHJlc3VsdHMgJiYgcmVzdWx0cy5sZW5ndGggPiAxKSA/IHJlc3VsdHNbMV0udHJpbSgpIDogXCJcIjtcbiAgfVxuICBlbHNlIGlmIChmbi5wcm90b3R5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBmbi5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG4gIGVsc2Uge1xuICAgIHJldHVybiBmbi5wcm90b3R5cGUuY29uc3RydWN0b3IubmFtZTtcbiAgfVxufVxuZnVuY3Rpb24gcGFyc2VWYWx1ZShzdHIpe1xuICBpZigvdHJ1ZS8udGVzdChzdHIpKSByZXR1cm4gdHJ1ZTtcbiAgZWxzZSBpZigvZmFsc2UvLnRlc3Qoc3RyKSkgcmV0dXJuIGZhbHNlO1xuICBlbHNlIGlmKCFpc05hTihzdHIgKiAxKSkgcmV0dXJuIHBhcnNlRmxvYXQoc3RyKTtcbiAgcmV0dXJuIHN0cjtcbn1cbi8vIENvbnZlcnQgUGFzY2FsQ2FzZSB0byBrZWJhYi1jYXNlXG4vLyBUaGFuayB5b3U6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzg5NTU1ODBcbmZ1bmN0aW9uIGh5cGhlbmF0ZShzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEtJDInKS50b0xvd2VyQ2FzZSgpO1xufVxuXG59KGpRdWVyeSk7XG4iLCIvKipcbiAqIERyb3Bkb3duTWVudSBtb2R1bGUuXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uZHJvcGRvd24tbWVudVxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5ib3hcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubmVzdFxuICovXG4hZnVuY3Rpb24oJCwgRm91bmRhdGlvbil7XG4gICd1c2Ugc3RyaWN0JztcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBEcm9wZG93bk1lbnUuXG4gICAqIEBjbGFzc1xuICAgKiBAZmlyZXMgRHJvcGRvd25NZW51I2luaXRcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhIGRyb3Bkb3duIG1lbnUuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cbiAgICovXG4gIGZ1bmN0aW9uIERyb3Bkb3duTWVudShlbGVtZW50LCBvcHRpb25zKXtcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgRHJvcGRvd25NZW51LmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XG5cbiAgICBGb3VuZGF0aW9uLk5lc3QuRmVhdGhlcih0aGlzLiRlbGVtZW50LCAnZHJvcGRvd24nKTtcbiAgICB0aGlzLl9pbml0KCk7XG5cbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdEcm9wZG93bk1lbnUnKTtcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdEcm9wZG93bk1lbnUnLCB7XG4gICAgICAnRU5URVInOiAnb3BlbicsXG4gICAgICAnU1BBQ0UnOiAnb3BlbicsXG4gICAgICAnQVJST1dfUklHSFQnOiAnbmV4dCcsXG4gICAgICAnQVJST1dfVVAnOiAndXAnLFxuICAgICAgJ0FSUk9XX0RPV04nOiAnZG93bicsXG4gICAgICAnQVJST1dfTEVGVCc6ICdwcmV2aW91cycsXG4gICAgICAnRVNDQVBFJzogJ2Nsb3NlJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlZmF1bHQgc2V0dGluZ3MgZm9yIHBsdWdpblxuICAgKi9cbiAgRHJvcGRvd25NZW51LmRlZmF1bHRzID0ge1xuICAgIC8qKlxuICAgICAqIERpc2FsbG93cyBob3ZlciBldmVudHMgZnJvbSBvcGVuaW5nIHN1Ym1lbnVzXG4gICAgICogQG9wdGlvblxuICAgICAqIEBleGFtcGxlIGZhbHNlXG4gICAgICovXG4gICAgZGlzYWJsZUhvdmVyOiBmYWxzZSxcbiAgICAvKipcbiAgICAgKiBBbGxvdyBhIHN1Ym1lbnUgdG8gYXV0b21hdGljYWxseSBjbG9zZSBvbiBhIG1vdXNlbGVhdmUgZXZlbnQsIGlmIG5vdCBjbGlja2VkIG9wZW4uXG4gICAgICogQG9wdGlvblxuICAgICAqIEBleGFtcGxlIHRydWVcbiAgICAgKi9cbiAgICBhdXRvY2xvc2U6IHRydWUsXG4gICAgLyoqXG4gICAgICogQW1vdW50IG9mIHRpbWUgdG8gZGVsYXkgb3BlbmluZyBhIHN1Ym1lbnUgb24gaG92ZXIgZXZlbnQuXG4gICAgICogQG9wdGlvblxuICAgICAqIEBleGFtcGxlIDUwXG4gICAgICovXG4gICAgaG92ZXJEZWxheTogNTAsXG4gICAgLyoqXG4gICAgICogQWxsb3cgYSBzdWJtZW51IHRvIG9wZW4vcmVtYWluIG9wZW4gb24gcGFyZW50IGNsaWNrIGV2ZW50LiBBbGxvd3MgY3Vyc29yIHRvIG1vdmUgYXdheSBmcm9tIG1lbnUuXG4gICAgICogQG9wdGlvblxuICAgICAqIEBleGFtcGxlIHRydWVcbiAgICAgKi9cbiAgICBjbGlja09wZW46IGZhbHNlLFxuICAgIC8qKlxuICAgICAqIEFtb3VudCBvZiB0aW1lIHRvIGRlbGF5IGNsb3NpbmcgYSBzdWJtZW51IG9uIGEgbW91c2VsZWF2ZSBldmVudC5cbiAgICAgKiBAb3B0aW9uXG4gICAgICogQGV4YW1wbGUgNTAwXG4gICAgICovXG5cbiAgICBjbG9zaW5nVGltZTogNTAwLFxuICAgIC8qKlxuICAgICAqIFBvc2l0aW9uIG9mIHRoZSBtZW51IHJlbGF0aXZlIHRvIHdoYXQgZGlyZWN0aW9uIHRoZSBzdWJtZW51cyBzaG91bGQgb3Blbi4gSGFuZGxlZCBieSBKUy5cbiAgICAgKiBAb3B0aW9uXG4gICAgICogQGV4YW1wbGUgJ2xlZnQnXG4gICAgICovXG4gICAgYWxpZ25tZW50OiAnbGVmdCcsXG4gICAgLyoqXG4gICAgICogQWxsb3cgY2xpY2tzIG9uIHRoZSBib2R5IHRvIGNsb3NlIGFueSBvcGVuIHN1Ym1lbnVzLlxuICAgICAqIEBvcHRpb25cbiAgICAgKiBAZXhhbXBsZSB0cnVlXG4gICAgICovXG4gICAgY2xvc2VPbkNsaWNrOiB0cnVlLFxuICAgIC8qKlxuICAgICAqIENsYXNzIGFwcGxpZWQgdG8gdmVydGljYWwgb3JpZW50ZWQgbWVudXMsIEZvdW5kYXRpb24gZGVmYXVsdCBpcyBgdmVydGljYWxgLiBVcGRhdGUgdGhpcyBpZiB1c2luZyB5b3VyIG93biBjbGFzcy5cbiAgICAgKiBAb3B0aW9uXG4gICAgICogQGV4YW1wbGUgJ3ZlcnRpY2FsJ1xuICAgICAqL1xuICAgIHZlcnRpY2FsQ2xhc3M6ICd2ZXJ0aWNhbCcsXG4gICAgLyoqXG4gICAgICogQ2xhc3MgYXBwbGllZCB0byByaWdodC1zaWRlIG9yaWVudGVkIG1lbnVzLCBGb3VuZGF0aW9uIGRlZmF1bHQgaXMgYGFsaWduLXJpZ2h0YC4gVXBkYXRlIHRoaXMgaWYgdXNpbmcgeW91ciBvd24gY2xhc3MuXG4gICAgICogQG9wdGlvblxuICAgICAqIEBleGFtcGxlICdhbGlnbi1yaWdodCdcbiAgICAgKi9cbiAgICByaWdodENsYXNzOiAnYWxpZ24tcmlnaHQnLFxuICAgIC8qKlxuICAgICAqIEJvb2xlYW4gdG8gZm9yY2Ugb3ZlcmlkZSB0aGUgY2xpY2tpbmcgb2YgbGlua3MgdG8gcGVyZm9ybSBkZWZhdWx0IGFjdGlvbiwgb24gc2Vjb25kIHRvdWNoIGV2ZW50IGZvciBtb2JpbGUuXG4gICAgICogQG9wdGlvblxuICAgICAqIEBleGFtcGxlIGZhbHNlXG4gICAgICovXG4gICAgZm9yY2VGb2xsb3c6IHRydWVcbiAgfTtcbiAgLyoqXG4gICAqIEluaXRpYWxpemVzIHRoZSBwbHVnaW4sIGFuZCBjYWxscyBfcHJlcGFyZU1lbnVcbiAgICogQHByaXZhdGVcbiAgICogQGZ1bmN0aW9uXG4gICAqL1xuICBEcm9wZG93bk1lbnUucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgc3VicyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnbGkuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKTtcbiAgICB0aGlzLiRlbGVtZW50LmNoaWxkcmVuKCcuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKS5jaGlsZHJlbignLmlzLWRyb3Bkb3duLXN1Ym1lbnUnKS5hZGRDbGFzcygnZmlyc3Qtc3ViJyk7XG5cbiAgICB0aGlzLiRtZW51SXRlbXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tyb2xlPVwibWVudWl0ZW1cIl0nKTtcbiAgICB0aGlzLiR0YWJzID0gdGhpcy4kZWxlbWVudC5jaGlsZHJlbignW3JvbGU9XCJtZW51aXRlbVwiXScpO1xuICAgIHRoaXMuaXNWZXJ0ID0gdGhpcy4kZWxlbWVudC5oYXNDbGFzcyh0aGlzLm9wdGlvbnMudmVydGljYWxDbGFzcyk7XG4gICAgdGhpcy4kdGFicy5maW5kKCd1bC5pcy1kcm9wZG93bi1zdWJtZW51JykuYWRkQ2xhc3ModGhpcy5vcHRpb25zLnZlcnRpY2FsQ2xhc3MpO1xuXG4gICAgaWYodGhpcy4kZWxlbWVudC5oYXNDbGFzcyh0aGlzLm9wdGlvbnMucmlnaHRDbGFzcykgfHwgdGhpcy5vcHRpb25zLmFsaWdubWVudCA9PT0gJ3JpZ2h0Jyl7XG4gICAgICB0aGlzLm9wdGlvbnMuYWxpZ25tZW50ID0gJ3JpZ2h0JztcbiAgICAgIHN1YnMuYWRkQ2xhc3MoJ2lzLWxlZnQtYXJyb3cgb3BlbnMtbGVmdCcpO1xuICAgIH1lbHNle1xuICAgICAgc3Vicy5hZGRDbGFzcygnaXMtcmlnaHQtYXJyb3cgb3BlbnMtcmlnaHQnKTtcbiAgICB9XG4gICAgaWYoIXRoaXMuaXNWZXJ0KXtcbiAgICAgIHRoaXMuJHRhYnMuZmlsdGVyKCcuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKS5yZW1vdmVDbGFzcygnaXMtcmlnaHQtYXJyb3cgaXMtbGVmdC1hcnJvdyBvcGVucy1yaWdodCBvcGVucy1sZWZ0JylcbiAgICAgICAgICAuYWRkQ2xhc3MoJ2lzLWRvd24tYXJyb3cnKTtcbiAgICB9XG4gICAgdGhpcy5jaGFuZ2VkID0gZmFsc2U7XG4gICAgdGhpcy5fZXZlbnRzKCk7XG4gIH07XG4gIC8qKlxuICAgKiBBZGRzIGV2ZW50IGxpc3RlbmVycyB0byBlbGVtZW50cyB3aXRoaW4gdGhlIG1lbnVcbiAgICogQHByaXZhdGVcbiAgICogQGZ1bmN0aW9uXG4gICAqL1xuICBEcm9wZG93bk1lbnUucHJvdG90eXBlLl9ldmVudHMgPSBmdW5jdGlvbigpe1xuICAgIHZhciBfdGhpcyA9IHRoaXMsXG4gICAgICAgIGhhc1RvdWNoID0gJ29udG91Y2hzdGFydCcgaW4gd2luZG93IHx8ICh0eXBlb2Ygd2luZG93Lm9udG91Y2hzdGFydCAhPT0gJ3VuZGVmaW5lZCcpLFxuICAgICAgICBwYXJDbGFzcyA9ICdpcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcsXG4gICAgICAgIGRlbGF5O1xuXG4gICAgaWYodGhpcy5vcHRpb25zLmNsaWNrT3BlbiB8fCBoYXNUb3VjaCl7XG4gICAgICB0aGlzLiRtZW51SXRlbXMub24oJ2NsaWNrLnpmLmRyb3Bkb3dubWVudSB0b3VjaHN0YXJ0LnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpe1xuICAgICAgICB2YXIgJGVsZW0gPSAkKGUudGFyZ2V0KS5wYXJlbnRzVW50aWwoJ3VsJywgJy4nICsgcGFyQ2xhc3MpLFxuICAgICAgICAgICAgaGFzU3ViID0gJGVsZW0uaGFzQ2xhc3MocGFyQ2xhc3MpLFxuICAgICAgICAgICAgaGFzQ2xpY2tlZCA9ICRlbGVtLmF0dHIoJ2RhdGEtaXMtY2xpY2snKSA9PT0gJ3RydWUnLFxuICAgICAgICAgICAgJHN1YiA9ICRlbGVtLmNoaWxkcmVuKCcuaXMtZHJvcGRvd24tc3VibWVudScpO1xuXG4gICAgICAgIGlmKGhhc1N1Yil7XG4gICAgICAgICAgaWYoaGFzQ2xpY2tlZCl7XG4gICAgICAgICAgICBpZighX3RoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgfHwgKCFfdGhpcy5vcHRpb25zLmNsaWNrT3BlbiAmJiAhaGFzVG91Y2gpIHx8IChfdGhpcy5vcHRpb25zLmZvcmNlRm9sbG93ICYmIGhhc1RvdWNoKSl7IHJldHVybjsgfVxuICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICBfdGhpcy5faGlkZSgkZWxlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgX3RoaXMuX3Nob3coJGVsZW0uY2hpbGRyZW4oJy5pcy1kcm9wZG93bi1zdWJtZW51JykpO1xuICAgICAgICAgICAgJGVsZW0uYWRkKCRlbGVtLnBhcmVudHNVbnRpbChfdGhpcy4kZWxlbWVudCwgJy4nICsgcGFyQ2xhc3MpKS5hdHRyKCdkYXRhLWlzLWNsaWNrJywgdHJ1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9ZWxzZXsgcmV0dXJuOyB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZighdGhpcy5vcHRpb25zLmRpc2FibGVIb3Zlcil7XG4gICAgICB0aGlzLiRtZW51SXRlbXMub24oJ21vdXNlZW50ZXIuemYuZHJvcGRvd25tZW51JywgZnVuY3Rpb24oZSl7XG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAgIHZhciAkZWxlbSA9ICQodGhpcyksXG4gICAgICAgICAgICBoYXNTdWIgPSAkZWxlbS5oYXNDbGFzcyhwYXJDbGFzcyk7XG5cbiAgICAgICAgaWYoaGFzU3ViKXtcbiAgICAgICAgICBjbGVhclRpbWVvdXQoZGVsYXkpO1xuICAgICAgICAgIGRlbGF5ID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgX3RoaXMuX3Nob3coJGVsZW0uY2hpbGRyZW4oJy5pcy1kcm9wZG93bi1zdWJtZW51JykpO1xuICAgICAgICAgIH0sIF90aGlzLm9wdGlvbnMuaG92ZXJEZWxheSk7XG4gICAgICAgIH1cbiAgICAgIH0pLm9uKCdtb3VzZWxlYXZlLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpe1xuICAgICAgICB2YXIgJGVsZW0gPSAkKHRoaXMpLFxuICAgICAgICAgICAgaGFzU3ViID0gJGVsZW0uaGFzQ2xhc3MocGFyQ2xhc3MpO1xuICAgICAgICBpZihoYXNTdWIgJiYgX3RoaXMub3B0aW9ucy5hdXRvY2xvc2Upe1xuICAgICAgICAgIGlmKCRlbGVtLmF0dHIoJ2RhdGEtaXMtY2xpY2snKSA9PT0gJ3RydWUnICYmIF90aGlzLm9wdGlvbnMuY2xpY2tPcGVuKXsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAgICAgICAvLyBjbGVhclRpbWVvdXQoZGVsYXkpO1xuICAgICAgICAgIGRlbGF5ID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgX3RoaXMuX2hpZGUoJGVsZW0pO1xuICAgICAgICAgIH0sIF90aGlzLm9wdGlvbnMuY2xvc2luZ1RpbWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy4kbWVudUl0ZW1zLm9uKCdrZXlkb3duLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpe1xuICAgICAgdmFyICRlbGVtZW50ID0gJChlLnRhcmdldCkucGFyZW50c1VudGlsKCd1bCcsICdbcm9sZT1cIm1lbnVpdGVtXCJdJyksXG4gICAgICAgICAgaXNUYWIgPSBfdGhpcy4kdGFicy5pbmRleCgkZWxlbWVudCkgPiAtMSxcbiAgICAgICAgICAkZWxlbWVudHMgPSBpc1RhYiA/IF90aGlzLiR0YWJzIDogJGVsZW1lbnQuc2libGluZ3MoJ2xpJykuYWRkKCRlbGVtZW50KSxcbiAgICAgICAgICAkcHJldkVsZW1lbnQsXG4gICAgICAgICAgJG5leHRFbGVtZW50O1xuXG4gICAgICAkZWxlbWVudHMuZWFjaChmdW5jdGlvbihpKSB7XG4gICAgICAgIGlmICgkKHRoaXMpLmlzKCRlbGVtZW50KSkge1xuICAgICAgICAgICRwcmV2RWxlbWVudCA9ICRlbGVtZW50cy5lcShpLTEpO1xuICAgICAgICAgICRuZXh0RWxlbWVudCA9ICRlbGVtZW50cy5lcShpKzEpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHZhciBuZXh0U2libGluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoISRlbGVtZW50LmlzKCc6bGFzdC1jaGlsZCcpKSAkbmV4dEVsZW1lbnQuY2hpbGRyZW4oJ2E6Zmlyc3QnKS5mb2N1cygpO1xuICAgICAgfSwgcHJldlNpYmxpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJHByZXZFbGVtZW50LmNoaWxkcmVuKCdhOmZpcnN0JykuZm9jdXMoKTtcbiAgICAgIH0sIG9wZW5TdWIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyICRzdWIgPSAkZWxlbWVudC5jaGlsZHJlbigndWwuaXMtZHJvcGRvd24tc3VibWVudScpO1xuICAgICAgICBpZigkc3ViLmxlbmd0aCl7XG4gICAgICAgICAgX3RoaXMuX3Nob3coJHN1Yik7XG4gICAgICAgICAgJGVsZW1lbnQuZmluZCgnbGkgPiBhOmZpcnN0JykuZm9jdXMoKTtcbiAgICAgICAgfWVsc2V7IHJldHVybjsgfVxuICAgICAgfSwgY2xvc2VTdWIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgLy9pZiAoJGVsZW1lbnQuaXMoJzpmaXJzdC1jaGlsZCcpKSB7XG4gICAgICAgIHZhciBjbG9zZSA9ICRlbGVtZW50LnBhcmVudCgndWwnKS5wYXJlbnQoJ2xpJyk7XG4gICAgICAgICAgY2xvc2UuY2hpbGRyZW4oJ2E6Zmlyc3QnKS5mb2N1cygpO1xuICAgICAgICAgIF90aGlzLl9oaWRlKGNsb3NlKTtcbiAgICAgICAgLy99XG4gICAgICB9O1xuICAgICAgdmFyIGZ1bmN0aW9ucyA9IHtcbiAgICAgICAgb3Blbjogb3BlblN1YixcbiAgICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF90aGlzLl9oaWRlKF90aGlzLiRlbGVtZW50KTtcbiAgICAgICAgICBfdGhpcy4kbWVudUl0ZW1zLmZpbmQoJ2E6Zmlyc3QnKS5mb2N1cygpOyAvLyBmb2N1cyB0byBmaXJzdCBlbGVtZW50XG4gICAgICAgIH0sXG4gICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBpZiAoaXNUYWIpIHtcbiAgICAgICAgaWYgKF90aGlzLnZlcnRpY2FsKSB7IC8vIHZlcnRpY2FsIG1lbnVcbiAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5hbGlnbm1lbnQgPT09ICdsZWZ0JykgeyAvLyBsZWZ0IGFsaWduZWRcbiAgICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xuICAgICAgICAgICAgICBkb3duOiBuZXh0U2libGluZyxcbiAgICAgICAgICAgICAgdXA6IHByZXZTaWJsaW5nLFxuICAgICAgICAgICAgICBuZXh0OiBvcGVuU3ViLFxuICAgICAgICAgICAgICBwcmV2aW91czogY2xvc2VTdWJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7IC8vIHJpZ2h0IGFsaWduZWRcbiAgICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xuICAgICAgICAgICAgICBkb3duOiBuZXh0U2libGluZyxcbiAgICAgICAgICAgICAgdXA6IHByZXZTaWJsaW5nLFxuICAgICAgICAgICAgICBuZXh0OiBjbG9zZVN1YixcbiAgICAgICAgICAgICAgcHJldmlvdXM6IG9wZW5TdWJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gaG9yaXpvbnRhbCBtZW51XG4gICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XG4gICAgICAgICAgICBuZXh0OiBuZXh0U2libGluZyxcbiAgICAgICAgICAgIHByZXZpb3VzOiBwcmV2U2libGluZyxcbiAgICAgICAgICAgIGRvd246IG9wZW5TdWIsXG4gICAgICAgICAgICB1cDogY2xvc2VTdWJcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHsgLy8gbm90IHRhYnMgLT4gb25lIHN1YlxuICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5hbGlnbm1lbnQgPT09ICdsZWZ0JykgeyAvLyBsZWZ0IGFsaWduZWRcbiAgICAgICAgICAkLmV4dGVuZChmdW5jdGlvbnMsIHtcbiAgICAgICAgICAgIG5leHQ6IG9wZW5TdWIsXG4gICAgICAgICAgICBwcmV2aW91czogY2xvc2VTdWIsXG4gICAgICAgICAgICBkb3duOiBuZXh0U2libGluZyxcbiAgICAgICAgICAgIHVwOiBwcmV2U2libGluZ1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgeyAvLyByaWdodCBhbGlnbmVkXG4gICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XG4gICAgICAgICAgICBuZXh0OiBjbG9zZVN1YixcbiAgICAgICAgICAgIHByZXZpb3VzOiBvcGVuU3ViLFxuICAgICAgICAgICAgZG93bjogbmV4dFNpYmxpbmcsXG4gICAgICAgICAgICB1cDogcHJldlNpYmxpbmdcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ0Ryb3Bkb3duTWVudScsIGZ1bmN0aW9ucyk7XG5cbiAgICB9KTtcbiAgfTtcbiAgLyoqXG4gICAqIEFkZHMgYW4gZXZlbnQgaGFuZGxlciB0byB0aGUgYm9keSB0byBjbG9zZSBhbnkgZHJvcGRvd25zIG9uIGEgY2xpY2suXG4gICAqIEBmdW5jdGlvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgRHJvcGRvd25NZW51LnByb3RvdHlwZS5fYWRkQm9keUhhbmRsZXIgPSBmdW5jdGlvbigpe1xuICAgIHZhciAkYm9keSA9ICQoZG9jdW1lbnQuYm9keSksXG4gICAgICAgIF90aGlzID0gdGhpcztcbiAgICAkYm9keS5vZmYoJ21vdXNldXAuemYuZHJvcGRvd25tZW51IHRvdWNoZW5kLnpmLmRyb3Bkb3dubWVudScpXG4gICAgICAgICAub24oJ21vdXNldXAuemYuZHJvcGRvd25tZW51IHRvdWNoZW5kLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpe1xuICAgICAgICAgICB2YXIgJGxpbmsgPSBfdGhpcy4kZWxlbWVudC5maW5kKGUudGFyZ2V0KTtcbiAgICAgICAgICAgaWYoJGxpbmsubGVuZ3RoKXsgcmV0dXJuOyB9XG5cbiAgICAgICAgICAgX3RoaXMuX2hpZGUoKTtcbiAgICAgICAgICAgJGJvZHkub2ZmKCdtb3VzZXVwLnpmLmRyb3Bkb3dubWVudSB0b3VjaGVuZC56Zi5kcm9wZG93bm1lbnUnKTtcbiAgICAgICAgIH0pO1xuICB9O1xuICAvKipcbiAgICogT3BlbnMgYSBkcm9wZG93biBwYW5lLCBhbmQgY2hlY2tzIGZvciBjb2xsaXNpb25zIGZpcnN0LlxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHN1YiAtIHVsIGVsZW1lbnQgdGhhdCBpcyBhIHN1Ym1lbnUgdG8gc2hvd1xuICAgKiBAZnVuY3Rpb25cbiAgICogQHByaXZhdGVcbiAgICogQGZpcmVzIERyb3Bkb3duTWVudSNzaG93XG4gICAqL1xuICBEcm9wZG93bk1lbnUucHJvdG90eXBlLl9zaG93ID0gZnVuY3Rpb24oJHN1Yil7XG4gICAgdmFyIGlkeCA9IHRoaXMuJHRhYnMuaW5kZXgodGhpcy4kdGFicy5maWx0ZXIoZnVuY3Rpb24oaSwgZWwpe1xuICAgICAgcmV0dXJuICQoZWwpLmZpbmQoJHN1YikubGVuZ3RoID4gMDtcbiAgICB9KSk7XG4gICAgdmFyICRzaWJzID0gJHN1Yi5wYXJlbnQoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50Jykuc2libGluZ3MoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50Jyk7XG4gICAgdGhpcy5faGlkZSgkc2licywgaWR4KTtcbiAgICAkc3ViLmNzcygndmlzaWJpbGl0eScsICdoaWRkZW4nKS5hZGRDbGFzcygnanMtZHJvcGRvd24tYWN0aXZlJykuYXR0cih7J2FyaWEtaGlkZGVuJzogZmFsc2V9KVxuICAgICAgICAucGFyZW50KCdsaS5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpLmFkZENsYXNzKCdpcy1hY3RpdmUnKVxuICAgICAgICAuYXR0cih7J2FyaWEtc2VsZWN0ZWQnOiB0cnVlLCAnYXJpYS1leHBhbmRlZCc6IHRydWV9KTtcbiAgICB2YXIgY2xlYXIgPSBGb3VuZGF0aW9uLkJveC5JbU5vdFRvdWNoaW5nWW91KCRzdWIsIG51bGwsIHRydWUpO1xuICAgIGlmKCFjbGVhcil7XG4gICAgICB2YXIgb2xkQ2xhc3MgPSB0aGlzLm9wdGlvbnMuYWxpZ25tZW50ID09PSAnbGVmdCcgPyAnLXJpZ2h0JyA6ICctbGVmdCcsXG4gICAgICAgICAgJHBhcmVudExpID0gJHN1Yi5wYXJlbnQoJy5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpO1xuICAgICAgJHBhcmVudExpLnJlbW92ZUNsYXNzKCdvcGVucycgKyBvbGRDbGFzcykuYWRkQ2xhc3MoJ29wZW5zLScgKyB0aGlzLm9wdGlvbnMuYWxpZ25tZW50KTtcbiAgICAgIGNsZWFyID0gRm91bmRhdGlvbi5Cb3guSW1Ob3RUb3VjaGluZ1lvdSgkc3ViLCBudWxsLCB0cnVlKTtcbiAgICAgIGlmKCFjbGVhcil7XG4gICAgICAgICRwYXJlbnRMaS5yZW1vdmVDbGFzcygnb3BlbnMtJyArIHRoaXMub3B0aW9ucy5hbGlnbm1lbnQpLmFkZENsYXNzKCdvcGVucy1pbm5lcicpO1xuICAgICAgfVxuICAgICAgdGhpcy5jaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgJHN1Yi5jc3MoJ3Zpc2liaWxpdHknLCAnJyk7XG4gICAgaWYodGhpcy5vcHRpb25zLmNsb3NlT25DbGljayl7IHRoaXMuX2FkZEJvZHlIYW5kbGVyKCk7IH1cbiAgICAvKipcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBuZXcgZHJvcGRvd24gcGFuZSBpcyB2aXNpYmxlLlxuICAgICAqIEBldmVudCBEcm9wZG93bk1lbnUjc2hvd1xuICAgICAqL1xuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignc2hvdy56Zi5kcm9wZG93bm1lbnUnLCBbJHN1Yl0pO1xuICB9O1xuICAvKipcbiAgICogSGlkZXMgYSBzaW5nbGUsIGN1cnJlbnRseSBvcGVuIGRyb3Bkb3duIHBhbmUsIGlmIHBhc3NlZCBhIHBhcmFtZXRlciwgb3RoZXJ3aXNlLCBoaWRlcyBldmVyeXRoaW5nLlxuICAgKiBAZnVuY3Rpb25cbiAgICogQHBhcmFtIHtqUXVlcnl9ICRlbGVtIC0gZWxlbWVudCB3aXRoIGEgc3VibWVudSB0byBoaWRlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpZHggLSBpbmRleCBvZiB0aGUgJHRhYnMgY29sbGVjdGlvbiB0byBoaWRlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBEcm9wZG93bk1lbnUucHJvdG90eXBlLl9oaWRlID0gZnVuY3Rpb24oJGVsZW0sIGlkeCl7XG4gICAgdmFyICR0b0Nsb3NlO1xuICAgIGlmKCRlbGVtICYmICRlbGVtLmxlbmd0aCl7XG4gICAgICAkdG9DbG9zZSA9ICRlbGVtO1xuICAgIH1lbHNlIGlmKGlkeCAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICR0b0Nsb3NlID0gdGhpcy4kdGFicy5ub3QoZnVuY3Rpb24oaSwgZWwpe1xuICAgICAgICByZXR1cm4gaSA9PT0gaWR4O1xuICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICAkdG9DbG9zZSA9IHRoaXMuJGVsZW1lbnQ7XG4gICAgfVxuICAgIHZhciBzb21ldGhpbmdUb0Nsb3NlID0gJHRvQ2xvc2UuaGFzQ2xhc3MoJ2lzLWFjdGl2ZScpIHx8ICR0b0Nsb3NlLmZpbmQoJy5pcy1hY3RpdmUnKS5sZW5ndGggPiAwO1xuXG4gICAgaWYoc29tZXRoaW5nVG9DbG9zZSl7XG4gICAgICAkdG9DbG9zZS5maW5kKCdsaS5pcy1hY3RpdmUnKS5hZGQoJHRvQ2xvc2UpLmF0dHIoe1xuICAgICAgICAnYXJpYS1zZWxlY3RlZCc6IGZhbHNlLFxuICAgICAgICAnYXJpYS1leHBhbmRlZCc6IGZhbHNlLFxuICAgICAgICAnZGF0YS1pcy1jbGljayc6IGZhbHNlXG4gICAgICB9KS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlJyk7XG5cbiAgICAgICR0b0Nsb3NlLmZpbmQoJ3VsLmpzLWRyb3Bkb3duLWFjdGl2ZScpLmF0dHIoe1xuICAgICAgICAnYXJpYS1oaWRkZW4nOiB0cnVlXG4gICAgICB9KS5yZW1vdmVDbGFzcygnanMtZHJvcGRvd24tYWN0aXZlJyk7XG5cbiAgICAgIGlmKHRoaXMuY2hhbmdlZCB8fCAkdG9DbG9zZS5maW5kKCdvcGVucy1pbm5lcicpLmxlbmd0aCl7XG4gICAgICAgIHZhciBvbGRDbGFzcyA9IHRoaXMub3B0aW9ucy5hbGlnbm1lbnQgPT09ICdsZWZ0JyA/ICdyaWdodCcgOiAnbGVmdCc7XG4gICAgICAgICR0b0Nsb3NlLmZpbmQoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50JykuYWRkKCR0b0Nsb3NlKVxuICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnb3BlbnMtaW5uZXIgb3BlbnMtJyArIHRoaXMub3B0aW9ucy5hbGlnbm1lbnQpXG4gICAgICAgICAgICAgICAgLmFkZENsYXNzKCdvcGVucy0nICsgb2xkQ2xhc3MpO1xuICAgICAgICB0aGlzLmNoYW5nZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIC8qKlxuICAgICAgICogRmlyZXMgd2hlbiB0aGUgb3BlbiBtZW51cyBhcmUgY2xvc2VkLlxuICAgICAgICogQGV2ZW50IERyb3Bkb3duTWVudSNoaWRlXG4gICAgICAgKi9cbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignaGlkZS56Zi5kcm9wZG93bm1lbnUnLCBbJHRvQ2xvc2VdKTtcbiAgICB9XG4gIH07XG4gIC8qKlxuICAgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxuICAgKiBAZnVuY3Rpb25cbiAgICovXG4gIERyb3Bkb3duTWVudS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy4kbWVudUl0ZW1zLm9mZignLnpmLmRyb3Bkb3dubWVudScpLnJlbW92ZUF0dHIoJ2RhdGEtaXMtY2xpY2snKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2lzLXJpZ2h0LWFycm93IGlzLWxlZnQtYXJyb3cgaXMtZG93bi1hcnJvdyBvcGVucy1yaWdodCBvcGVucy1sZWZ0IG9wZW5zLWlubmVyJyk7XG4gICAgRm91bmRhdGlvbi5OZXN0LkJ1cm4odGhpcy4kZWxlbWVudCwgJ2Ryb3Bkb3duJyk7XG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xuICB9O1xuXG4gIEZvdW5kYXRpb24ucGx1Z2luKERyb3Bkb3duTWVudSwgJ0Ryb3Bkb3duTWVudScpO1xufShqUXVlcnksIHdpbmRvdy5Gb3VuZGF0aW9uKTtcbiIsIi8qKlxuICogT2ZmQ2FudmFzIG1vZHVsZS5cbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5vZmZjYW52YXNcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXG4gKi9cbiFmdW5jdGlvbigkLCBGb3VuZGF0aW9uKSB7XG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGFuIG9mZi1jYW52YXMgd3JhcHBlci5cbiAqIEBjbGFzc1xuICogQGZpcmVzIE9mZkNhbnZhcyNpbml0XG4gKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gaW5pdGlhbGl6ZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cbiAqL1xuZnVuY3Rpb24gT2ZmQ2FudmFzKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XG4gIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBPZmZDYW52YXMuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcbiAgdGhpcy4kbGFzdFRyaWdnZXIgPSAkKCk7XG5cbiAgdGhpcy5faW5pdCgpO1xuICB0aGlzLl9ldmVudHMoKTtcblxuICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdPZmZDYW52YXMnKTtcbn1cblxuT2ZmQ2FudmFzLmRlZmF1bHRzID0ge1xuICAvKipcbiAgICogQWxsb3cgdGhlIHVzZXIgdG8gY2xpY2sgb3V0c2lkZSBvZiB0aGUgbWVudSB0byBjbG9zZSBpdC5cbiAgICogQG9wdGlvblxuICAgKiBAZXhhbXBsZSB0cnVlXG4gICAqL1xuICBjbG9zZU9uQ2xpY2s6IHRydWUsXG4gIC8qKlxuICAgKiBBbW91bnQgb2YgdGltZSBpbiBtcyB0aGUgb3BlbiBhbmQgY2xvc2UgdHJhbnNpdGlvbiByZXF1aXJlcy4gSWYgbm9uZSBzZWxlY3RlZCwgcHVsbHMgZnJvbSBib2R5IHN0eWxlLlxuICAgKiBAb3B0aW9uXG4gICAqIEBleGFtcGxlIDUwMFxuICAgKi9cbiAgdHJhbnNpdGlvblRpbWU6IDAsXG4gIC8qKlxuICAgKiBEaXJlY3Rpb24gdGhlIG9mZmNhbnZhcyBvcGVucyBmcm9tLiBEZXRlcm1pbmVzIGNsYXNzIGFwcGxpZWQgdG8gYm9keS5cbiAgICogQG9wdGlvblxuICAgKiBAZXhhbXBsZSBsZWZ0XG4gICAqL1xuICBwb3NpdGlvbjogJ2xlZnQnLFxuICAvKipcbiAgICogRm9yY2UgdGhlIHBhZ2UgdG8gc2Nyb2xsIHRvIHRvcCBvbiBvcGVuLlxuICAgKi9cbiAgZm9yY2VUb3A6IHRydWUsXG4gIC8qKlxuICAgKiBBbGxvdyB0aGUgb2ZmY2FudmFzIHRvIGJlIHN0aWNreSB3aGlsZSBvcGVuLiBEb2VzIG5vdGhpbmcgaWYgU2FzcyBvcHRpb24gYCRtYWluY29udGVudC1wcmV2ZW50LXNjcm9sbCA9PT0gdHJ1ZWAuXG4gICAqIFBlcmZvcm1hbmNlIGluIFNhZmFyaSBPU1gvaU9TIGlzIG5vdCBncmVhdC5cbiAgICovXG4gIC8vIGlzU3RpY2t5OiBmYWxzZSxcbiAgLyoqXG4gICAqIEFsbG93IHRoZSBvZmZjYW52YXMgdG8gcmVtYWluIG9wZW4gZm9yIGNlcnRhaW4gYnJlYWtwb2ludHMuIENhbiBiZSB1c2VkIHdpdGggYGlzU3RpY2t5YC5cbiAgICogQG9wdGlvblxuICAgKiBAZXhhbXBsZSBmYWxzZVxuICAgKi9cbiAgaXNSZXZlYWxlZDogZmFsc2UsXG4gIC8qKlxuICAgKiBCcmVha3BvaW50IGF0IHdoaWNoIHRvIHJldmVhbC4gSlMgd2lsbCB1c2UgYSBSZWdFeHAgdG8gdGFyZ2V0IHN0YW5kYXJkIGNsYXNzZXMsIGlmIGNoYW5naW5nIGNsYXNzbmFtZXMsIHBhc3MgeW91ciBjbGFzcyBAYHJldmVhbENsYXNzYC5cbiAgICogQG9wdGlvblxuICAgKiBAZXhhbXBsZSByZXZlYWwtZm9yLWxhcmdlXG4gICAqL1xuICByZXZlYWxPbjogbnVsbCxcbiAgLyoqXG4gICAqIEZvcmNlIGZvY3VzIHRvIHRoZSBvZmZjYW52YXMgb24gb3Blbi4gSWYgdHJ1ZSwgd2lsbCBmb2N1cyB0aGUgb3BlbmluZyB0cmlnZ2VyIG9uIGNsb3NlLlxuICAgKiBAb3B0aW9uXG4gICAqIEBleGFtcGxlIHRydWVcbiAgICovXG4gIGF1dG9Gb2N1czogdHJ1ZSxcbiAgLyoqXG4gICAqIENsYXNzIHVzZWQgdG8gZm9yY2UgYW4gb2ZmY2FudmFzIHRvIHJlbWFpbiBvcGVuLiBGb3VuZGF0aW9uIGRlZmF1bHRzIGZvciB0aGlzIGFyZSBgcmV2ZWFsLWZvci1sYXJnZWAgJiBgcmV2ZWFsLWZvci1tZWRpdW1gLlxuICAgKiBAb3B0aW9uXG4gICAqIFRPRE8gaW1wcm92ZSB0aGUgcmVnZXggdGVzdGluZyBmb3IgdGhpcy5cbiAgICogQGV4YW1wbGUgcmV2ZWFsLWZvci1sYXJnZVxuICAgKi9cbiAgcmV2ZWFsQ2xhc3M6ICdyZXZlYWwtZm9yLScsXG4gIC8qKlxuICAgKiBUcmlnZ2VycyBvcHRpb25hbCBmb2N1cyB0cmFwcGluZyB3aGVuIG9wZW5pbmcgYW4gb2ZmY2FudmFzLiBTZXRzIHRhYmluZGV4IG9mIFtkYXRhLW9mZi1jYW52YXMtY29udGVudF0gdG8gLTEgZm9yIGFjY2Vzc2liaWxpdHkgcHVycG9zZXMuXG4gICAqIEBvcHRpb25cbiAgICogQGV4YW1wbGUgdHJ1ZVxuICAgKi9cbiAgdHJhcEZvY3VzOiBmYWxzZVxufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgb2ZmLWNhbnZhcyB3cmFwcGVyIGJ5IGFkZGluZyB0aGUgZXhpdCBvdmVybGF5IChpZiBuZWVkZWQpLlxuICogQGZ1bmN0aW9uXG4gKiBAcHJpdmF0ZVxuICovXG5PZmZDYW52YXMucHJvdG90eXBlLl9pbml0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBpZCA9IHRoaXMuJGVsZW1lbnQuYXR0cignaWQnKTtcblxuICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblxuICAvLyBGaW5kIHRyaWdnZXJzIHRoYXQgYWZmZWN0IHRoaXMgZWxlbWVudCBhbmQgYWRkIGFyaWEtZXhwYW5kZWQgdG8gdGhlbVxuICAkKGRvY3VtZW50KVxuICAgIC5maW5kKCdbZGF0YS1vcGVuPVwiJytpZCsnXCJdLCBbZGF0YS1jbG9zZT1cIicraWQrJ1wiXSwgW2RhdGEtdG9nZ2xlPVwiJytpZCsnXCJdJylcbiAgICAuYXR0cignYXJpYS1leHBhbmRlZCcsICdmYWxzZScpXG4gICAgLmF0dHIoJ2FyaWEtY29udHJvbHMnLCBpZCk7XG5cbiAgLy8gQWRkIGEgY2xvc2UgdHJpZ2dlciBvdmVyIHRoZSBib2R5IGlmIG5lY2Vzc2FyeVxuICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25DbGljayl7XG4gICAgaWYoJCgnLmpzLW9mZi1jYW52YXMtZXhpdCcpLmxlbmd0aCl7XG4gICAgICB0aGlzLiRleGl0ZXIgPSAkKCcuanMtb2ZmLWNhbnZhcy1leGl0Jyk7XG4gICAgfWVsc2V7XG4gICAgICB2YXIgZXhpdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBleGl0ZXIuc2V0QXR0cmlidXRlKCdjbGFzcycsICdqcy1vZmYtY2FudmFzLWV4aXQnKTtcbiAgICAgICQoJ1tkYXRhLW9mZi1jYW52YXMtY29udGVudF0nKS5hcHBlbmQoZXhpdGVyKTtcblxuICAgICAgdGhpcy4kZXhpdGVyID0gJChleGl0ZXIpO1xuICAgIH1cbiAgfVxuXG4gIHRoaXMub3B0aW9ucy5pc1JldmVhbGVkID0gdGhpcy5vcHRpb25zLmlzUmV2ZWFsZWQgfHwgbmV3IFJlZ0V4cCh0aGlzLm9wdGlvbnMucmV2ZWFsQ2xhc3MsICdnJykudGVzdCh0aGlzLiRlbGVtZW50WzBdLmNsYXNzTmFtZSk7XG5cbiAgaWYodGhpcy5vcHRpb25zLmlzUmV2ZWFsZWQpe1xuICAgIHRoaXMub3B0aW9ucy5yZXZlYWxPbiA9IHRoaXMub3B0aW9ucy5yZXZlYWxPbiB8fCB0aGlzLiRlbGVtZW50WzBdLmNsYXNzTmFtZS5tYXRjaCgvKHJldmVhbC1mb3ItbWVkaXVtfHJldmVhbC1mb3ItbGFyZ2UpL2cpWzBdLnNwbGl0KCctJylbMl07XG4gICAgdGhpcy5fc2V0TVFDaGVja2VyKCk7XG4gIH1cbiAgaWYoIXRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltZSl7XG4gICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1lID0gcGFyc2VGbG9hdCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSgkKCdbZGF0YS1vZmYtY2FudmFzLXdyYXBwZXJdJylbMF0pLnRyYW5zaXRpb25EdXJhdGlvbikgKiAxMDAwO1xuICB9XG59O1xuXG4vKipcbiAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgdG8gdGhlIG9mZi1jYW52YXMgd3JhcHBlciBhbmQgdGhlIGV4aXQgb3ZlcmxheS5cbiAqIEBmdW5jdGlvblxuICogQHByaXZhdGVcbiAqL1xuT2ZmQ2FudmFzLnByb3RvdHlwZS5fZXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYudHJpZ2dlciAuemYub2ZmY2FudmFzJykub24oe1xuICAgICdvcGVuLnpmLnRyaWdnZXInOiB0aGlzLm9wZW4uYmluZCh0aGlzKSxcbiAgICAnY2xvc2UuemYudHJpZ2dlcic6IHRoaXMuY2xvc2UuYmluZCh0aGlzKSxcbiAgICAndG9nZ2xlLnpmLnRyaWdnZXInOiB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpLFxuICAgICdrZXlkb3duLnpmLm9mZmNhbnZhcyc6IHRoaXMuX2hhbmRsZUtleWJvYXJkLmJpbmQodGhpcylcbiAgfSk7XG5cbiAgaWYgKHRoaXMuJGV4aXRlci5sZW5ndGgpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgIHRoaXMuJGV4aXRlci5vbih7J2NsaWNrLnpmLm9mZmNhbnZhcyc6IHRoaXMuY2xvc2UuYmluZCh0aGlzKX0pO1xuICB9XG59O1xuLyoqXG4gKiBBcHBsaWVzIGV2ZW50IGxpc3RlbmVyIGZvciBlbGVtZW50cyB0aGF0IHdpbGwgcmV2ZWFsIGF0IGNlcnRhaW4gYnJlYWtwb2ludHMuXG4gKiBAcHJpdmF0ZVxuICovXG5PZmZDYW52YXMucHJvdG90eXBlLl9zZXRNUUNoZWNrZXIgPSBmdW5jdGlvbigpe1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICQod2luZG93KS5vbignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgZnVuY3Rpb24oKXtcbiAgICBpZihGb3VuZGF0aW9uLk1lZGlhUXVlcnkuYXRMZWFzdChfdGhpcy5vcHRpb25zLnJldmVhbE9uKSl7XG4gICAgICBfdGhpcy5yZXZlYWwodHJ1ZSk7XG4gICAgfWVsc2V7XG4gICAgICBfdGhpcy5yZXZlYWwoZmFsc2UpO1xuICAgIH1cbiAgfSkub25lKCdsb2FkLnpmLm9mZmNhbnZhcycsIGZ1bmN0aW9uKCl7XG4gICAgaWYoRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmF0TGVhc3QoX3RoaXMub3B0aW9ucy5yZXZlYWxPbikpe1xuICAgICAgX3RoaXMucmV2ZWFsKHRydWUpO1xuICAgIH1cbiAgfSk7XG59O1xuLyoqXG4gKiBIYW5kbGVzIHRoZSByZXZlYWxpbmcvaGlkaW5nIHRoZSBvZmYtY2FudmFzIGF0IGJyZWFrcG9pbnRzLCBub3QgdGhlIHNhbWUgYXMgb3Blbi5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNSZXZlYWxlZCAtIHRydWUgaWYgZWxlbWVudCBzaG91bGQgYmUgcmV2ZWFsZWQuXG4gKiBAZnVuY3Rpb25cbiAqL1xuT2ZmQ2FudmFzLnByb3RvdHlwZS5yZXZlYWwgPSBmdW5jdGlvbihpc1JldmVhbGVkKXtcbiAgdmFyICRjbG9zZXIgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLWNsb3NlXScpO1xuICBpZihpc1JldmVhbGVkKXtcbiAgICB0aGlzLmNsb3NlKCk7XG4gICAgdGhpcy5pc1JldmVhbGVkID0gdHJ1ZTtcbiAgICAvLyBpZighdGhpcy5vcHRpb25zLmZvcmNlVG9wKXtcbiAgICAvLyAgIHZhciBzY3JvbGxQb3MgPSBwYXJzZUludCh3aW5kb3cucGFnZVlPZmZzZXQpO1xuICAgIC8vICAgdGhpcy4kZWxlbWVudFswXS5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlKDAsJyArIHNjcm9sbFBvcyArICdweCknO1xuICAgIC8vIH1cbiAgICAvLyBpZih0aGlzLm9wdGlvbnMuaXNTdGlja3kpeyB0aGlzLl9zdGljaygpOyB9XG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJ29wZW4uemYudHJpZ2dlciB0b2dnbGUuemYudHJpZ2dlcicpO1xuICAgIGlmKCRjbG9zZXIubGVuZ3RoKXsgJGNsb3Nlci5oaWRlKCk7IH1cbiAgfWVsc2V7XG4gICAgdGhpcy5pc1JldmVhbGVkID0gZmFsc2U7XG4gICAgLy8gaWYodGhpcy5vcHRpb25zLmlzU3RpY2t5IHx8ICF0aGlzLm9wdGlvbnMuZm9yY2VUb3Ape1xuICAgIC8vICAgdGhpcy4kZWxlbWVudFswXS5zdHlsZS50cmFuc2Zvcm0gPSAnJztcbiAgICAvLyAgICQod2luZG93KS5vZmYoJ3Njcm9sbC56Zi5vZmZjYW52YXMnKTtcbiAgICAvLyB9XG4gICAgdGhpcy4kZWxlbWVudC5vbih7XG4gICAgICAnb3Blbi56Zi50cmlnZ2VyJzogdGhpcy5vcGVuLmJpbmQodGhpcyksXG4gICAgICAndG9nZ2xlLnpmLnRyaWdnZXInOiB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpXG4gICAgfSk7XG4gICAgaWYoJGNsb3Nlci5sZW5ndGgpe1xuICAgICAgJGNsb3Nlci5zaG93KCk7XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIE9wZW5zIHRoZSBvZmYtY2FudmFzIG1lbnUuXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAtIEV2ZW50IG9iamVjdCBwYXNzZWQgZnJvbSBsaXN0ZW5lci5cbiAqIEBwYXJhbSB7alF1ZXJ5fSB0cmlnZ2VyIC0gZWxlbWVudCB0aGF0IHRyaWdnZXJlZCB0aGUgb2ZmLWNhbnZhcyB0byBvcGVuLlxuICogQGZpcmVzIE9mZkNhbnZhcyNvcGVuZWRcbiAqL1xuT2ZmQ2FudmFzLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24oZXZlbnQsIHRyaWdnZXIpIHtcbiAgaWYgKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2lzLW9wZW4nKSB8fCB0aGlzLmlzUmV2ZWFsZWQpeyByZXR1cm47IH1cbiAgdmFyIF90aGlzID0gdGhpcyxcbiAgICAgICRib2R5ID0gJChkb2N1bWVudC5ib2R5KTtcbiAgJCgnYm9keScpLnNjcm9sbFRvcCgwKTtcbiAgLy8gd2luZG93LnBhZ2VZT2Zmc2V0ID0gMDtcblxuICAvLyBpZighdGhpcy5vcHRpb25zLmZvcmNlVG9wKXtcbiAgLy8gICB2YXIgc2Nyb2xsUG9zID0gcGFyc2VJbnQod2luZG93LnBhZ2VZT2Zmc2V0KTtcbiAgLy8gICB0aGlzLiRlbGVtZW50WzBdLnN0eWxlLnRyYW5zZm9ybSA9ICd0cmFuc2xhdGUoMCwnICsgc2Nyb2xsUG9zICsgJ3B4KSc7XG4gIC8vICAgaWYodGhpcy4kZXhpdGVyLmxlbmd0aCl7XG4gIC8vICAgICB0aGlzLiRleGl0ZXJbMF0uc3R5bGUudHJhbnNmb3JtID0gJ3RyYW5zbGF0ZSgwLCcgKyBzY3JvbGxQb3MgKyAncHgpJztcbiAgLy8gICB9XG4gIC8vIH1cbiAgLyoqXG4gICAqIEZpcmVzIHdoZW4gdGhlIG9mZi1jYW52YXMgbWVudSBvcGVucy5cbiAgICogQGV2ZW50IE9mZkNhbnZhcyNvcGVuZWRcbiAgICovXG4gIEZvdW5kYXRpb24uTW92ZSh0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWUsIHRoaXMuJGVsZW1lbnQsIGZ1bmN0aW9uKCl7XG4gICAgJCgnW2RhdGEtb2ZmLWNhbnZhcy13cmFwcGVyXScpLmFkZENsYXNzKCdpcy1vZmYtY2FudmFzLW9wZW4gaXMtb3Blbi0nKyBfdGhpcy5vcHRpb25zLnBvc2l0aW9uKTtcblxuICAgIF90aGlzLiRlbGVtZW50XG4gICAgICAuYWRkQ2xhc3MoJ2lzLW9wZW4nKVxuXG4gICAgLy8gaWYoX3RoaXMub3B0aW9ucy5pc1N0aWNreSl7XG4gICAgLy8gICBfdGhpcy5fc3RpY2soKTtcbiAgICAvLyB9XG4gIH0pO1xuICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJylcbiAgICAgIC50cmlnZ2VyKCdvcGVuZWQuemYub2ZmY2FudmFzJyk7XG5cblxuICBpZih0cmlnZ2VyKXtcbiAgICB0aGlzLiRsYXN0VHJpZ2dlciA9IHRyaWdnZXIuYXR0cignYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG4gIH1cbiAgaWYodGhpcy5vcHRpb25zLmF1dG9Gb2N1cyl7XG4gICAgdGhpcy4kZWxlbWVudC5vbmUoJ2ZpbmlzaGVkLnpmLmFuaW1hdGUnLCBmdW5jdGlvbigpe1xuICAgICAgX3RoaXMuJGVsZW1lbnQuZmluZCgnYSwgYnV0dG9uJykuZXEoMCkuZm9jdXMoKTtcbiAgICB9KTtcbiAgfVxuICBpZih0aGlzLm9wdGlvbnMudHJhcEZvY3VzKXtcbiAgICAkKCdbZGF0YS1vZmYtY2FudmFzLWNvbnRlbnRdJykuYXR0cigndGFiaW5kZXgnLCAnLTEnKTtcbiAgICB0aGlzLl90cmFwRm9jdXMoKTtcbiAgfVxufTtcbi8qKlxuICogVHJhcHMgZm9jdXMgd2l0aGluIHRoZSBvZmZjYW52YXMgb24gb3Blbi5cbiAqIEBwcml2YXRlXG4gKi9cbk9mZkNhbnZhcy5wcm90b3R5cGUuX3RyYXBGb2N1cyA9IGZ1bmN0aW9uKCl7XG4gIHZhciBmb2N1c2FibGUgPSBGb3VuZGF0aW9uLktleWJvYXJkLmZpbmRGb2N1c2FibGUodGhpcy4kZWxlbWVudCksXG4gICAgICBmaXJzdCA9IGZvY3VzYWJsZS5lcSgwKSxcbiAgICAgIGxhc3QgPSBmb2N1c2FibGUuZXEoLTEpO1xuXG4gIGZvY3VzYWJsZS5vZmYoJy56Zi5vZmZjYW52YXMnKS5vbigna2V5ZG93bi56Zi5vZmZjYW52YXMnLCBmdW5jdGlvbihlKXtcbiAgICBpZihlLndoaWNoID09PSA5IHx8IGUua2V5Y29kZSA9PT0gOSl7XG4gICAgICBpZihlLnRhcmdldCA9PT0gbGFzdFswXSAmJiAhZS5zaGlmdEtleSl7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZmlyc3QuZm9jdXMoKTtcbiAgICAgIH1cbiAgICAgIGlmKGUudGFyZ2V0ID09PSBmaXJzdFswXSAmJiBlLnNoaWZ0S2V5KXtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBsYXN0LmZvY3VzKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn07XG4vKipcbiAqIEFsbG93cyB0aGUgb2ZmY2FudmFzIHRvIGFwcGVhciBzdGlja3kgdXRpbGl6aW5nIHRyYW5zbGF0ZSBwcm9wZXJ0aWVzLlxuICogQHByaXZhdGVcbiAqL1xuLy8gT2ZmQ2FudmFzLnByb3RvdHlwZS5fc3RpY2sgPSBmdW5jdGlvbigpe1xuLy8gICB2YXIgZWxTdHlsZSA9IHRoaXMuJGVsZW1lbnRbMF0uc3R5bGU7XG4vL1xuLy8gICBpZih0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrKXtcbi8vICAgICB2YXIgZXhpdFN0eWxlID0gdGhpcy4kZXhpdGVyWzBdLnN0eWxlO1xuLy8gICB9XG4vL1xuLy8gICAkKHdpbmRvdykub24oJ3Njcm9sbC56Zi5vZmZjYW52YXMnLCBmdW5jdGlvbihlKXtcbi8vICAgICBjb25zb2xlLmxvZyhlKTtcbi8vICAgICB2YXIgcGFnZVkgPSB3aW5kb3cucGFnZVlPZmZzZXQ7XG4vLyAgICAgZWxTdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlKDAsJyArIHBhZ2VZICsgJ3B4KSc7XG4vLyAgICAgaWYoZXhpdFN0eWxlICE9PSB1bmRlZmluZWQpeyBleGl0U3R5bGUudHJhbnNmb3JtID0gJ3RyYW5zbGF0ZSgwLCcgKyBwYWdlWSArICdweCknOyB9XG4vLyAgIH0pO1xuLy8gICAvLyB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3N0dWNrLnpmLm9mZmNhbnZhcycpO1xuLy8gfTtcbi8qKlxuICogQ2xvc2VzIHRoZSBvZmYtY2FudmFzIG1lbnUuXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gb3B0aW9uYWwgY2IgdG8gZmlyZSBhZnRlciBjbG9zdXJlLlxuICogQGZpcmVzIE9mZkNhbnZhcyNjbG9zZWRcbiAqL1xuT2ZmQ2FudmFzLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKGNiKSB7XG4gIGlmKCF0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1vcGVuJykgfHwgdGhpcy5pc1JldmVhbGVkKXsgcmV0dXJuOyB9XG5cbiAgdmFyIF90aGlzID0gdGhpcztcblxuICAvLyAgRm91bmRhdGlvbi5Nb3ZlKHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltZSwgdGhpcy4kZWxlbWVudCwgZnVuY3Rpb24oKXtcbiAgJCgnW2RhdGEtb2ZmLWNhbnZhcy13cmFwcGVyXScpLnJlbW92ZUNsYXNzKCdpcy1vZmYtY2FudmFzLW9wZW4gaXMtb3Blbi0nICsgX3RoaXMub3B0aW9ucy5wb3NpdGlvbik7XG4gIF90aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKCdpcy1vcGVuJyk7XG4gICAgLy8gRm91bmRhdGlvbi5fcmVmbG93KCk7XG4gIC8vIH0pO1xuICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKVxuICAgIC8qKlxuICAgICAqIEZpcmVzIHdoZW4gdGhlIG9mZi1jYW52YXMgbWVudSBvcGVucy5cbiAgICAgKiBAZXZlbnQgT2ZmQ2FudmFzI2Nsb3NlZFxuICAgICAqL1xuICAgICAgLnRyaWdnZXIoJ2Nsb3NlZC56Zi5vZmZjYW52YXMnKTtcbiAgLy8gaWYoX3RoaXMub3B0aW9ucy5pc1N0aWNreSB8fCAhX3RoaXMub3B0aW9ucy5mb3JjZVRvcCl7XG4gIC8vICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAvLyAgICAgX3RoaXMuJGVsZW1lbnRbMF0uc3R5bGUudHJhbnNmb3JtID0gJyc7XG4gIC8vICAgICAkKHdpbmRvdykub2ZmKCdzY3JvbGwuemYub2ZmY2FudmFzJyk7XG4gIC8vICAgfSwgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1lKTtcbiAgLy8gfVxuXG4gIHRoaXMuJGxhc3RUcmlnZ2VyLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcbiAgaWYodGhpcy5vcHRpb25zLnRyYXBGb2N1cyl7XG4gICAgJCgnW2RhdGEtb2ZmLWNhbnZhcy1jb250ZW50XScpLnJlbW92ZUF0dHIoJ3RhYmluZGV4Jyk7XG4gIH1cblxufTtcblxuLyoqXG4gKiBUb2dnbGVzIHRoZSBvZmYtY2FudmFzIG1lbnUgb3BlbiBvciBjbG9zZWQuXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAtIEV2ZW50IG9iamVjdCBwYXNzZWQgZnJvbSBsaXN0ZW5lci5cbiAqIEBwYXJhbSB7alF1ZXJ5fSB0cmlnZ2VyIC0gZWxlbWVudCB0aGF0IHRyaWdnZXJlZCB0aGUgb2ZmLWNhbnZhcyB0byBvcGVuLlxuICovXG5PZmZDYW52YXMucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uKGV2ZW50LCB0cmlnZ2VyKSB7XG4gIGlmICh0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1vcGVuJykpIHtcbiAgICB0aGlzLmNsb3NlKGV2ZW50LCB0cmlnZ2VyKTtcbiAgfVxuICBlbHNlIHtcbiAgICB0aGlzLm9wZW4oZXZlbnQsIHRyaWdnZXIpO1xuICB9XG59O1xuXG4vKipcbiAqIEhhbmRsZXMga2V5Ym9hcmQgaW5wdXQgd2hlbiBkZXRlY3RlZC4gV2hlbiB0aGUgZXNjYXBlIGtleSBpcyBwcmVzc2VkLCB0aGUgb2ZmLWNhbnZhcyBtZW51IGNsb3NlcywgYW5kIGZvY3VzIGlzIHJlc3RvcmVkIHRvIHRoZSBlbGVtZW50IHRoYXQgb3BlbmVkIHRoZSBtZW51LlxuICogQGZ1bmN0aW9uXG4gKiBAcHJpdmF0ZVxuICovXG5PZmZDYW52YXMucHJvdG90eXBlLl9oYW5kbGVLZXlib2FyZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gIGlmIChldmVudC53aGljaCAhPT0gMjcpIHJldHVybjtcblxuICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgdGhpcy5jbG9zZSgpO1xuICB0aGlzLiRsYXN0VHJpZ2dlci5mb2N1cygpO1xufTtcbi8qKlxuICogRGVzdHJveXMgdGhlIG9mZmNhbnZhcyBwbHVnaW4uXG4gKiBAZnVuY3Rpb25cbiAqL1xuT2ZmQ2FudmFzLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKXtcbiAgdGhpcy5jbG9zZSgpO1xuICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnRyaWdnZXIgLnpmLm9mZmNhbnZhcycpO1xuICB0aGlzLiRleGl0ZXIub2ZmKCcuemYub2ZmY2FudmFzJyk7XG5cbiAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xufTtcblxuRm91bmRhdGlvbi5wbHVnaW4oT2ZmQ2FudmFzLCAnT2ZmQ2FudmFzJyk7XG5cbn0oalF1ZXJ5LCBGb3VuZGF0aW9uKTtcbiIsIiFmdW5jdGlvbihGb3VuZGF0aW9uLCB3aW5kb3cpe1xuICAvKipcbiAgICogQ29tcGFyZXMgdGhlIGRpbWVuc2lvbnMgb2YgYW4gZWxlbWVudCB0byBhIGNvbnRhaW5lciBhbmQgZGV0ZXJtaW5lcyBjb2xsaXNpb24gZXZlbnRzIHdpdGggY29udGFpbmVyLlxuICAgKiBAZnVuY3Rpb25cbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIHRlc3QgZm9yIGNvbGxpc2lvbnMuXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBwYXJlbnQgLSBqUXVlcnkgb2JqZWN0IHRvIHVzZSBhcyBib3VuZGluZyBjb250YWluZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gbHJPbmx5IC0gc2V0IHRvIHRydWUgdG8gY2hlY2sgbGVmdCBhbmQgcmlnaHQgdmFsdWVzIG9ubHkuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gdGJPbmx5IC0gc2V0IHRvIHRydWUgdG8gY2hlY2sgdG9wIGFuZCBib3R0b20gdmFsdWVzIG9ubHkuXG4gICAqIEBkZWZhdWx0IGlmIG5vIHBhcmVudCBvYmplY3QgcGFzc2VkLCBkZXRlY3RzIGNvbGxpc2lvbnMgd2l0aCBgd2luZG93YC5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IC0gdHJ1ZSBpZiBjb2xsaXNpb24gZnJlZSwgZmFsc2UgaWYgYSBjb2xsaXNpb24gaW4gYW55IGRpcmVjdGlvbi5cbiAgICovXG4gIHZhciBJbU5vdFRvdWNoaW5nWW91ID0gZnVuY3Rpb24oZWxlbWVudCwgcGFyZW50LCBsck9ubHksIHRiT25seSl7XG4gICAgdmFyIGVsZURpbXMgPSBHZXREaW1lbnNpb25zKGVsZW1lbnQpLFxuICAgICAgICB0b3AsIGJvdHRvbSwgbGVmdCwgcmlnaHQ7XG5cbiAgICBpZihwYXJlbnQpe1xuICAgICAgdmFyIHBhckRpbXMgPSBHZXREaW1lbnNpb25zKHBhcmVudCk7XG5cbiAgICAgIGJvdHRvbSA9IChlbGVEaW1zLm9mZnNldC50b3AgKyBlbGVEaW1zLmhlaWdodCA8PSBwYXJEaW1zLmhlaWdodCArIHBhckRpbXMub2Zmc2V0LnRvcCk7XG4gICAgICB0b3AgICAgPSAoZWxlRGltcy5vZmZzZXQudG9wID49IHBhckRpbXMub2Zmc2V0LnRvcCk7XG4gICAgICBsZWZ0ICAgPSAoZWxlRGltcy5vZmZzZXQubGVmdCA+PSBwYXJEaW1zLm9mZnNldC5sZWZ0KTtcbiAgICAgIHJpZ2h0ICA9IChlbGVEaW1zLm9mZnNldC5sZWZ0ICsgZWxlRGltcy53aWR0aCA8PSBwYXJEaW1zLndpZHRoKTtcbiAgICB9ZWxzZXtcbiAgICAgIGJvdHRvbSA9IChlbGVEaW1zLm9mZnNldC50b3AgKyBlbGVEaW1zLmhlaWdodCA8PSBlbGVEaW1zLndpbmRvd0RpbXMuaGVpZ2h0ICsgZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC50b3ApO1xuICAgICAgdG9wICAgID0gKGVsZURpbXMub2Zmc2V0LnRvcCA+PSBlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LnRvcCk7XG4gICAgICBsZWZ0ICAgPSAoZWxlRGltcy5vZmZzZXQubGVmdCA+PSBlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LmxlZnQpO1xuICAgICAgcmlnaHQgID0gKGVsZURpbXMub2Zmc2V0LmxlZnQgKyBlbGVEaW1zLndpZHRoIDw9IGVsZURpbXMud2luZG93RGltcy53aWR0aCk7XG4gICAgfVxuICAgIHZhciBhbGxEaXJzID0gW2JvdHRvbSwgdG9wLCBsZWZ0LCByaWdodF07XG5cbiAgICBpZihsck9ubHkpeyByZXR1cm4gbGVmdCA9PT0gcmlnaHQgPT09IHRydWU7IH1cbiAgICBpZih0Yk9ubHkpeyByZXR1cm4gdG9wID09PSBib3R0b20gPT09IHRydWU7IH1cblxuICAgIHJldHVybiBhbGxEaXJzLmluZGV4T2YoZmFsc2UpID09PSAtMTtcbiAgfTtcblxuICAvKipcbiAgICogVXNlcyBuYXRpdmUgbWV0aG9kcyB0byByZXR1cm4gYW4gb2JqZWN0IG9mIGRpbWVuc2lvbiB2YWx1ZXMuXG4gICAqIEBmdW5jdGlvblxuICAgKiBAcGFyYW0ge2pRdWVyeSB8fCBIVE1MfSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCBvciBET00gZWxlbWVudCBmb3Igd2hpY2ggdG8gZ2V0IHRoZSBkaW1lbnNpb25zLiBDYW4gYmUgYW55IGVsZW1lbnQgb3RoZXIgdGhhdCBkb2N1bWVudCBvciB3aW5kb3cuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IC0gbmVzdGVkIG9iamVjdCBvZiBpbnRlZ2VyIHBpeGVsIHZhbHVlc1xuICAgKiBUT0RPIC0gaWYgZWxlbWVudCBpcyB3aW5kb3csIHJldHVybiBvbmx5IHRob3NlIHZhbHVlcy5cbiAgICovXG4gIHZhciBHZXREaW1lbnNpb25zID0gZnVuY3Rpb24oZWxlbSwgdGVzdCl7XG4gICAgZWxlbSA9IGVsZW0ubGVuZ3RoID8gZWxlbVswXSA6IGVsZW07XG5cbiAgICBpZihlbGVtID09PSB3aW5kb3cgfHwgZWxlbSA9PT0gZG9jdW1lbnQpeyB0aHJvdyBuZXcgRXJyb3IoXCJJJ20gc29ycnksIERhdmUuIEknbSBhZnJhaWQgSSBjYW4ndCBkbyB0aGF0LlwiKTsgfVxuXG4gICAgdmFyIHJlY3QgPSBlbGVtLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgICBwYXJSZWN0ID0gZWxlbS5wYXJlbnROb2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgICB3aW5SZWN0ID0gZG9jdW1lbnQuYm9keS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgd2luWSA9IHdpbmRvdy5wYWdlWU9mZnNldCxcbiAgICAgICAgd2luWCA9IHdpbmRvdy5wYWdlWE9mZnNldDtcblxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogcmVjdC53aWR0aCxcbiAgICAgIGhlaWdodDogcmVjdC5oZWlnaHQsXG4gICAgICBvZmZzZXQ6IHtcbiAgICAgICAgdG9wOiByZWN0LnRvcCArIHdpblksXG4gICAgICAgIGxlZnQ6IHJlY3QubGVmdCArIHdpblhcbiAgICAgIH0sXG4gICAgICBwYXJlbnREaW1zOiB7XG4gICAgICAgIHdpZHRoOiBwYXJSZWN0LndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHBhclJlY3QuaGVpZ2h0LFxuICAgICAgICBvZmZzZXQ6IHtcbiAgICAgICAgICB0b3A6IHBhclJlY3QudG9wICsgd2luWSxcbiAgICAgICAgICBsZWZ0OiBwYXJSZWN0LmxlZnQgKyB3aW5YXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB3aW5kb3dEaW1zOiB7XG4gICAgICAgIHdpZHRoOiB3aW5SZWN0LndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHdpblJlY3QuaGVpZ2h0LFxuICAgICAgICBvZmZzZXQ6IHtcbiAgICAgICAgICB0b3A6IHdpblksXG4gICAgICAgICAgbGVmdDogd2luWFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfTtcbiAgLyoqXG4gICAqIFJldHVybnMgYW4gb2JqZWN0IG9mIHRvcCBhbmQgbGVmdCBpbnRlZ2VyIHBpeGVsIHZhbHVlcyBmb3IgZHluYW1pY2FsbHkgcmVuZGVyZWQgZWxlbWVudHMsXG4gICAqIHN1Y2ggYXM6IFRvb2x0aXAsIFJldmVhbCwgYW5kIERyb3Bkb3duXG4gICAqIEBmdW5jdGlvblxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgZm9yIHRoZSBlbGVtZW50IGJlaW5nIHBvc2l0aW9uZWQuXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBhbmNob3IgLSBqUXVlcnkgb2JqZWN0IGZvciB0aGUgZWxlbWVudCdzIGFuY2hvciBwb2ludC5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHBvc2l0aW9uIC0gYSBzdHJpbmcgcmVsYXRpbmcgdG8gdGhlIGRlc2lyZWQgcG9zaXRpb24gb2YgdGhlIGVsZW1lbnQsIHJlbGF0aXZlIHRvIGl0J3MgYW5jaG9yXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2T2Zmc2V0IC0gaW50ZWdlciBwaXhlbCB2YWx1ZSBvZiBkZXNpcmVkIHZlcnRpY2FsIHNlcGFyYXRpb24gYmV0d2VlbiBhbmNob3IgYW5kIGVsZW1lbnQuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBoT2Zmc2V0IC0gaW50ZWdlciBwaXhlbCB2YWx1ZSBvZiBkZXNpcmVkIGhvcml6b250YWwgc2VwYXJhdGlvbiBiZXR3ZWVuIGFuY2hvciBhbmQgZWxlbWVudC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBpc092ZXJmbG93IC0gaWYgYSBjb2xsaXNpb24gZXZlbnQgaXMgZGV0ZWN0ZWQsIHNldHMgdG8gdHJ1ZSB0byBkZWZhdWx0IHRoZSBlbGVtZW50IHRvIGZ1bGwgd2lkdGggLSBhbnkgZGVzaXJlZCBvZmZzZXQuXG4gICAqIFRPRE8gYWx0ZXIvcmV3cml0ZSB0byB3b3JrIHdpdGggYGVtYCB2YWx1ZXMgYXMgd2VsbC9pbnN0ZWFkIG9mIHBpeGVsc1xuICAgKi9cbiAgdmFyIEdldE9mZnNldHMgPSBmdW5jdGlvbihlbGVtZW50LCBhbmNob3IsIHBvc2l0aW9uLCB2T2Zmc2V0LCBoT2Zmc2V0LCBpc092ZXJmbG93KXtcbiAgICB2YXIgJGVsZURpbXMgPSBHZXREaW1lbnNpb25zKGVsZW1lbnQpLFxuICAgIC8vIHZhciAkZWxlRGltcyA9IEdldERpbWVuc2lvbnMoZWxlbWVudCksXG4gICAgICAgICRhbmNob3JEaW1zID0gYW5jaG9yID8gR2V0RGltZW5zaW9ucyhhbmNob3IpIDogbnVsbDtcbiAgICAgICAgLy8gJGFuY2hvckRpbXMgPSBhbmNob3IgPyBHZXREaW1lbnNpb25zKGFuY2hvcikgOiBudWxsO1xuICAgIHN3aXRjaChwb3NpdGlvbil7XG4gICAgICBjYXNlICd0b3AnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0LFxuICAgICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCAtICgkZWxlRGltcy5oZWlnaHQgKyB2T2Zmc2V0KVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2xlZnQnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0IC0gKCRlbGVEaW1zLndpZHRoICsgaE9mZnNldCksXG4gICAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncmlnaHQnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgJGFuY2hvckRpbXMud2lkdGggKyBoT2Zmc2V0LFxuICAgICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcFxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2NlbnRlciB0b3AnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICgkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArICgkYW5jaG9yRGltcy53aWR0aCAvIDIpKSAtICgkZWxlRGltcy53aWR0aCAvIDIpLFxuICAgICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCAtICgkZWxlRGltcy5oZWlnaHQgKyB2T2Zmc2V0KVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2NlbnRlciBib3R0b20nOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6IGlzT3ZlcmZsb3cgPyBoT2Zmc2V0IDogKCgkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArICgkYW5jaG9yRGltcy53aWR0aCAvIDIpKSAtICgkZWxlRGltcy53aWR0aCAvIDIpKSxcbiAgICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3AgKyAkYW5jaG9yRGltcy5oZWlnaHQgKyB2T2Zmc2V0XG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnY2VudGVyIGxlZnQnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0IC0gKCRlbGVEaW1zLndpZHRoICsgaE9mZnNldCksXG4gICAgICAgICAgdG9wOiAoJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICgkYW5jaG9yRGltcy5oZWlnaHQgLyAyKSkgLSAoJGVsZURpbXMuaGVpZ2h0IC8gMilcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjZW50ZXIgcmlnaHQnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgJGFuY2hvckRpbXMud2lkdGggKyBoT2Zmc2V0ICsgMSxcbiAgICAgICAgICB0b3A6ICgkYW5jaG9yRGltcy5vZmZzZXQudG9wICsgKCRhbmNob3JEaW1zLmhlaWdodCAvIDIpKSAtICgkZWxlRGltcy5oZWlnaHQgLyAyKVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2NlbnRlcic6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbGVmdDogKCRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LmxlZnQgKyAoJGVsZURpbXMud2luZG93RGltcy53aWR0aCAvIDIpKSAtICgkZWxlRGltcy53aWR0aCAvIDIpLFxuICAgICAgICAgIHRvcDogKCRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LnRvcCArICgkZWxlRGltcy53aW5kb3dEaW1zLmhlaWdodCAvIDIpKSAtICgkZWxlRGltcy5oZWlnaHQgLyAyKVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3JldmVhbCc6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbGVmdDogKCRlbGVEaW1zLndpbmRvd0RpbXMud2lkdGggLSAkZWxlRGltcy53aWR0aCkgLyAyLFxuICAgICAgICAgIHRvcDogJGVsZURpbXMud2luZG93RGltcy5vZmZzZXQudG9wICsgdk9mZnNldFxuICAgICAgICB9O1xuICAgICAgY2FzZSAncmV2ZWFsIGZ1bGwnOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LmxlZnQsXG4gICAgICAgICAgdG9wOiAkZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC50b3BcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0LFxuICAgICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICRhbmNob3JEaW1zLmhlaWdodCArIHZPZmZzZXRcbiAgICAgICAgfTtcbiAgICB9XG4gIH07XG4gIEZvdW5kYXRpb24uQm94ID0ge1xuICAgIEltTm90VG91Y2hpbmdZb3U6IEltTm90VG91Y2hpbmdZb3UsXG4gICAgR2V0RGltZW5zaW9uczogR2V0RGltZW5zaW9ucyxcbiAgICBHZXRPZmZzZXRzOiBHZXRPZmZzZXRzXG4gIH07XG59KHdpbmRvdy5Gb3VuZGF0aW9uLCB3aW5kb3cpO1xuIiwiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiBUaGlzIHV0aWwgd2FzIGNyZWF0ZWQgYnkgTWFyaXVzIE9sYmVydHogKlxuICogUGxlYXNlIHRoYW5rIE1hcml1cyBvbiBHaXRIdWIgL293bGJlcnR6ICpcbiAqIG9yIHRoZSB3ZWIgaHR0cDovL3d3dy5tYXJpdXNvbGJlcnR6LmRlLyAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiFmdW5jdGlvbigkLCBGb3VuZGF0aW9uKXtcbiAgJ3VzZSBzdHJpY3QnO1xuICBGb3VuZGF0aW9uLktleWJvYXJkID0ge307XG5cbiAgdmFyIGtleUNvZGVzID0ge1xuICAgIDk6ICdUQUInLFxuICAgIDEzOiAnRU5URVInLFxuICAgIDI3OiAnRVNDQVBFJyxcbiAgICAzMjogJ1NQQUNFJyxcbiAgICAzNzogJ0FSUk9XX0xFRlQnLFxuICAgIDM4OiAnQVJST1dfVVAnLFxuICAgIDM5OiAnQVJST1dfUklHSFQnLFxuICAgIDQwOiAnQVJST1dfRE9XTidcbiAgfTtcblxuICAvKlxuICAgKiBDb25zdGFudHMgZm9yIGVhc2llciBjb21wYXJpbmcuXG4gICAqIENhbiBiZSB1c2VkIGxpa2UgRm91bmRhdGlvbi5wYXJzZUtleShldmVudCkgPT09IEZvdW5kYXRpb24ua2V5cy5TUEFDRVxuICAgKi9cbiAgdmFyIGtleXMgPSAoZnVuY3Rpb24oa2NzKSB7XG4gICAgdmFyIGsgPSB7fTtcbiAgICBmb3IgKHZhciBrYyBpbiBrY3MpIGtba2NzW2tjXV0gPSBrY3Nba2NdO1xuICAgIHJldHVybiBrO1xuICB9KShrZXlDb2Rlcyk7XG5cbiAgRm91bmRhdGlvbi5LZXlib2FyZC5rZXlzID0ga2V5cztcblxuICAvKipcbiAgICogUGFyc2VzIHRoZSAoa2V5Ym9hcmQpIGV2ZW50IGFuZCByZXR1cm5zIGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpdHMga2V5XG4gICAqIENhbiBiZSB1c2VkIGxpa2UgRm91bmRhdGlvbi5wYXJzZUtleShldmVudCkgPT09IEZvdW5kYXRpb24ua2V5cy5TUEFDRVxuICAgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIHRoZSBldmVudCBnZW5lcmF0ZWQgYnkgdGhlIGV2ZW50IGhhbmRsZXJcbiAgICogQHJldHVybiBTdHJpbmcga2V5IC0gU3RyaW5nIHRoYXQgcmVwcmVzZW50cyB0aGUga2V5IHByZXNzZWRcbiAgICovXG4gIHZhciBwYXJzZUtleSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdmFyIGtleSA9IGtleUNvZGVzW2V2ZW50LndoaWNoIHx8IGV2ZW50LmtleUNvZGVdIHx8IFN0cmluZy5mcm9tQ2hhckNvZGUoZXZlbnQud2hpY2gpLnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKGV2ZW50LnNoaWZ0S2V5KSBrZXkgPSAnU0hJRlRfJyArIGtleTtcbiAgICBpZiAoZXZlbnQuY3RybEtleSkga2V5ID0gJ0NUUkxfJyArIGtleTtcbiAgICBpZiAoZXZlbnQuYWx0S2V5KSBrZXkgPSAnQUxUXycgKyBrZXk7XG4gICAgcmV0dXJuIGtleTtcbiAgfTtcbiAgRm91bmRhdGlvbi5LZXlib2FyZC5wYXJzZUtleSA9IHBhcnNlS2V5O1xuXG5cbiAgLy8gcGxhaW4gY29tbWFuZHMgcGVyIGNvbXBvbmVudCBnbyBoZXJlLCBsdHIgYW5kIHJ0bCBhcmUgbWVyZ2VkIGJhc2VkIG9uIG9yaWVudGF0aW9uXG4gIHZhciBjb21tYW5kcyA9IHt9O1xuXG4gIC8qKlxuICAgKiBIYW5kbGVzIHRoZSBnaXZlbiAoa2V5Ym9hcmQpIGV2ZW50XG4gICAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gdGhlIGV2ZW50IGdlbmVyYXRlZCBieSB0aGUgZXZlbnQgaGFuZGxlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29tcG9uZW50IC0gRm91bmRhdGlvbiBjb21wb25lbnQncyBuYW1lLCBlLmcuIFNsaWRlciBvciBSZXZlYWxcbiAgICogQHBhcmFtIHtPYmplY3RzfSBmdW5jdGlvbnMgLSBjb2xsZWN0aW9uIG9mIGZ1bmN0aW9ucyB0aGF0IGFyZSB0byBiZSBleGVjdXRlZFxuICAgKi9cbiAgdmFyIGhhbmRsZUtleSA9IGZ1bmN0aW9uKGV2ZW50LCBjb21wb25lbnQsIGZ1bmN0aW9ucykge1xuICAgIHZhciBjb21tYW5kTGlzdCA9IGNvbW1hbmRzW2NvbXBvbmVudF0sXG4gICAgICBrZXlDb2RlID0gcGFyc2VLZXkoZXZlbnQpLFxuICAgICAgY21kcyxcbiAgICAgIGNvbW1hbmQsXG4gICAgICBmbjtcbiAgICBpZiAoIWNvbW1hbmRMaXN0KSByZXR1cm4gY29uc29sZS53YXJuKCdDb21wb25lbnQgbm90IGRlZmluZWQhJyk7XG5cbiAgICBpZiAodHlwZW9mIGNvbW1hbmRMaXN0Lmx0ciA9PT0gJ3VuZGVmaW5lZCcpIHsgLy8gdGhpcyBjb21wb25lbnQgZG9lcyBub3QgZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGx0ciBhbmQgcnRsXG4gICAgICAgIGNtZHMgPSBjb21tYW5kTGlzdDsgLy8gdXNlIHBsYWluIGxpc3RcbiAgICB9IGVsc2UgeyAvLyBtZXJnZSBsdHIgYW5kIHJ0bDogaWYgZG9jdW1lbnQgaXMgcnRsLCBydGwgb3ZlcndyaXRlcyBsdHIgYW5kIHZpY2UgdmVyc2FcbiAgICAgICAgaWYgKEZvdW5kYXRpb24ucnRsKCkpIGNtZHMgPSAkLmV4dGVuZCh7fSwgY29tbWFuZExpc3QubHRyLCBjb21tYW5kTGlzdC5ydGwpO1xuXG4gICAgICAgIGVsc2UgY21kcyA9ICQuZXh0ZW5kKHt9LCBjb21tYW5kTGlzdC5ydGwsIGNvbW1hbmRMaXN0Lmx0cik7XG4gICAgfVxuICAgIGNvbW1hbmQgPSBjbWRzW2tleUNvZGVdO1xuXG5cbiAgICBmbiA9IGZ1bmN0aW9uc1tjb21tYW5kXTtcbiAgICBpZiAoZm4gJiYgdHlwZW9mIGZuID09PSAnZnVuY3Rpb24nKSB7IC8vIGV4ZWN1dGUgZnVuY3Rpb24gIGlmIGV4aXN0c1xuICAgICAgICBmbi5hcHBseSgpO1xuICAgICAgICBpZiAoZnVuY3Rpb25zLmhhbmRsZWQgfHwgdHlwZW9mIGZ1bmN0aW9ucy5oYW5kbGVkID09PSAnZnVuY3Rpb24nKSB7IC8vIGV4ZWN1dGUgZnVuY3Rpb24gd2hlbiBldmVudCB3YXMgaGFuZGxlZFxuICAgICAgICAgICAgZnVuY3Rpb25zLmhhbmRsZWQuYXBwbHkoKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmdW5jdGlvbnMudW5oYW5kbGVkIHx8IHR5cGVvZiBmdW5jdGlvbnMudW5oYW5kbGVkID09PSAnZnVuY3Rpb24nKSB7IC8vIGV4ZWN1dGUgZnVuY3Rpb24gd2hlbiBldmVudCB3YXMgbm90IGhhbmRsZWRcbiAgICAgICAgICAgIGZ1bmN0aW9ucy51bmhhbmRsZWQuYXBwbHkoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgfTtcbiAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkgPSBoYW5kbGVLZXk7XG5cbiAgLyoqXG4gICAqIEZpbmRzIGFsbCBmb2N1c2FibGUgZWxlbWVudHMgd2l0aGluIHRoZSBnaXZlbiBgJGVsZW1lbnRgXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gc2VhcmNoIHdpdGhpblxuICAgKiBAcmV0dXJuIHtqUXVlcnl9ICRmb2N1c2FibGUgLSBhbGwgZm9jdXNhYmxlIGVsZW1lbnRzIHdpdGhpbiBgJGVsZW1lbnRgXG4gICAqL1xuICB2YXIgZmluZEZvY3VzYWJsZSA9IGZ1bmN0aW9uKCRlbGVtZW50KSB7XG4gICAgcmV0dXJuICRlbGVtZW50LmZpbmQoJ2FbaHJlZl0sIGFyZWFbaHJlZl0sIGlucHV0Om5vdChbZGlzYWJsZWRdKSwgc2VsZWN0Om5vdChbZGlzYWJsZWRdKSwgdGV4dGFyZWE6bm90KFtkaXNhYmxlZF0pLCBidXR0b246bm90KFtkaXNhYmxlZF0pLCBpZnJhbWUsIG9iamVjdCwgZW1iZWQsICpbdGFiaW5kZXhdLCAqW2NvbnRlbnRlZGl0YWJsZV0nKS5maWx0ZXIoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoISQodGhpcykuaXMoJzp2aXNpYmxlJykgfHwgJCh0aGlzKS5hdHRyKCd0YWJpbmRleCcpIDwgMCkgeyByZXR1cm4gZmFsc2U7IH0gLy9vbmx5IGhhdmUgdmlzaWJsZSBlbGVtZW50cyBhbmQgdGhvc2UgdGhhdCBoYXZlIGEgdGFiaW5kZXggZ3JlYXRlciBvciBlcXVhbCAwXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfTtcbiAgRm91bmRhdGlvbi5LZXlib2FyZC5maW5kRm9jdXNhYmxlID0gZmluZEZvY3VzYWJsZTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgY29tcG9uZW50IG5hbWUgbmFtZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY29tcG9uZW50IC0gRm91bmRhdGlvbiBjb21wb25lbnQsIGUuZy4gU2xpZGVyIG9yIFJldmVhbFxuICAgKiBAcmV0dXJuIFN0cmluZyBjb21wb25lbnROYW1lXG4gICAqL1xuXG4gIHZhciByZWdpc3RlciA9IGZ1bmN0aW9uKGNvbXBvbmVudE5hbWUsIGNtZHMpIHtcbiAgICBjb21tYW5kc1tjb21wb25lbnROYW1lXSA9IGNtZHM7XG4gIH07XG4gIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIgPSByZWdpc3Rlcjtcbn0oalF1ZXJ5LCB3aW5kb3cuRm91bmRhdGlvbik7XG4iLCIhZnVuY3Rpb24oJCwgRm91bmRhdGlvbikge1xuXG4vLyBEZWZhdWx0IHNldCBvZiBtZWRpYSBxdWVyaWVzXG52YXIgZGVmYXVsdFF1ZXJpZXMgPSB7XG4gICdkZWZhdWx0JyA6ICdvbmx5IHNjcmVlbicsXG4gIGxhbmRzY2FwZSA6ICdvbmx5IHNjcmVlbiBhbmQgKG9yaWVudGF0aW9uOiBsYW5kc2NhcGUpJyxcbiAgcG9ydHJhaXQgOiAnb25seSBzY3JlZW4gYW5kIChvcmllbnRhdGlvbjogcG9ydHJhaXQpJyxcbiAgcmV0aW5hIDogJ29ubHkgc2NyZWVuIGFuZCAoLXdlYmtpdC1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAyKSwnICtcbiAgICAnb25seSBzY3JlZW4gYW5kIChtaW4tLW1vei1kZXZpY2UtcGl4ZWwtcmF0aW86IDIpLCcgK1xuICAgICdvbmx5IHNjcmVlbiBhbmQgKC1vLW1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDIvMSksJyArXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAobWluLWRldmljZS1waXhlbC1yYXRpbzogMiksJyArXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDE5MmRwaSksJyArXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDJkcHB4KSdcbn07XG5cbnZhciBNZWRpYVF1ZXJ5ID0ge1xuICBxdWVyaWVzOiBbXSxcbiAgY3VycmVudDogJycsXG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgc2NyZWVuIGlzIGF0IGxlYXN0IGFzIHdpZGUgYXMgYSBicmVha3BvaW50LlxuICAgKiBAZnVuY3Rpb25cbiAgICogQHBhcmFtIHtTdHJpbmd9IHNpemUgLSBOYW1lIG9mIHRoZSBicmVha3BvaW50IHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gYHRydWVgIGlmIHRoZSBicmVha3BvaW50IG1hdGNoZXMsIGBmYWxzZWAgaWYgaXQncyBzbWFsbGVyLlxuICAgKi9cbiAgYXRMZWFzdDogZnVuY3Rpb24oc2l6ZSkge1xuICAgIHZhciBxdWVyeSA9IHRoaXMuZ2V0KHNpemUpO1xuXG4gICAgaWYgKHF1ZXJ5KSB7XG4gICAgICByZXR1cm4gd2luZG93Lm1hdGNoTWVkaWEocXVlcnkpLm1hdGNoZXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBtZWRpYSBxdWVyeSBvZiBhIGJyZWFrcG9pbnQuXG4gICAqIEBmdW5jdGlvblxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2l6ZSAtIE5hbWUgb2YgdGhlIGJyZWFrcG9pbnQgdG8gZ2V0LlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9IC0gVGhlIG1lZGlhIHF1ZXJ5IG9mIHRoZSBicmVha3BvaW50LCBvciBgbnVsbGAgaWYgdGhlIGJyZWFrcG9pbnQgZG9lc24ndCBleGlzdC5cbiAgICovXG4gIGdldDogZnVuY3Rpb24oc2l6ZSkge1xuICAgIGZvciAodmFyIGkgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG4gICAgICBpZiAoc2l6ZSA9PT0gcXVlcnkubmFtZSkgcmV0dXJuIHF1ZXJ5LnZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyB0aGUgbWVkaWEgcXVlcnkgaGVscGVyLCBieSBleHRyYWN0aW5nIHRoZSBicmVha3BvaW50IGxpc3QgZnJvbSB0aGUgQ1NTIGFuZCBhY3RpdmF0aW5nIHRoZSBicmVha3BvaW50IHdhdGNoZXIuXG4gICAqIEBmdW5jdGlvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2luaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZXh0cmFjdGVkU3R5bGVzID0gJCgnLmZvdW5kYXRpb24tbXEnKS5jc3MoJ2ZvbnQtZmFtaWx5Jyk7XG4gICAgdmFyIG5hbWVkUXVlcmllcztcblxuICAgIG5hbWVkUXVlcmllcyA9IHBhcnNlU3R5bGVUb09iamVjdChleHRyYWN0ZWRTdHlsZXMpO1xuXG4gICAgZm9yICh2YXIga2V5IGluIG5hbWVkUXVlcmllcykge1xuICAgICAgc2VsZi5xdWVyaWVzLnB1c2goe1xuICAgICAgICBuYW1lOiBrZXksXG4gICAgICAgIHZhbHVlOiAnb25seSBzY3JlZW4gYW5kIChtaW4td2lkdGg6ICcgKyBuYW1lZFF1ZXJpZXNba2V5XSArICcpJ1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50ID0gdGhpcy5fZ2V0Q3VycmVudFNpemUoKTtcblxuICAgIHRoaXMuX3dhdGNoZXIoKTtcblxuICAgIC8vIEV4dGVuZCBkZWZhdWx0IHF1ZXJpZXNcbiAgICAvLyBuYW1lZFF1ZXJpZXMgPSAkLmV4dGVuZChkZWZhdWx0UXVlcmllcywgbmFtZWRRdWVyaWVzKTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgY3VycmVudCBicmVha3BvaW50IG5hbWUgYnkgdGVzdGluZyBldmVyeSBicmVha3BvaW50IGFuZCByZXR1cm5pbmcgdGhlIGxhc3Qgb25lIHRvIG1hdGNoICh0aGUgYmlnZ2VzdCBvbmUpLlxuICAgKiBAZnVuY3Rpb25cbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge1N0cmluZ30gTmFtZSBvZiB0aGUgY3VycmVudCBicmVha3BvaW50LlxuICAgKi9cbiAgX2dldEN1cnJlbnRTaXplOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgbWF0Y2hlZDtcblxuICAgIGZvciAodmFyIGkgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG5cbiAgICAgIGlmICh3aW5kb3cubWF0Y2hNZWRpYShxdWVyeS52YWx1ZSkubWF0Y2hlcykge1xuICAgICAgICBtYXRjaGVkID0gcXVlcnk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIG1hdGNoZWQgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gbWF0Y2hlZC5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbWF0Y2hlZDtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEFjdGl2YXRlcyB0aGUgYnJlYWtwb2ludCB3YXRjaGVyLCB3aGljaCBmaXJlcyBhbiBldmVudCBvbiB0aGUgd2luZG93IHdoZW5ldmVyIHRoZSBicmVha3BvaW50IGNoYW5nZXMuXG4gICAqIEBmdW5jdGlvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3dhdGNoZXI6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAkKHdpbmRvdykub24oJ3Jlc2l6ZS56Zi5tZWRpYXF1ZXJ5JywgZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbmV3U2l6ZSA9IF90aGlzLl9nZXRDdXJyZW50U2l6ZSgpO1xuXG4gICAgICBpZiAobmV3U2l6ZSAhPT0gX3RoaXMuY3VycmVudCkge1xuICAgICAgICAvLyBCcm9hZGNhc3QgdGhlIG1lZGlhIHF1ZXJ5IGNoYW5nZSBvbiB0aGUgd2luZG93XG4gICAgICAgICQod2luZG93KS50cmlnZ2VyKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCBbbmV3U2l6ZSwgX3RoaXMuY3VycmVudF0pO1xuXG4gICAgICAgIC8vIENoYW5nZSB0aGUgY3VycmVudCBtZWRpYSBxdWVyeVxuICAgICAgICBfdGhpcy5jdXJyZW50ID0gbmV3U2l6ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufTtcblxuRm91bmRhdGlvbi5NZWRpYVF1ZXJ5ID0gTWVkaWFRdWVyeTtcblxuLy8gbWF0Y2hNZWRpYSgpIHBvbHlmaWxsIC0gVGVzdCBhIENTUyBtZWRpYSB0eXBlL3F1ZXJ5IGluIEpTLlxuLy8gQXV0aG9ycyAmIGNvcHlyaWdodCAoYykgMjAxMjogU2NvdHQgSmVobCwgUGF1bCBJcmlzaCwgTmljaG9sYXMgWmFrYXMsIERhdmlkIEtuaWdodC4gRHVhbCBNSVQvQlNEIGxpY2Vuc2VcbndpbmRvdy5tYXRjaE1lZGlhIHx8ICh3aW5kb3cubWF0Y2hNZWRpYSA9IGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgLy8gRm9yIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBtYXRjaE1lZGl1bSBhcGkgc3VjaCBhcyBJRSA5IGFuZCB3ZWJraXRcbiAgdmFyIHN0eWxlTWVkaWEgPSAod2luZG93LnN0eWxlTWVkaWEgfHwgd2luZG93Lm1lZGlhKTtcblxuICAvLyBGb3IgdGhvc2UgdGhhdCBkb24ndCBzdXBwb3J0IG1hdGNoTWVkaXVtXG4gIGlmICghc3R5bGVNZWRpYSkge1xuICAgIHZhciBzdHlsZSAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKSxcbiAgICBzY3JpcHQgICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXSxcbiAgICBpbmZvICAgICAgICA9IG51bGw7XG5cbiAgICBzdHlsZS50eXBlICA9ICd0ZXh0L2Nzcyc7XG4gICAgc3R5bGUuaWQgICAgPSAnbWF0Y2htZWRpYWpzLXRlc3QnO1xuXG4gICAgc2NyaXB0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHN0eWxlLCBzY3JpcHQpO1xuXG4gICAgLy8gJ3N0eWxlLmN1cnJlbnRTdHlsZScgaXMgdXNlZCBieSBJRSA8PSA4IGFuZCAnd2luZG93LmdldENvbXB1dGVkU3R5bGUnIGZvciBhbGwgb3RoZXIgYnJvd3NlcnNcbiAgICBpbmZvID0gKCdnZXRDb21wdXRlZFN0eWxlJyBpbiB3aW5kb3cpICYmIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHN0eWxlLCBudWxsKSB8fCBzdHlsZS5jdXJyZW50U3R5bGU7XG5cbiAgICBzdHlsZU1lZGlhID0ge1xuICAgICAgbWF0Y2hNZWRpdW06IGZ1bmN0aW9uKG1lZGlhKSB7XG4gICAgICAgIHZhciB0ZXh0ID0gJ0BtZWRpYSAnICsgbWVkaWEgKyAneyAjbWF0Y2htZWRpYWpzLXRlc3QgeyB3aWR0aDogMXB4OyB9IH0nO1xuXG4gICAgICAgIC8vICdzdHlsZS5zdHlsZVNoZWV0JyBpcyB1c2VkIGJ5IElFIDw9IDggYW5kICdzdHlsZS50ZXh0Q29udGVudCcgZm9yIGFsbCBvdGhlciBicm93c2Vyc1xuICAgICAgICBpZiAoc3R5bGUuc3R5bGVTaGVldCkge1xuICAgICAgICAgIHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IHRleHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSB0ZXh0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGVzdCBpZiBtZWRpYSBxdWVyeSBpcyB0cnVlIG9yIGZhbHNlXG4gICAgICAgIHJldHVybiBpbmZvLndpZHRoID09PSAnMXB4JztcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKG1lZGlhKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1hdGNoZXM6IHN0eWxlTWVkaWEubWF0Y2hNZWRpdW0obWVkaWEgfHwgJ2FsbCcpLFxuICAgICAgbWVkaWE6IG1lZGlhIHx8ICdhbGwnXG4gICAgfTtcbiAgfTtcbn0oKSk7XG5cbi8vIFRoYW5rIHlvdTogaHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9xdWVyeS1zdHJpbmdcbmZ1bmN0aW9uIHBhcnNlU3R5bGVUb09iamVjdChzdHIpIHtcbiAgdmFyIHN0eWxlT2JqZWN0ID0ge307XG5cbiAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHN0eWxlT2JqZWN0O1xuICB9XG5cbiAgc3RyID0gc3RyLnRyaW0oKS5zbGljZSgxLCAtMSk7IC8vIGJyb3dzZXJzIHJlLXF1b3RlIHN0cmluZyBzdHlsZSB2YWx1ZXNcblxuICBpZiAoIXN0cikge1xuICAgIHJldHVybiBzdHlsZU9iamVjdDtcbiAgfVxuXG4gIHN0eWxlT2JqZWN0ID0gc3RyLnNwbGl0KCcmJykucmVkdWNlKGZ1bmN0aW9uKHJldCwgcGFyYW0pIHtcbiAgICB2YXIgcGFydHMgPSBwYXJhbS5yZXBsYWNlKC9cXCsvZywgJyAnKS5zcGxpdCgnPScpO1xuICAgIHZhciBrZXkgPSBwYXJ0c1swXTtcbiAgICB2YXIgdmFsID0gcGFydHNbMV07XG4gICAga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGtleSk7XG5cbiAgICAvLyBtaXNzaW5nIGA9YCBzaG91bGQgYmUgYG51bGxgOlxuICAgIC8vIGh0dHA6Ly93My5vcmcvVFIvMjAxMi9XRC11cmwtMjAxMjA1MjQvI2NvbGxlY3QtdXJsLXBhcmFtZXRlcnNcbiAgICB2YWwgPSB2YWwgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBkZWNvZGVVUklDb21wb25lbnQodmFsKTtcblxuICAgIGlmICghcmV0Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIHJldFtrZXldID0gdmFsO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShyZXRba2V5XSkpIHtcbiAgICAgIHJldFtrZXldLnB1c2godmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0W2tleV0gPSBbcmV0W2tleV0sIHZhbF07XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0sIHt9KTtcblxuICByZXR1cm4gc3R5bGVPYmplY3Q7XG59XG5cbn0oalF1ZXJ5LCBGb3VuZGF0aW9uKTtcbiIsIi8qKlxuICogTW90aW9uIG1vZHVsZS5cbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5tb3Rpb25cbiAqL1xuIWZ1bmN0aW9uKCQsIEZvdW5kYXRpb24pIHtcblxudmFyIGluaXRDbGFzc2VzICAgPSBbJ211aS1lbnRlcicsICdtdWktbGVhdmUnXTtcbnZhciBhY3RpdmVDbGFzc2VzID0gWydtdWktZW50ZXItYWN0aXZlJywgJ211aS1sZWF2ZS1hY3RpdmUnXTtcblxuZnVuY3Rpb24gYW5pbWF0ZShpc0luLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKSB7XG4gIGVsZW1lbnQgPSAkKGVsZW1lbnQpLmVxKDApO1xuXG4gIGlmICghZWxlbWVudC5sZW5ndGgpIHJldHVybjtcblxuICB2YXIgaW5pdENsYXNzID0gaXNJbiA/IGluaXRDbGFzc2VzWzBdIDogaW5pdENsYXNzZXNbMV07XG4gIHZhciBhY3RpdmVDbGFzcyA9IGlzSW4gPyBhY3RpdmVDbGFzc2VzWzBdIDogYWN0aXZlQ2xhc3Nlc1sxXTtcblxuICAvLyBTZXQgdXAgdGhlIGFuaW1hdGlvblxuICByZXNldCgpO1xuICBlbGVtZW50LmFkZENsYXNzKGFuaW1hdGlvbilcbiAgICAgICAgIC5jc3MoJ3RyYW5zaXRpb24nLCAnbm9uZScpO1xuICAgICAgICAvLyAgLmFkZENsYXNzKGluaXRDbGFzcyk7XG4gIC8vIGlmKGlzSW4pIGVsZW1lbnQuc2hvdygpO1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgZWxlbWVudC5hZGRDbGFzcyhpbml0Q2xhc3MpO1xuICAgIGlmIChpc0luKSBlbGVtZW50LnNob3coKTtcbiAgfSk7XG4gIC8vIFN0YXJ0IHRoZSBhbmltYXRpb25cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uKCkge1xuICAgIGVsZW1lbnRbMF0ub2Zmc2V0V2lkdGg7XG4gICAgZWxlbWVudC5jc3MoJ3RyYW5zaXRpb24nLCAnJyk7XG4gICAgZWxlbWVudC5hZGRDbGFzcyhhY3RpdmVDbGFzcyk7XG4gIH0pO1xuICAvLyBNb3ZlKDUwMCwgZWxlbWVudCwgZnVuY3Rpb24oKXtcbiAgLy8gICAvLyBlbGVtZW50WzBdLm9mZnNldFdpZHRoO1xuICAvLyAgIGVsZW1lbnQuY3NzKCd0cmFuc2l0aW9uJywgJycpO1xuICAvLyAgIGVsZW1lbnQuYWRkQ2xhc3MoYWN0aXZlQ2xhc3MpO1xuICAvLyB9KTtcblxuICAvLyBDbGVhbiB1cCB0aGUgYW5pbWF0aW9uIHdoZW4gaXQgZmluaXNoZXNcbiAgZWxlbWVudC5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKGVsZW1lbnQpLCBmaW5pc2gpOy8vLm9uZSgnZmluaXNoZWQuemYuYW5pbWF0ZScsIGZpbmlzaCk7XG5cbiAgLy8gSGlkZXMgdGhlIGVsZW1lbnQgKGZvciBvdXQgYW5pbWF0aW9ucyksIHJlc2V0cyB0aGUgZWxlbWVudCwgYW5kIHJ1bnMgYSBjYWxsYmFja1xuICBmdW5jdGlvbiBmaW5pc2goKSB7XG4gICAgaWYgKCFpc0luKSBlbGVtZW50LmhpZGUoKTtcbiAgICByZXNldCgpO1xuICAgIGlmIChjYikgY2IuYXBwbHkoZWxlbWVudCk7XG4gIH1cblxuICAvLyBSZXNldHMgdHJhbnNpdGlvbnMgYW5kIHJlbW92ZXMgbW90aW9uLXNwZWNpZmljIGNsYXNzZXNcbiAgZnVuY3Rpb24gcmVzZXQoKSB7XG4gICAgZWxlbWVudFswXS5zdHlsZS50cmFuc2l0aW9uRHVyYXRpb24gPSAwO1xuICAgIGVsZW1lbnQucmVtb3ZlQ2xhc3MoaW5pdENsYXNzICsgJyAnICsgYWN0aXZlQ2xhc3MgKyAnICcgKyBhbmltYXRpb24pO1xuICB9XG59XG5cbnZhciBNb3Rpb24gPSB7XG4gIGFuaW1hdGVJbjogZnVuY3Rpb24oZWxlbWVudCwgYW5pbWF0aW9uLCAvKmR1cmF0aW9uLCovIGNiKSB7XG4gICAgYW5pbWF0ZSh0cnVlLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKTtcbiAgfSxcblxuICBhbmltYXRlT3V0OiBmdW5jdGlvbihlbGVtZW50LCBhbmltYXRpb24sIC8qZHVyYXRpb24sKi8gY2IpIHtcbiAgICBhbmltYXRlKGZhbHNlLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKTtcbiAgfVxufTtcblxudmFyIE1vdmUgPSBmdW5jdGlvbihkdXJhdGlvbiwgZWxlbSwgZm4pe1xuICB2YXIgYW5pbSwgcHJvZywgc3RhcnQgPSBudWxsO1xuICAvLyBjb25zb2xlLmxvZygnY2FsbGVkJyk7XG5cbiAgZnVuY3Rpb24gbW92ZSh0cyl7XG4gICAgaWYoIXN0YXJ0KSBzdGFydCA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcbiAgICAvLyBjb25zb2xlLmxvZyhzdGFydCwgdHMpO1xuICAgIHByb2cgPSB0cyAtIHN0YXJ0O1xuICAgIGZuLmFwcGx5KGVsZW0pO1xuXG4gICAgaWYocHJvZyA8IGR1cmF0aW9uKXsgYW5pbSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobW92ZSwgZWxlbSk7IH1cbiAgICBlbHNle1xuICAgICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKGFuaW0pO1xuICAgICAgZWxlbS50cmlnZ2VyKCdmaW5pc2hlZC56Zi5hbmltYXRlJywgW2VsZW1dKS50cmlnZ2VySGFuZGxlcignZmluaXNoZWQuemYuYW5pbWF0ZScsIFtlbGVtXSk7XG4gICAgfVxuICB9XG4gIGFuaW0gPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKG1vdmUpO1xufTtcblxuRm91bmRhdGlvbi5Nb3ZlID0gTW92ZTtcbkZvdW5kYXRpb24uTW90aW9uID0gTW90aW9uO1xuXG59KGpRdWVyeSwgRm91bmRhdGlvbik7XG4iLCIhZnVuY3Rpb24oJCwgRm91bmRhdGlvbil7XG4gICd1c2Ugc3RyaWN0JztcbiAgRm91bmRhdGlvbi5OZXN0ID0ge1xuICAgIEZlYXRoZXI6IGZ1bmN0aW9uKG1lbnUsIHR5cGUpe1xuICAgICAgbWVudS5hdHRyKCdyb2xlJywgJ21lbnViYXInKTtcbiAgICAgIHR5cGUgPSB0eXBlIHx8ICd6Zic7XG4gICAgICB2YXIgaXRlbXMgPSBtZW51LmZpbmQoJ2xpJykuYXR0cih7J3JvbGUnOiAnbWVudWl0ZW0nfSksXG4gICAgICAgICAgc3ViTWVudUNsYXNzID0gJ2lzLScgKyB0eXBlICsgJy1zdWJtZW51JyxcbiAgICAgICAgICBzdWJJdGVtQ2xhc3MgPSBzdWJNZW51Q2xhc3MgKyAnLWl0ZW0nLFxuICAgICAgICAgIGhhc1N1YkNsYXNzID0gJ2lzLScgKyB0eXBlICsgJy1zdWJtZW51LXBhcmVudCc7XG4gICAgICBtZW51LmZpbmQoJ2E6Zmlyc3QnKS5hdHRyKCd0YWJpbmRleCcsIDApO1xuICAgICAgaXRlbXMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICB2YXIgJGl0ZW0gPSAkKHRoaXMpLFxuICAgICAgICAgICAgJHN1YiA9ICRpdGVtLmNoaWxkcmVuKCd1bCcpO1xuICAgICAgICBpZigkc3ViLmxlbmd0aCl7XG4gICAgICAgICAgJGl0ZW0uYWRkQ2xhc3MoJ2hhcy1zdWJtZW51ICcgKyBoYXNTdWJDbGFzcylcbiAgICAgICAgICAgICAgIC5hdHRyKHtcbiAgICAgICAgICAgICAgICAgJ2FyaWEtaGFzcG9wdXAnOiB0cnVlLFxuICAgICAgICAgICAgICAgICAnYXJpYS1zZWxlY3RlZCc6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAnYXJpYS1leHBhbmRlZCc6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAnYXJpYS1sYWJlbCc6ICRpdGVtLmNoaWxkcmVuKCdhOmZpcnN0JykudGV4dCgpXG4gICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAkc3ViLmFkZENsYXNzKCdzdWJtZW51ICcgKyBzdWJNZW51Q2xhc3MpXG4gICAgICAgICAgICAgIC5hdHRyKHtcbiAgICAgICAgICAgICAgICAnZGF0YS1zdWJtZW51JzogJycsXG4gICAgICAgICAgICAgICAgJ2FyaWEtaGlkZGVuJzogdHJ1ZSxcbiAgICAgICAgICAgICAgICAncm9sZSc6ICdtZW51J1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZigkaXRlbS5wYXJlbnQoJ1tkYXRhLXN1Ym1lbnVdJykubGVuZ3RoKXtcbiAgICAgICAgICAkaXRlbS5hZGRDbGFzcygnaXMtc3VibWVudS1pdGVtICcgKyBzdWJJdGVtQ2xhc3MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9LFxuICAgIEJ1cm46IGZ1bmN0aW9uKG1lbnUsIHR5cGUpe1xuICAgICAgdmFyIGl0ZW1zID0gbWVudS5maW5kKCdsaScpLnJlbW92ZUF0dHIoJ3RhYmluZGV4JyksXG4gICAgICAgICAgc3ViTWVudUNsYXNzID0gJ2lzLScgKyB0eXBlICsgJy1zdWJtZW51JyxcbiAgICAgICAgICBzdWJJdGVtQ2xhc3MgPSBzdWJNZW51Q2xhc3MgKyAnLWl0ZW0nLFxuICAgICAgICAgIGhhc1N1YkNsYXNzID0gJ2lzLScgKyB0eXBlICsgJy1zdWJtZW51LXBhcmVudCc7XG5cbiAgICAgIC8vIG1lbnUuZmluZCgnLmlzLWFjdGl2ZScpLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUnKTtcbiAgICAgIG1lbnUuZmluZCgnKicpXG4gICAgICAvLyBtZW51LmZpbmQoJy4nICsgc3ViTWVudUNsYXNzICsgJywgLicgKyBzdWJJdGVtQ2xhc3MgKyAnLCAuaXMtYWN0aXZlLCAuaGFzLXN1Ym1lbnUsIC5pcy1zdWJtZW51LWl0ZW0sIC5zdWJtZW51LCBbZGF0YS1zdWJtZW51XScpXG4gICAgICAgICAgLnJlbW92ZUNsYXNzKHN1Yk1lbnVDbGFzcyArICcgJyArIHN1Ykl0ZW1DbGFzcyArICcgJyArIGhhc1N1YkNsYXNzICsgJyBoYXMtc3VibWVudSBpcy1zdWJtZW51LWl0ZW0gc3VibWVudSBpcy1hY3RpdmUnKVxuICAgICAgICAgIC5yZW1vdmVBdHRyKCdkYXRhLXN1Ym1lbnUnKS5jc3MoJ2Rpc3BsYXknLCAnJyk7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKCAgICAgIG1lbnUuZmluZCgnLicgKyBzdWJNZW51Q2xhc3MgKyAnLCAuJyArIHN1Ykl0ZW1DbGFzcyArICcsIC5oYXMtc3VibWVudSwgLmlzLXN1Ym1lbnUtaXRlbSwgLnN1Ym1lbnUsIFtkYXRhLXN1Ym1lbnVdJylcbiAgICAgIC8vICAgICAgICAgICAucmVtb3ZlQ2xhc3Moc3ViTWVudUNsYXNzICsgJyAnICsgc3ViSXRlbUNsYXNzICsgJyBoYXMtc3VibWVudSBpcy1zdWJtZW51LWl0ZW0gc3VibWVudScpXG4gICAgICAvLyAgICAgICAgICAgLnJlbW92ZUF0dHIoJ2RhdGEtc3VibWVudScpKTtcbiAgICAgIC8vIGl0ZW1zLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgIC8vICAgdmFyICRpdGVtID0gJCh0aGlzKSxcbiAgICAgIC8vICAgICAgICRzdWIgPSAkaXRlbS5jaGlsZHJlbigndWwnKTtcbiAgICAgIC8vICAgaWYoJGl0ZW0ucGFyZW50KCdbZGF0YS1zdWJtZW51XScpLmxlbmd0aCl7XG4gICAgICAvLyAgICAgJGl0ZW0ucmVtb3ZlQ2xhc3MoJ2lzLXN1Ym1lbnUtaXRlbSAnICsgc3ViSXRlbUNsYXNzKTtcbiAgICAgIC8vICAgfVxuICAgICAgLy8gICBpZigkc3ViLmxlbmd0aCl7XG4gICAgICAvLyAgICAgJGl0ZW0ucmVtb3ZlQ2xhc3MoJ2hhcy1zdWJtZW51Jyk7XG4gICAgICAvLyAgICAgJHN1Yi5yZW1vdmVDbGFzcygnc3VibWVudSAnICsgc3ViTWVudUNsYXNzKS5yZW1vdmVBdHRyKCdkYXRhLXN1Ym1lbnUnKTtcbiAgICAgIC8vICAgfVxuICAgICAgLy8gfSk7XG4gICAgfVxuICB9O1xufShqUXVlcnksIHdpbmRvdy5Gb3VuZGF0aW9uKTtcbiIsImpRdWVyeSggZnVuY3Rpb24oICQgKSB7XG4gICAgXG4gICAgJCggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgICAgICAkKCBkb2N1bWVudCApLmZvdW5kYXRpb24oKTtcbiAgICAgICAgXG4gICAgfSApO1xuICAgIFxufSApOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
