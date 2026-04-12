/**
 * PageLiner
 *
 * @copyright   2018 Kai Neuwerth
 * @author      Kai Neuwerth
 * @link        https://pageliner.com
 * @modified    Modified distribution by Alexander Kaiser (Apache-2.0)
 */

var oPageLiner = {
    sDefaultColor: '#33ffff',
    blAltKeyReleased: true,
    mousePosition: {
        x: 0,
        y: 0
    },
    goldenSpiral: {
        mode: null,
        rotation: 0,
        flipX: false,
        flipY: false,
        rect: null,
        color: '#f2b200',
        strokeWidth: 2,
        hoverTarget: null,
        lastPlacementMode: null
    },
    shortcutMap: null
};

function debug(sMsg) {
    if (localStorage.getItem('pglnr-ext-blDebug') == "true") {
        console.log(sMsg);
    }
}

/**
 * Convert a rgb color to hex value
 * @param {string} rgb
 * @return {string}
 *
 * @link https://stackoverflow.com/a/3627747/1754123
 */
function rgb2Hex(rgb) {
    rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

    function hex(x) {
        return ("0" + parseInt(x).toString(16)).slice(-2);
    }

    return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}

/**
 * Convert a hex color to a rgb/rgba value
 *
 * @param {string} hex
 * @param {?number} opacity
 *
 * @return {string}
 *
 * @link https://jsfiddle.net/subodhghulaxe/t568u/
 */
function hexToRgba(hex, opacity) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);

    var result = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity / 100 + ')';
    return result;
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.sAction) {
            case 'getGuiStatus':
                sendResponse({'localStorage': localStorage});
                break;
            case 'toggleRulers':
                oPageLiner.toggleRulers();
                sendResponse({});
                break;
            case 'toggleHelplines':
                oPageLiner.toggleHelplines();
                sendResponse({});
                break;
            case 'addHelpLine':
                oPageLiner.addHelpLine(request.posX, request.posY, request.sColor);
                sendResponse({});
                break;
            case 'addHelpLineY':
                oPageLiner.addHelpLine(0, parseInt($(window).scrollTop()) + 100);
                sendResponse({});
                break;
            case 'addCenterLines':
                oPageLiner.addHelpLine(Math.round(window.innerWidth / 2), 0);
                oPageLiner.addHelpLine(0, Math.round(window.innerHeight / 2 + window.pageYOffset));
                sendResponse({});
                break;
            case 'addGrid':
                var iGridMaxWidth = request.maxWidth || 0;
                if (request.widthType === '%') {
                    iGridMaxWidth = Math.round(window.innerWidth * iGridMaxWidth / 100);
                }
                oPageLiner.addGrid(iGridMaxWidth, request.cols || 0, request.colGap || 0, request.rows || 0, {
                    lineColor:      request.lineColor,
                    overlayColor:   request.overlayColor,
                    overlayOpacity: request.overlayOpacity,
                    showOverlay:    request.showOverlay
                });
                sendResponse({});
                break;
            case 'startGoldenSpiralElementMode':
                oPageLiner.startGoldenSpiralElementMode();
                sendResponse({});
                break;
            case 'startGoldenSpiralAreaMode':
                oPageLiner.startGoldenSpiralAreaMode();
                sendResponse({});
                break;
            case 'rotateGoldenSpiral':
                oPageLiner.rotateGoldenSpiral(request.step || 90);
                sendResponse({});
                break;
            case 'setGoldenSpiralStyle':
                oPageLiner.setGoldenSpiralStyle({
                    color: request.color,
                    strokeWidth: request.strokeWidth
                });
                sendResponse({});
                break;
            case 'setGoldenSpiralRotation':
                oPageLiner.setGoldenSpiralRotation(request.rotation);
                sendResponse({});
                break;
            case 'setShortcutMap':
                oPageLiner.setShortcutMap(request.shortcutMap || {});
                sendResponse({});
                break;
            case 'clearGoldenSpiral':
                oPageLiner.clearGoldenSpiral();
                sendResponse({});
                break;
            case 'removeAllHelpLines':
                oPageLiner.removeAllHelpLines();
                sendResponse({});
                break;
            case 'deleteHelpline':
                oPageLiner.deleteHelpline(request.id);
                sendResponse({});
                break;
            case 'editHelpLine':
                oPageLiner.editHelpLine(
                    request.id,
                    (request.posX !== undefined ? request.posX : null),
                    (request.posY !== undefined ? request.posY : null),
                    request.sColor || null,
                    {
                        iThickness: request.iThickness !== undefined ? request.iThickness : null,
                        iOpacity:   request.iOpacity   !== undefined ? request.iOpacity   : null,
                        sStyle:     request.sStyle     !== undefined ? request.sStyle     : null,
                        sLabel:     request.sLabel     !== undefined ? request.sLabel     : null
                    }
                );
                sendResponse({});
                break;
            case 'getAllHelpLines':
                sendResponse(oPageLiner.getAllHelpLines());
                break;
            case 'clearGridOverlays':
                oPageLiner.clearGeneratedGrid();
                sendResponse({});
                break;
            case 'setLabelVisibility':
                localStorage.setItem('pglnr-ext-blShowLabels', request.blShow ? 'true' : 'false');
                $('.pglnr-ext-helpline-tooltip').toggleClass('pglnr-ext-tooltip-visible', !!request.blShow);
                sendResponse({});
                break;
            case 'importHelpLines':
                if (Array.isArray(request.aHelpLines)) {
                    $('.pglnr-ext-helpline').remove();
                    oPageLiner.setAllHelpLines(request.aHelpLines);
                    var aImported = oPageLiner.getAllHelpLines();
                    if (aImported && aImported.length > 0) {
                        localStorage.setItem('pglnr-ext-rulerIsActive', true);
                        localStorage.setItem('pglnr-ext-helplineIsActive', true);
                        oPageLiner.init();
                    }
                    oPageLiner.updatePopUp();
                }
                sendResponse({});
                break;
        }
        return true;
    }
);

$(document).bind('mousemove', function (e) {
    oPageLiner.mousePosition.x = e.pageX;
    oPageLiner.mousePosition.y = e.pageY;
});

oPageLiner.init = function () {
    debug('[PageLiner] Initializing extension...');

    var aHelpLines = this.getAllHelpLines(),
        $window = $(window);

    if (typeof aHelpLines !== 'undefined') {
        debug('[PageLiner] Helplines found! Updating badge...');
        this.updatePopUp();

        if (localStorage.getItem('pglnr-ext-rulerIsActive') == 'true' || localStorage.getItem('pglnr-ext-helplineIsActive') == 'true') {
            debug('[PageLiner] Rendering helplines...');

            this.drawRulers();
            this.updatePopUp();

            // if helplines are to be displayed, render them!
            if (aHelpLines && aHelpLines.length > 0) {
                // add all existing helplines to the DOM
                $.each(aHelpLines, function (iIndex) {
                        oPageLiner.addHelpLineToDOM(this.posX, this.posY, this.sColor, iIndex);
                    }
                );
            }

            $('body').click(function (e) {
                if (!$(e.target).hasClass('pglnr-ext-helpline')) {
                    $('.pglnr-ext-helpline').css('box-shadow', 'none');
                    $(this).unbind('keydown', oPageLiner.bindKeyboardEvents);
                }
            });
        }
        else {
            debug('[PageLiner] No helplines to render.');
        }
    }

    this.loadShortcutMap();

    $window.unbind('keydown', oPageLiner.handleKeyboardShortcuts);
    $window.on('keydown', oPageLiner.handleKeyboardShortcuts);

    debug('[PageLiner] Initializing done.');
};

oPageLiner.getAllHelpLines = function () {
    return JSON.parse(localStorage.getItem('pglnr-ext-aHelpLines'));
};

oPageLiner.setAllHelpLines = function (oAllHelpLines) {
    return localStorage.setItem('pglnr-ext-aHelpLines', JSON.stringify(oAllHelpLines));
};

/**
 * Adds a helpline
 *
 * @param posX   double  Position of the helpline on the horizontal axis
 * @param posY   double  Position of the helpline on the vertical axis
 * @param sColor string  HEX color code of the helplines color
 * @param opts   object  Optional extended properties
 */
oPageLiner.addHelpLine = function (posX, posY, sColor, opts) {
    // Check if localStorage dataset exists for this URL
    if (localStorage.getItem('pglnr-ext-aHelpLines') === null) {
        localStorage.setItem('pglnr-ext-aHelpLines', "[]");
    }

    // Check if helplines can be displayed
    if (!localStorage.getItem('pglnr-ext-rulerIsActive') ||
        localStorage.getItem('pglnr-ext-rulerIsActive') == 'false' ||
        !localStorage.getItem('pglnr-ext-helplineIsActive') ||
        localStorage.getItem('pglnr-ext-helplineIsActive') == 'false'
    ) {
        localStorage.setItem('pglnr-ext-rulerIsActive', true);
        localStorage.setItem('pglnr-ext-helplineIsActive', true);
        this.init();
    }

    var iIndex = this.addHelpLineToLocalStorage(posX, posY, sColor, undefined, opts);
    var oHelpLine = this.addHelpLineToDOM(posX, posY, sColor, iIndex);

    this.updatePopUp();

    return oHelpLine;
};

/**
 * Adds a helpline to the local storage
 *
 * @param  posX           double  Position of the helpline on the horizontal axis
 * @param  posY           double  Position of the helpline on the vertical axis
 * @param  sColor         string  HEX color code of the helplines color
 * @param  iHelplineIndex number  Index of the helpline (if updating)
 * @param  opts           object  Optional extended properties
 *
 * @return int iIndex
 */
oPageLiner.addHelpLineToLocalStorage = function (posX, posY, sColor, iHelplineIndex, opts) {
    var aHelpLines = this.getAllHelpLines(),
        iIndex = 0;

    opts = opts || {};

    // If updating an existing helpline, start from the existing stored data
    var oExisting = (typeof iHelplineIndex !== 'undefined' && aHelpLines[iHelplineIndex])
        ? aHelpLines[iHelplineIndex]
        : {};

    var oHelpLine = {
        posX:       typeof posX   !== 'undefined' ? posX   : (oExisting.posX   !== undefined ? oExisting.posX   : 0),
        posY:       typeof posY   !== 'undefined' ? posY   : (oExisting.posY   !== undefined ? oExisting.posY   : 0),
        sColor:     typeof sColor !== 'undefined' && sColor ? sColor : (oExisting.sColor !== undefined ? oExisting.sColor : this.sDefaultColor),
        iThickness: opts.iThickness !== undefined && opts.iThickness !== null ? opts.iThickness : (oExisting.iThickness !== undefined ? oExisting.iThickness : 1),
        iOpacity:   opts.iOpacity   !== undefined && opts.iOpacity   !== null ? opts.iOpacity   : (oExisting.iOpacity   !== undefined ? oExisting.iOpacity   : 100),
        sStyle:     opts.sStyle     !== undefined && opts.sStyle     !== null ? opts.sStyle     : (oExisting.sStyle     !== undefined ? oExisting.sStyle     : 'solid'),
        sLabel:     opts.sLabel     !== undefined && opts.sLabel     !== null ? opts.sLabel     : (oExisting.sLabel     !== undefined ? oExisting.sLabel     : ''),
        blIsGridLine: opts.blIsGridLine !== undefined && opts.blIsGridLine !== null
            ? !!opts.blIsGridLine
            : (oExisting.blIsGridLine !== undefined ? !!oExisting.blIsGridLine : false)
    };

    // If updating an existing helpline
    if (typeof iHelplineIndex !== 'undefined') {
        aHelpLines[iHelplineIndex] = oHelpLine;
        iIndex = iHelplineIndex;
    }
    else {
        iIndex = aHelpLines.push(oHelpLine) - 1;
    }

    localStorage.setItem('pglnr-ext-aHelpLines', JSON.stringify(aHelpLines));

    return iIndex;
};

oPageLiner.addHelpLineToDOM = function (posX, posY, sColor, iHelplineIndex) {
    var $window = $(window),
        // Read the full helpline from storage to get all new properties
        aAllHelpLines = this.getAllHelpLines(),
        oStoredHelpLine = (aAllHelpLines && aAllHelpLines[iHelplineIndex]) ? aAllHelpLines[iHelplineIndex] : null,
        oHelpLine = {
            posX:       typeof posX   !== 'undefined' && typeof posY !== 'undefined' ? posX : 0,
            posY:       typeof posY   !== 'undefined' || !posX ? posY : 0,
            sColor:     oStoredHelpLine ? oStoredHelpLine.sColor     : (typeof sColor !== 'undefined' ? sColor : this.sDefaultColor),
            iThickness: oStoredHelpLine ? (oStoredHelpLine.iThickness || 1)   : 1,
            iOpacity:   oStoredHelpLine ? (oStoredHelpLine.iOpacity   !== undefined ? oStoredHelpLine.iOpacity : 100) : 100,
            sStyle:     oStoredHelpLine ? (oStoredHelpLine.sStyle     || 'solid') : 'solid',
            sLabel:     oStoredHelpLine ? (oStoredHelpLine.sLabel     || '')  : ''
        },
        oHelpLineElem = document.createElement('div'),
        oHelpLineTooltipElem = document.createElement('div'),
        sAxis = (oHelpLine.posX > 0 ? 'x' : 'y');

    oHelpLineElem.className = 'pglnr-ext-helpline pglnr-ext-helpline-' + sAxis;

    // Store color in data attribute for keyboard handler (avoids rgb2Hex conversion issues with gradients)
    oHelpLineElem.setAttribute('data-pglnr-color', oHelpLine.sColor);
    oHelpLineElem.setAttribute('data-pglnr-ext-helpline-index', iHelplineIndex);

    // Apply background based on style
    if (oHelpLine.sStyle === 'solid') {
        oHelpLineElem.style.backgroundColor = oHelpLine.sColor;
    } else {
        // dashed or dotted — use repeating-linear-gradient
        var segSize = oHelpLine.sStyle === 'dashed' ? 8 : 3;
        var gapSize = oHelpLine.sStyle === 'dashed' ? 4 : 3;
        var gradDir = sAxis === 'x' ? 'to bottom' : 'to right';
        oHelpLineElem.style.background =
            'repeating-linear-gradient(' + gradDir + ', ' +
            oHelpLine.sColor + ' 0px, ' +
            oHelpLine.sColor + ' ' + segSize + 'px, ' +
            'transparent ' + segSize + 'px, ' +
            'transparent ' + (segSize + gapSize) + 'px)';
    }

    // Apply thickness: width for x-axis lines, height for y-axis lines
    if (sAxis === 'x') {
        oHelpLineElem.style.width = oHelpLine.iThickness + 'px';
    } else {
        oHelpLineElem.style.height = oHelpLine.iThickness + 'px';
    }

    // Apply opacity
    oHelpLineElem.style.opacity = oHelpLine.iOpacity / 100;

    if (localStorage.getItem('pglnr-ext-helplineIsActive') == 'false') {
        oHelpLineElem.style.display = 'none';
    }

    oHelpLineTooltipElem.className = 'pglnr-ext-helpline-tooltip pglnr-ext-helpline-tooltip-' + sAxis;
    oHelpLineTooltipElem.iHelplineIndex = iHelplineIndex;
    oHelpLineTooltipElem.setTooltipText = function (sText) {
        var sBase = '#' + (this.iHelplineIndex + 1) + ': ' + (sText | 0) + 'px';
        if (oHelpLine.sLabel) {
            sBase += ' \u00b7 ' + oHelpLine.sLabel;
        }
        this.innerHTML = sBase;
    };

    // Show labels persistently if enabled
    if (localStorage.getItem('pglnr-ext-blShowLabels') === 'true') {
        oHelpLineTooltipElem.className += ' pglnr-ext-tooltip-visible';
    }

    if (oHelpLine.posX > 0) {
        oHelpLineElem.style.position = "fixed";
        oHelpLineElem.style.left = oHelpLine.posX + "px";
        oHelpLineTooltipElem.setTooltipText(oHelpLine.posX);
    }
    else {
        oHelpLineElem.style.position = "absolute";
        oHelpLineElem.style.top = oHelpLine.posY + "px";
        oHelpLineTooltipElem.setTooltipText(oHelpLine.posY);
    }

    $(oHelpLineElem).draggable(
        {
            axis: sAxis,
            start: function () {
                oHelpLineTooltipElem.style.display = 'block';
            },
            drag: function (e, ui) {
                oHelpLineTooltipElem.setTooltipText((sAxis === 'x' ? ui.position.left : ui.position.top));
            },
            stop: function (e, ui) {
                if ((sAxis === 'x' && ui.position.left < 10) || (sAxis === 'y' && ui.position.top < 10)) {
                    oPageLiner.deleteHelpline(e.target.getAttribute('data-pglnr-ext-helpline-index'));

                    return;
                }

                if (sAxis === 'x') {
                    oPageLiner.addHelpLineToLocalStorage(ui.position.left, 0, oHelpLine.sColor, iHelplineIndex)
                }  else {
                    oPageLiner.addHelpLineToLocalStorage(0, ui.position.top, oHelpLine.sColor, iHelplineIndex)
                }

                oHelpLineTooltipElem.style.display = 'none';
            }
        }
    ).on('mouseenter', function (e) {
            $window.on('keydown', {
                iHelplineIndex: iHelplineIndex,
                mouseX: e.clientX,
                mouseY: e.clientY
            }, oPageLiner.drawDistanceLines);
            $window.on('keyup', oPageLiner.removeDistanceLines);
        }
    ).on('mouseleave', function (e) {
            oPageLiner.removeDistanceLines();
            $window.unbind('keydown', oPageLiner.drawDistanceLines);
            $window.unbind('keyup', oPageLiner.removeDistanceLines);
        }
    ).on('drag', function (e, ui) {
            $(this).toggleClass(
                'pglnr-ext-helpline-delete',
                (sAxis === 'x' && ui.position.left < 10) || (sAxis === 'y' && ui.position.top < 10)
            );

            oPageLiner.removeDistanceLines();
        }
    ).on('click', function (e) {
        var $this = $(this);
        var sLineColor = $this.attr('data-pglnr-color') || '#33ffff';
        $('.pglnr-ext-helpline').css('box-shadow', 'none');
        $this.css('box-shadow', '0 0 5px 0 ' + hexToRgba(sLineColor, 70));

        $('body').unbind('keydown', oPageLiner.bindKeyboardEvents)
            .on('keydown', {iHelplineIndex: iHelplineIndex}, oPageLiner.bindKeyboardEvents);
    }).append(oHelpLineTooltipElem);

    $('body').append(oHelpLineElem);

    return oHelpLineElem;
};

oPageLiner.getDefaultShortcutMap = function () {
    return {
        add_h_line: 'ALT+H',
        add_v_line: 'ALT+V',
        add_lines: 'ALT+A',
        toggle_rulers: 'ALT+R',
        toggle_lines: 'ALT+G',
        add_center_lines: 'ALT+C',
        spiral_element: 'ALT+E',
        spiral_area: 'ALT+S',
        spiral_rotate: 'ALT+Q',
        spiral_clear: 'ALT+X',
        grid_clear: 'ALT+K'
    };
};

oPageLiner.normalizeShortcutCombo = function (sRaw) {
    if (!sRaw || typeof sRaw !== 'string') return '';

    var aTokens = sRaw.toUpperCase().replace(/\s+/g, '').split('+').filter(function (s) { return !!s; });
    if (!aTokens.length) return '';

    var oAlias = {
        STRG: 'CTRL',
        CONTROL: 'CTRL',
        OPTION: 'ALT',
        CMD: 'META',
        COMMAND: 'META',
        ESCAPE: 'ESC',
        DEL: 'DELETE',
        SPACEBAR: 'SPACE'
    };

    aTokens = aTokens.map(function (s) { return oAlias[s] || s; });

    var aMods = [];
    var oSeen = {};
    var aModOrder = ['CTRL', 'ALT', 'SHIFT', 'META'];

    aTokens.slice(0, -1).forEach(function (s) {
        if (aModOrder.indexOf(s) >= 0 && !oSeen[s]) {
            oSeen[s] = true;
            aMods.push(s);
        }
    });

    aMods.sort(function (a, b) { return aModOrder.indexOf(a) - aModOrder.indexOf(b); });

    var sKey = aTokens[aTokens.length - 1];
    if (!sKey || aModOrder.indexOf(sKey) >= 0) return '';
    if (sKey.length === 1) sKey = sKey.toUpperCase();

    return aMods.concat([sKey]).join('+');
};

oPageLiner.setShortcutMap = function (oMap) {
    var oDefaults = this.getDefaultShortcutMap();
    var oMerged = {};
    var self = this;

    Object.keys(oDefaults).forEach(function (sAction) {
        var sCandidate = (oMap && Object.prototype.hasOwnProperty.call(oMap, sAction))
            ? oMap[sAction]
            : oDefaults[sAction];
        oMerged[sAction] = self.normalizeShortcutCombo(sCandidate || '');
    });

    this.shortcutMap = oMerged;
};

oPageLiner.loadShortcutMap = function () {
    var self = this;
    self.setShortcutMap({});

    try {
        chrome.storage.local.get('pglnr-shortcuts', function (data) {
            self.setShortcutMap(data['pglnr-shortcuts'] || {});
        });
    } catch (err) {
        self.setShortcutMap({});
    }
};

oPageLiner.getEventShortcutCombo = function (e) {
    var oTarget = e.target;
    if (oTarget) {
        var sTag = (oTarget.tagName || '').toLowerCase();
        var blEditable = oTarget.isContentEditable || sTag === 'input' || sTag === 'textarea' || sTag === 'select';
        if (blEditable) return '';
    }

    var sKey = (e.key || '').toUpperCase();
    if (!sKey) return '';

    var oAlias = {
        ESCAPE: 'ESC',
        SPACEBAR: 'SPACE',
        ' ': 'SPACE'
    };
    sKey = oAlias[sKey] || sKey;

    if (sKey === 'CONTROL' || sKey === 'SHIFT' || sKey === 'ALT' || sKey === 'META') {
        return '';
    }

    var aMods = [];
    if (e.ctrlKey) aMods.push('CTRL');
    if (e.altKey) aMods.push('ALT');
    if (e.shiftKey) aMods.push('SHIFT');
    if (e.metaKey) aMods.push('META');

    return aMods.concat([sKey]).join('+');
};

oPageLiner.handleKeyboardShortcuts = function (e) {
    var oShortcutMap = oPageLiner.shortcutMap || oPageLiner.getDefaultShortcutMap();
    var sCombo = oPageLiner.getEventShortcutCombo(e);
    if (!sCombo) return;

    var sAction = null;
    Object.keys(oShortcutMap).some(function (sActionKey) {
        if (oShortcutMap[sActionKey] === sCombo) {
            sAction = sActionKey;
            return true;
        }
        return false;
    });

    if (!sAction) return;

    e.preventDefault();
    var $oHelpLine = null;

    if (sAction === 'add_h_line') {
        debug('add horizontal helpline');
        $oHelpLine = $(oPageLiner.addHelpLine(0, oPageLiner.mousePosition.y, '#33ffff'));
    }
    else if (sAction === 'add_v_line') {
        debug('add vertical helpline');
        $oHelpLine = $(oPageLiner.addHelpLine(oPageLiner.mousePosition.x, 0, '#33ffff'));
    }
    else if (sAction === 'add_lines') {
        debug('add horizontal and vertical helpline');
        $(oPageLiner.addHelpLine(0, oPageLiner.mousePosition.y, '#33ffff'));
        $(oPageLiner.addHelpLine(oPageLiner.mousePosition.x, 0, '#33ffff'));
    }
    else if (sAction === 'toggle_rulers') {
        debug('toggle rulers');
        oPageLiner.toggleRulers();
    }
    else if (sAction === 'toggle_lines') {
        debug('toggle guidelines');
        oPageLiner.toggleHelplines();
    }
    else if (sAction === 'add_center_lines') {
        oPageLiner.addHelpLine(Math.round(window.innerWidth / 2), 0);
        oPageLiner.addHelpLine(0, Math.round(window.innerHeight / 2 + window.pageYOffset));
    }
    else if (sAction === 'spiral_element') {
        oPageLiner.startGoldenSpiralElementMode();
    }
    else if (sAction === 'spiral_area') {
        oPageLiner.startGoldenSpiralAreaMode();
    }
    else if (sAction === 'spiral_rotate') {
        oPageLiner.rotateGoldenSpiral(15);
    }
    else if (sAction === 'spiral_clear') {
        oPageLiner.clearGoldenSpiral();
    }
    else if (sAction === 'grid_clear') {
        oPageLiner.clearGeneratedGrid();
    }

    if ($oHelpLine === null) {
        return;
    }

    $oHelpLine.trigger('click');
};

oPageLiner.editHelpLine = function (iHelplineIndex, posX, posY, sColor, opts) {
    var oAllPageLines = this.getAllHelpLines(),
        $oPageLine = $('.pglnr-ext-helpline[data-pglnr-ext-helpline-index="' + iHelplineIndex + '"]');

    opts = opts || {};

    if ($oPageLine.length) {
        if (posX !== null && posX !== undefined) {
            oAllPageLines[iHelplineIndex].posX = posX;
        }

        if (posY !== null && posY !== undefined) {
            oAllPageLines[iHelplineIndex].posY = posY;
        }

        if (sColor) {
            oAllPageLines[iHelplineIndex].sColor = sColor;
            this.sDefaultColor = sColor;
        }

        if (opts.iThickness !== null && opts.iThickness !== undefined) {
            oAllPageLines[iHelplineIndex].iThickness = opts.iThickness;
        }

        if (opts.iOpacity !== null && opts.iOpacity !== undefined) {
            oAllPageLines[iHelplineIndex].iOpacity = opts.iOpacity;
        }

        if (opts.sStyle !== null && opts.sStyle !== undefined) {
            oAllPageLines[iHelplineIndex].sStyle = opts.sStyle;
        }

        if (opts.sLabel !== null && opts.sLabel !== undefined) {
            oAllPageLines[iHelplineIndex].sLabel = opts.sLabel;
        }

        // Update storage BEFORE re-rendering so addHelpLineToDOM reads correct values
        this.setAllHelpLines(oAllPageLines);

        $oPageLine.remove();
        this.addHelpLineToDOM(
            oAllPageLines[iHelplineIndex].posX,
            oAllPageLines[iHelplineIndex].posY,
            oAllPageLines[iHelplineIndex].sColor,
            iHelplineIndex
        );
    }
};

oPageLiner.deleteHelpline = function (iHelplineIndex) {
    var oAllPageLines = this.getAllHelpLines(),
        $oPageLine = $('.pglnr-ext-helpline[data-pglnr-ext-helpline-index="' + iHelplineIndex + '"]');

    if ($oPageLine.length) {
        delete oAllPageLines.splice(iHelplineIndex, 1);
        this.setAllHelpLines(oAllPageLines);
        $('.pglnr-ext-helpline').remove();
        this.init();
    }
};

oPageLiner.toggleRulers = function (blForceState) {
    var blState = null;

    if (blForceState === true || blForceState === false) {
        blState = blForceState;
    }
    else {
        blState = localStorage.getItem('pglnr-ext-rulerIsActive') == 'false';
    }

    localStorage.setItem('pglnr-ext-rulerIsActive', blState);

    if ($('.pglnr-ext-ruler').length > 0) {
        $('.pglnr-ext-ruler').toggle(blState);
    } else {
        this.init();
    }
};

oPageLiner.toggleHelplines = function (blForceState) {
    var blState = null;

    if (blForceState === true || blForceState === false) {
        blState = blForceState;
    }
    else {
        blState = localStorage.getItem('pglnr-ext-helplineIsActive') == 'false';
    }

    localStorage.setItem('pglnr-ext-helplineIsActive', blState);

    if ($('.pglnr-ext-helpline').length > 0) {
        $('.pglnr-ext-helpline').toggle(blState);
    } else {
        this.init();
    }
}

oPageLiner.removeAllHelpLines = function () {
    $('.pglnr-ext-helpline').remove();
    $('.pglnr-ext-grid-overlay').remove();
    this.clearGoldenSpiral();
    this.toggleRulers(false);
    this.toggleHelplines(false);
    localStorage.setItem('pglnr-ext-aHelpLines', "[]");
    this.sDefaultColor = '#33ffff';
    this.updatePopUp();
};

oPageLiner.clearGeneratedGrid = function () {
    var aHelpLines = this.getAllHelpLines() || [];
    var aFiltered = aHelpLines.filter(function (oLine) {
        return !oLine.blIsGridLine;
    });

    if (aFiltered.length !== aHelpLines.length) {
        this.setAllHelpLines(aFiltered);
    }

    $('.pglnr-ext-grid-overlay').remove();
    $('.pglnr-ext-helpline').remove();
    this.init();
    this.updatePopUp();
};

oPageLiner.normalizeDragRect = function (x1, y1, x2, y2) {
    var iLeft = Math.min(x1, x2);
    var iTop = Math.min(y1, y2);
    var iWidth = Math.abs(x2 - x1);
    var iHeight = Math.abs(y2 - y1);

    return {
        left: Math.round(iLeft),
        top: Math.round(iTop),
        width: Math.round(iWidth),
        height: Math.round(iHeight)
    };
};

oPageLiner.cancelGoldenSpiralMode = function () {
    $('body').removeClass('pglnr-ext-spiral-mode-active');
    $(document).off('.pglnrSpiralMode');
    $(document).off('.pglnrSpiralArea');
    $('.pglnr-ext-spiral-selection').remove();
    $('.pglnr-ext-spiral-hover-overlay').remove();
    if (this.goldenSpiral.hoverTarget) {
        $(this.goldenSpiral.hoverTarget).removeClass('pglnr-ext-spiral-hover-target');
    }
    this.goldenSpiral.hoverTarget = null;
    this.goldenSpiral.mode = null;
};

oPageLiner.updateSpiralHoverOverlay = function (oTarget) {
    var $oOverlay = $('.pglnr-ext-spiral-hover-overlay');

    if (!oTarget || !oTarget.getBoundingClientRect) {
        $oOverlay.remove();
        return;
    }

    var oRect = oTarget.getBoundingClientRect();
    if (oRect.width < 2 || oRect.height < 2) {
        $oOverlay.remove();
        return;
    }

    if (!$oOverlay.length) {
        $oOverlay = $('<div class="pglnr-ext-spiral-hover-overlay"></div>');
        $('body').append($oOverlay);
    }

    $oOverlay.css({
        left: Math.round(oRect.left) + 'px',
        top: Math.round(oRect.top) + 'px',
        width: Math.round(oRect.width) + 'px',
        height: Math.round(oRect.height) + 'px'
    });
};

oPageLiner.clearGoldenSpiral = function () {
    this.cancelGoldenSpiralMode();
    $('.pglnr-ext-golden-spiral').remove();
    this.goldenSpiral.rect = null;
    this.goldenSpiral.rotation = 0;
    this.goldenSpiral.flipX = false;
    this.goldenSpiral.flipY = false;
};

oPageLiner.setGoldenSpiralStyle = function (oStyle) {
    oStyle = oStyle || {};

    if (typeof oStyle.color === 'string' && oStyle.color.length) {
        this.goldenSpiral.color = oStyle.color;
    }

    if (oStyle.strokeWidth !== undefined && oStyle.strokeWidth !== null) {
        var iStroke = parseInt(oStyle.strokeWidth, 10);
        if (!isNaN(iStroke)) {
            this.goldenSpiral.strokeWidth = Math.max(1, Math.min(12, iStroke));
        }
    }

    if (this.goldenSpiral.rect) {
        this.drawGoldenSpiral(this.goldenSpiral.rect, this.goldenSpiral.rotation || 0);
    }
};

oPageLiner.setGoldenSpiralRotation = function (iRotationDeg) {
    var iRot = parseInt(iRotationDeg, 10);
    if (isNaN(iRot)) iRot = 0;
    iRot = iRot % 360;
    if (iRot < 0) iRot += 360;

    this.goldenSpiral.rotation = iRot;
    if (this.goldenSpiral.rect) {
        this.drawGoldenSpiral(this.goldenSpiral.rect, iRot);
    }
};

oPageLiner.startGoldenSpiralElementMode = function () {
    var self = this;
    self.cancelGoldenSpiralMode();
    self.goldenSpiral.mode = 'element';
    self.goldenSpiral.lastPlacementMode = 'element';
    $('body').addClass('pglnr-ext-spiral-mode-active');

    $(document).on('keydown.pglnrSpiralMode', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            self.cancelGoldenSpiralMode();
        }
    });

    $(document).on('mousemove.pglnrSpiralMode', function (e) {
        var $oCurrent = $(e.target).closest('.pglnr-ext-golden-spiral, .ui-resizable-handle, .pglnr-ext-golden-spiral-delete');
        if ($oCurrent.length) return;

        var oTargetDiv = $(e.target).closest('div')[0];
        var oTarget = oTargetDiv || e.target;
        if (!oTarget || !oTarget.getBoundingClientRect) return;

        if (self.goldenSpiral.hoverTarget !== oTarget) {
            if (self.goldenSpiral.hoverTarget) {
                $(self.goldenSpiral.hoverTarget).removeClass('pglnr-ext-spiral-hover-target');
            }
            self.goldenSpiral.hoverTarget = oTarget;
            $(oTarget).addClass('pglnr-ext-spiral-hover-target');
        }
        self.updateSpiralHoverOverlay(oTarget);
    });

    $(document).on('click.pglnrSpiralMode', function (e) {
        if ($(e.target).closest('.pglnr-ext-golden-spiral').length > 0) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        var oTarget = self.goldenSpiral.hoverTarget;
        if (!oTarget) {
            var oTargetDiv = $(e.target).closest('div')[0];
            oTarget = oTargetDiv || e.target;
        }
        if (!oTarget || !oTarget.getBoundingClientRect) {
            self.cancelGoldenSpiralMode();
            return;
        }

        var oBox = oTarget.getBoundingClientRect();
        if (oBox.width < 12 || oBox.height < 12) {
            self.cancelGoldenSpiralMode();
            return;
        }

        self.drawGoldenSpiral({
            left: oBox.left + window.pageXOffset,
            top: oBox.top + window.pageYOffset,
            width: oBox.width,
            height: oBox.height
        }, self.goldenSpiral.rotation || 0);

        self.cancelGoldenSpiralMode();
    });
};

oPageLiner.startGoldenSpiralAreaMode = function () {
    var self = this;
    var oStart = null;
    var oSelection = null;

    self.cancelGoldenSpiralMode();
    self.goldenSpiral.mode = 'area';
    self.goldenSpiral.lastPlacementMode = 'area';
    $('body').addClass('pglnr-ext-spiral-mode-active');

    $(document).on('keydown.pglnrSpiralMode', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            self.cancelGoldenSpiralMode();
        }
    });

    $(document).on('mousedown.pglnrSpiralMode', function (e) {
        if (e.button !== 0) return;
        if ($(e.target).closest('.pglnr-ext-golden-spiral').length > 0) return;

        e.preventDefault();
        e.stopPropagation();

        oStart = {x: e.pageX, y: e.pageY};
        oSelection = document.createElement('div');
        oSelection.className = 'pglnr-ext-spiral-selection';
        document.body.appendChild(oSelection);

        $(document).on('mousemove.pglnrSpiralArea', function (ev) {
            var oRect = self.normalizeDragRect(oStart.x, oStart.y, ev.pageX, ev.pageY);
            oSelection.style.left = oRect.left + 'px';
            oSelection.style.top = oRect.top + 'px';
            oSelection.style.width = oRect.width + 'px';
            oSelection.style.height = oRect.height + 'px';
        });

        $(document).on('mouseup.pglnrSpiralArea', function (ev) {
            $(document).off('.pglnrSpiralArea');

            var oRect = self.normalizeDragRect(oStart.x, oStart.y, ev.pageX, ev.pageY);
            $('.pglnr-ext-spiral-selection').remove();
            oSelection = null;

            if (oRect.width >= 12 && oRect.height >= 12) {
                self.drawGoldenSpiral(oRect, self.goldenSpiral.rotation || 0);
            }

            self.cancelGoldenSpiralMode();
        });
    });
};

oPageLiner.rotateGoldenSpiral = function (iStepDeg) {
    if (!this.goldenSpiral.rect) return;

    var iStep = parseInt(iStepDeg, 10) || 90;
    var iNextRotation = ((this.goldenSpiral.rotation || 0) + iStep) % 360;
    if (iNextRotation < 0) iNextRotation += 360;

    // Keep the same container rect (especially for DIV-based placement).
    // Only the spiral orientation should change.
    this.drawGoldenSpiral(this.goldenSpiral.rect, iNextRotation);
};

oPageLiner.toggleGoldenSpiralMirror = function (sAxis) {
    if (!this.goldenSpiral.rect) return;

    if (sAxis === 'x') {
        this.goldenSpiral.flipX = !this.goldenSpiral.flipX;
    }
    else if (sAxis === 'y') {
        this.goldenSpiral.flipY = !this.goldenSpiral.flipY;
    }

    this.drawGoldenSpiral(this.goldenSpiral.rect, this.goldenSpiral.rotation || 0);
};

oPageLiner.getGoldenSpiralQuarterArcPath = function (cx, cy, r, aStart, aEnd) {
    var iSteps = 18;
    var aPoints = [];
    for (var i = 0; i <= iSteps; i++) {
        var t = i / iSteps;
        var a = aStart + (aEnd - aStart) * t;
        aPoints.push({
            x: cx + r * Math.cos(a),
            y: cy + r * Math.sin(a)
        });
    }

    if (!aPoints.length) return '';

    var sPath = 'M ' + aPoints[0].x.toFixed(2) + ' ' + aPoints[0].y.toFixed(2);
    for (var j = 1; j < aPoints.length; j++) {
        sPath += ' L ' + aPoints[j].x.toFixed(2) + ' ' + aPoints[j].y.toFixed(2);
    }
    return sPath;
};

oPageLiner.buildGoldenSpiralModel = function (iWidth, iHeight) {
    var oRect = {x: 0, y: 0, w: iWidth, h: iHeight};
    var aSides = ['left', 'top', 'right', 'bottom'];
    var aSquares = [];
    var aArcParts = [];

    for (var i = 0; i < 28; i++) {
        if (oRect.w < 6 || oRect.h < 6) break;

        var sSide = aSides[i % 4];
        var s = Math.min(oRect.w, oRect.h);
        var sx = oRect.x;
        var sy = oRect.y;
        var cx, cy, aStart, aEnd;

        if (sSide === 'left') {
            sx = oRect.x;
            sy = oRect.y;
            oRect.x += s;
            oRect.w -= s;
            cx = sx + s;
            cy = sy + s;
            aStart = Math.PI;
            aEnd = 1.5 * Math.PI;
        } else if (sSide === 'top') {
            sx = oRect.x + Math.max(0, oRect.w - s);
            sy = oRect.y;
            oRect.y += s;
            oRect.h -= s;
            cx = sx;
            cy = sy + s;
            aStart = 1.5 * Math.PI;
            aEnd = 2 * Math.PI;
        } else if (sSide === 'right') {
            sx = oRect.x + Math.max(0, oRect.w - s);
            sy = oRect.y + Math.max(0, oRect.h - s);
            oRect.w -= s;
            cx = sx;
            cy = sy;
            aStart = 0;
            aEnd = 0.5 * Math.PI;
        } else {
            sx = oRect.x;
            sy = oRect.y + Math.max(0, oRect.h - s);
            oRect.h -= s;
            cx = sx + s;
            cy = sy;
            aStart = 0.5 * Math.PI;
            aEnd = Math.PI;
        }

        aSquares.push({x: sx, y: sy, size: s});
        aArcParts.push(this.getGoldenSpiralQuarterArcPath(cx, cy, s, aStart, aEnd));

        if (oRect.w < 1 || oRect.h < 1) break;
    }

    return {
        squares: aSquares,
        spiralPath: aArcParts.join(' ')
    };
};

oPageLiner.bindGoldenSpiralInteractions = function ($oWrap) {
    if (!$oWrap || !$oWrap.length) return;

    var self = this;

    // jQuery UI might not be ready yet in some timing scenarios; avoid hard failures.
    if (typeof $oWrap.draggable === 'function') {
        $oWrap.draggable({
            containment: 'document',
            cancel: '.ui-resizable-handle',
            drag: function (event, ui) {
                self.goldenSpiral.rect.left = Math.round(ui.position.left);
                self.goldenSpiral.rect.top = Math.round(ui.position.top);
            }
        });
    }

    if (typeof $oWrap.resizable === 'function') {
        $oWrap.resizable({
            handles: 'n,e,s,w,ne,nw,se,sw',
            minWidth: 24,
            minHeight: 24,
            resize: function (event, ui) {
                self.goldenSpiral.rect = {
                    left: Math.round(ui.position.left),
                    top: Math.round(ui.position.top),
                    width: Math.round(ui.size.width),
                    height: Math.round(ui.size.height)
                };
                self.drawGoldenSpiral(self.goldenSpiral.rect, self.goldenSpiral.rotation || 0);
            }
        });
    }
};

oPageLiner.drawGoldenSpiral = function (oRect, iRotationDeg) {
    if (!oRect) return;

    var iWidth = Math.max(1, Math.round(oRect.width));
    var iHeight = Math.max(1, Math.round(oRect.height));
    var iLeft = Math.round(oRect.left);
    var iTop = Math.round(oRect.top);
    var iRotation = parseInt(iRotationDeg, 10) || 0;
    var sSvgNS = 'http://www.w3.org/2000/svg';
    var $oWrap = $('.pglnr-ext-golden-spiral');
    var oWrap, oSvg, oHint, oGroup, oGuideGroup, oSpiralPath;

    if (!$oWrap.length) {
        oWrap = document.createElement('div');
        oWrap.className = 'pglnr-ext-golden-spiral';

        var oFrame = document.createElement('div');
        oFrame.className = 'pglnr-ext-golden-spiral-frame';
        oWrap.appendChild(oFrame);

        var oControls = document.createElement('div');
        oControls.className = 'pglnr-ext-golden-spiral-controls';

        var oRotateBtn = document.createElement('button');
        oRotateBtn.className = 'pglnr-ext-golden-spiral-rotate';
        oRotateBtn.setAttribute('type', 'button');
        oRotateBtn.setAttribute('title', 'Spirale drehen');
        oRotateBtn.innerText = '↻';
        oRotateBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            oPageLiner.rotateGoldenSpiral(90);
        });

        var oMirrorXBtn = document.createElement('button');
        oMirrorXBtn.className = 'pglnr-ext-golden-spiral-mirror-x';
        oMirrorXBtn.setAttribute('type', 'button');
        oMirrorXBtn.setAttribute('title', 'Horizontal spiegeln');
        oMirrorXBtn.innerText = '↔';
        oMirrorXBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            oPageLiner.toggleGoldenSpiralMirror('x');
        });

        var oMirrorYBtn = document.createElement('button');
        oMirrorYBtn.className = 'pglnr-ext-golden-spiral-mirror-y';
        oMirrorYBtn.setAttribute('type', 'button');
        oMirrorYBtn.setAttribute('title', 'Vertikal spiegeln');
        oMirrorYBtn.innerText = '↕';
        oMirrorYBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            oPageLiner.toggleGoldenSpiralMirror('y');
        });

        var oDeleteBtn = document.createElement('button');
        oDeleteBtn.className = 'pglnr-ext-golden-spiral-delete';
        oDeleteBtn.setAttribute('type', 'button');
        oDeleteBtn.setAttribute('title', 'Spirale löschen');
        oDeleteBtn.innerText = '✕';
        oDeleteBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var sMode = oPageLiner.goldenSpiral.lastPlacementMode;
            oPageLiner.clearGoldenSpiral();
            if (sMode === 'element') {
                oPageLiner.startGoldenSpiralElementMode();
            } else if (sMode === 'area') {
                oPageLiner.startGoldenSpiralAreaMode();
            }
        });

        oControls.appendChild(oRotateBtn);
        oControls.appendChild(oMirrorXBtn);
        oControls.appendChild(oMirrorYBtn);
        oControls.appendChild(oDeleteBtn);
        oWrap.appendChild(oControls);

        oHint = document.createElement('div');
        oHint.className = 'pglnr-ext-golden-spiral-hint';
        oWrap.appendChild(oHint);

        oSvg = document.createElementNS(sSvgNS, 'svg');
        oSvg.setAttribute('class', 'pglnr-ext-golden-spiral-svg');

        oGroup = document.createElementNS(sSvgNS, 'g');
        oGroup.setAttribute('class', 'pglnr-ext-golden-spiral-group');

        oGuideGroup = document.createElementNS(sSvgNS, 'g');
        oGuideGroup.setAttribute('class', 'pglnr-ext-golden-guide-group');
        oGroup.appendChild(oGuideGroup);

        oSpiralPath = document.createElementNS(sSvgNS, 'path');
        oSpiralPath.setAttribute('class', 'pglnr-ext-golden-spiral-path');
        oGroup.appendChild(oSpiralPath);

        oSvg.appendChild(oGroup);
        oWrap.appendChild(oSvg);
        document.body.appendChild(oWrap);

        $oWrap = $(oWrap);
        this.bindGoldenSpiralInteractions($oWrap);
    } else {
        oWrap = $oWrap[0];
        oSvg = oWrap.querySelector('.pglnr-ext-golden-spiral-svg');
        oHint = oWrap.querySelector('.pglnr-ext-golden-spiral-hint');
        oGroup = oWrap.querySelector('.pglnr-ext-golden-spiral-group');
        oGuideGroup = oWrap.querySelector('.pglnr-ext-golden-guide-group');
        oSpiralPath = oWrap.querySelector('.pglnr-ext-golden-spiral-path');
    }

    oWrap.style.left = iLeft + 'px';
    oWrap.style.top = iTop + 'px';
    oWrap.style.width = iWidth + 'px';
    oWrap.style.height = iHeight + 'px';
    var blFlipX = !!this.goldenSpiral.flipX;
    var blFlipY = !!this.goldenSpiral.flipY;
    var sFlipHint = (blFlipX ? ' ↔' : '') + (blFlipY ? ' ↕' : '');
    oHint.innerText = 'Goldene Spirale · ' + iRotation + '°' + sFlipHint;

    oSvg.setAttribute('viewBox', '0 0 ' + iWidth + ' ' + iHeight);
    var iNormRotation = ((iRotation % 360) + 360) % 360;
    var blQuarterTurn = iNormRotation % 90 === 0;
    var cx = iWidth / 2;
    var cy = iHeight / 2;
    var sBaseTransform = '';

    if (blQuarterTurn && (iNormRotation === 90 || iNormRotation === 270)) {
        // Keep the same box for 90/270 by fitting rotated geometry back into
        // the original rectangle dimensions.
        var sx = iWidth / Math.max(1, iHeight);
        var sy = iHeight / Math.max(1, iWidth);
        sBaseTransform =
            'translate(' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ') ' +
            'scale(' + sx.toFixed(6) + ' ' + sy.toFixed(6) + ') ' +
            'rotate(' + iNormRotation + ') ' +
            'translate(' + (-cx).toFixed(2) + ' ' + (-cy).toFixed(2) + ')';
    } else if (iNormRotation !== 0) {
        sBaseTransform = 'rotate(' + iNormRotation + ' ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ')';
    }

    var sMirrorTransform = '';
    if (blFlipX || blFlipY) {
        var sxMirror = blFlipX ? -1 : 1;
        var syMirror = blFlipY ? -1 : 1;
        sMirrorTransform =
            'translate(' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ') ' +
            'scale(' + sxMirror + ' ' + syMirror + ') ' +
            'translate(' + (-cx).toFixed(2) + ' ' + (-cy).toFixed(2) + ')';
    }

    var sTransform = [sMirrorTransform, sBaseTransform].filter(function (s) { return !!s; }).join(' ');
    oGroup.setAttribute('transform', sTransform);

    var oMirrorXBtnState = oWrap.querySelector('.pglnr-ext-golden-spiral-mirror-x');
    var oMirrorYBtnState = oWrap.querySelector('.pglnr-ext-golden-spiral-mirror-y');
    if (oMirrorXBtnState) oMirrorXBtnState.classList.toggle('is-active', blFlipX);
    if (oMirrorYBtnState) oMirrorYBtnState.classList.toggle('is-active', blFlipY);

    while (oGuideGroup.firstChild) {
        oGuideGroup.removeChild(oGuideGroup.firstChild);
    }

    var oModel = this.buildGoldenSpiralModel(iWidth, iHeight);
    oModel.squares.forEach(function (sq) {
        var oRectSvg = document.createElementNS(sSvgNS, 'rect');
        oRectSvg.setAttribute('class', 'pglnr-ext-golden-guide');
        oRectSvg.setAttribute('x', sq.x.toFixed(2));
        oRectSvg.setAttribute('y', sq.y.toFixed(2));
        oRectSvg.setAttribute('width', sq.size.toFixed(2));
        oRectSvg.setAttribute('height', sq.size.toFixed(2));
        oGuideGroup.appendChild(oRectSvg);
    });

    oSpiralPath.style.stroke = this.goldenSpiral.color || '#f2b200';
    oSpiralPath.style.strokeWidth = (this.goldenSpiral.strokeWidth || 2) + 'px';
    oSpiralPath.setAttribute('d', oModel.spiralPath || '');

    this.goldenSpiral.rect = {
        left: iLeft,
        top: iTop,
        width: iWidth,
        height: iHeight
    };
    this.goldenSpiral.rotation = iRotation;
};

/**
 * Grid generator
 *
 * @param cols   int  Number of columns
 * @param rows   int  Number of rows
 * @param margin int  Margin in px on each side
 */
/**
 * Grid generator — centered column layout
 *
 * @param maxWidth  int     Max container width in px (centered in viewport)
 * @param cols      int     Number of columns
 * @param colGap    int     Gap between columns in px
 * @param rows      int     Number of horizontal rows (0 = none)
 * @param opts      object  {lineColor, overlayColor, overlayOpacity, showOverlay}
 */
oPageLiner.addGrid = function (maxWidth, cols, colGap, rows, opts) {
    opts     = opts || {};
    maxWidth = parseInt(maxWidth) || window.innerWidth;
    cols     = parseInt(cols)     || 1;
    colGap   = parseInt(colGap)   || 0;
    rows     = parseInt(rows)     || 0;

    var sLineColor      = opts.lineColor    || '#0055ff';
    var blShowOverlay   = opts.showOverlay  !== false;
    var sOverlayColor   = opts.overlayColor || '#0055ff';
    var iOverlayOpacity = (opts.overlayOpacity !== undefined && opts.overlayOpacity !== null)
                          ? opts.overlayOpacity : 10;

    // Column width = (maxWidth - totalGaps) / cols
    var totalGapWidth = colGap * (cols - 1);
    var colWidth      = (maxWidth - totalGapWidth) / cols;

    // Center the grid horizontally in the viewport
    var offset = Math.max(0, Math.round((window.innerWidth - maxWidth) / 2));

    // Replace previous generated grid before drawing a new one
    this.clearGeneratedGrid();

    // Left and right container borders
    this.addHelpLine(offset, 0, sLineColor, {blIsGridLine: true});
    this.addHelpLine(offset + maxWidth, 0, sLineColor, {blIsGridLine: true});

    // Column separators: two lines per gap (right edge of col, left edge of next col)
    for (var c = 1; c < cols; c++) {
        var rightEdgeOfCol = Math.round(offset + c * colWidth + (c - 1) * colGap);
        this.addHelpLine(rightEdgeOfCol, 0, sLineColor, {blIsGridLine: true});
        if (colGap > 0) {
            var leftEdgeOfNextCol = Math.round(offset + c * colWidth + c * colGap);
            this.addHelpLine(leftEdgeOfNextCol, 0, sLineColor, {blIsGridLine: true});
        }
    }

    // Optional horizontal row dividers
    if (rows > 1) {
        var rowHeight = Math.round(window.innerHeight / rows);
        for (var r = 1; r < rows; r++) {
            this.addHelpLine(0, r * rowHeight + window.pageYOffset, sLineColor, {blIsGridLine: true});
        }
    }

    // Column overlays (semi-transparent colored rectangles per column)
    if (blShowOverlay) {
        this.drawGridOverlays(offset, cols, colWidth, colGap, sOverlayColor, iOverlayOpacity);
    }

    this.updatePopUp();
};

/**
 * Draws semi-transparent column overlays to visualize the grid columns.
 */
oPageLiner.drawGridOverlays = function (offset, cols, colWidth, colGap, sColor, iOpacity) {
    // Remove existing overlays first
    $('.pglnr-ext-grid-overlay').remove();

    var sRgba = hexToRgba(sColor, iOpacity);

    for (var c = 0; c < cols; c++) {
        var iLeft  = Math.round(offset + c * (colWidth + colGap));
        var iWidth = Math.round(colWidth);

        var oOverlay = document.createElement('div');
        oOverlay.className = 'pglnr-ext-grid-overlay';
        oOverlay.style.left            = iLeft + 'px';
        oOverlay.style.width           = iWidth + 'px';
        oOverlay.style.backgroundColor = sRgba;
        document.body.appendChild(oOverlay);
    }
};

oPageLiner.drawRulers = function () {
    var $oRulerTop = $('.pglnr-ext-ruler.pglnr-ext-ruler-top'),
        $oRulerLeft = $('.pglnr-ext-ruler.pglnr-ext-ruler-left');

    if ($oRulerTop.length > 0 && $oRulerLeft.length > 0) {
        $oRulerTop.show();
        $oRulerLeft.show();
    }
    else {
        var oRulerTopElem = document.createElement('div'),
            oRulerLeftElem = document.createElement('div'),
            oRulerTopMeasure = document.createElement('ul'),
            oRulerLeftMeasure = document.createElement('ul'),
            iDocumentWidth = $(document).width(),
            iDocumentHeight = $(document).height();

        oRulerTopElem.className = 'pglnr-ext-ruler pglnr-ext-ruler-top';
        oRulerLeftElem.className = 'pglnr-ext-ruler pglnr-ext-ruler-left';

        if (localStorage.getItem('pglnr-ext-rulerIsActive') == 'false') {
            oRulerTopElem.style.display = 'none';
            oRulerLeftElem.style.display = 'none';
        }

        oRulerTopMeasure.style.width = iDocumentWidth * 2 + "px";
        oRulerLeftMeasure.style.height = iDocumentHeight * 2 + "px";

        // Create measurement for oRulerTopElem
        for (var i = 0; i <= Math.ceil(iDocumentWidth / 100); i++) {
            var oMeasurementElem = document.createElement('li');
            oMeasurementElem.innerText = (i > 0 ? i * 100 : " ");
            oRulerTopMeasure.appendChild(oMeasurementElem);
        }

        // Add drag event to create new helplines from ruler
        $(oRulerTopElem).draggable(
            {
                axis: "y",
                cursorAt: "bottom",
                distance: 20,
                helper: function (event) {
                    var $oHelpLine = $(oPageLiner.addHelpLine(0, event.clientY + window.pageYOffset)).addClass('pglnr-ext-helpline-dummy');
                    this.iHelplineIndex = $oHelpLine.data('pglnr-ext-helpline-index');

                    $oHelpLine.show();

                    return $oHelpLine[0];
                },
                stop: function (event, ui) {
                    oPageLiner.editHelpLine(this.iHelplineIndex, null, event.clientY + window.pageYOffset);
                    $('.pglnr-ext-helpline-dummy').remove();
                }
            }
        );

        oRulerTopElem.appendChild(oRulerTopMeasure);

        // Create measurement for oRulerLeftElem
        for (var i = 0; i <= Math.ceil(iDocumentHeight / 100); i++) {
            var oMeasurementElem = document.createElement('li');
            oMeasurementElem.innerText = (i > 0 ? i * 100 : " ");
            oRulerLeftMeasure.appendChild(oMeasurementElem);
        }

        // Add drag event to create new helplines from ruler
        $(oRulerLeftElem).draggable(
            {
                axis: "x",
                cursorAt: {left: 0},
                distance: 10,
                helper: function (event) {
                    var $oHelpLine = $(oPageLiner.addHelpLine(event.clientX, 0)).addClass('pglnr-ext-helpline-dummy');
                    this.iHelplineIndex = $oHelpLine.data('pglnr-ext-helpline-index');

                    $oHelpLine.show();

                    return $oHelpLine[0];
                },
                stop: function (event, ui) {
                    oPageLiner.editHelpLine(this.iHelplineIndex, event.clientX, null);
                    $('.pglnr-ext-helpline-dummy').remove();
                }
            }
        );

        oRulerLeftElem.appendChild(oRulerLeftMeasure);

        $('body').append(oRulerTopElem, oRulerLeftElem);

        $(window).scroll(function () {
                var iDocumentHeight = $(document).height();

                $(oRulerLeftMeasure).css(
                    {
                        height: iDocumentHeight,
                        top: window.pageYOffset * -1
                    }
                ).children().remove();

                // Create measurement for oRulerLeftElem
                for (var i = 0; i <= Math.ceil(iDocumentHeight / 100); i++) {
                    var oMeasurementElem = document.createElement('li');

                    oMeasurementElem.innerText = (i > 0 ? i * 100 : " ");
                    oRulerLeftMeasure.appendChild(oMeasurementElem);
                }

                oRulerLeftElem.appendChild(oRulerLeftMeasure);
            }
        );
    }
};

oPageLiner.drawDistanceLines = function (event) {
    if (!oPageLiner.blAltKeyReleased || event.keyCode !== 17) {
        return;
    }

    oPageLiner.blAltKeyReleased = false;

    var $body = $('body'),
        $oPageLine = $('.pglnr-ext-helpline[data-pglnr-ext-helpline-index="' + event.data.iHelplineIndex + '"]'),
        blHorizontal = $oPageLine.hasClass('pglnr-ext-helpline-y'),
        sOrigin = blHorizontal ? 'top' : 'left',
        sScaleOrigin = blHorizontal ? 'height' : 'width',
        sModifierClass = blHorizontal ? 'pglnr-ext-distanceline-y' : 'pglnr-ext-distanceline-x',
        iClosestLowerPos = oPageLiner.getLowerClosestHelpLine(parseInt($oPageLine.css(sOrigin)), blHorizontal),
        iClosestUpperPos = oPageLiner.getUpperClosestHelpLine(parseInt($oPageLine.css(sOrigin)), blHorizontal),
        iClosestLowerDimension = parseInt($oPageLine.css(sOrigin)) - iClosestLowerPos,
        iClosestUpperDimension = iClosestUpperPos - parseInt($oPageLine.css(sOrigin)) - 1,
        iDimensionLineLeftPos = (blHorizontal ? 'left: ' + (event.data.mouseX + 20) + 'px;' : ''),
        $oLowerDistanceLine = $('<div></div>', {
            'class': 'pglnr-ext-distanceline ' + sModifierClass,
            'style': sOrigin + ': ' + (iClosestLowerPos + 1) + 'px; ' +
            sScaleOrigin + ': ' + (iClosestLowerDimension - 1) + 'px;' +
            iDimensionLineLeftPos
        }).html('<span>' + (iClosestLowerDimension) + 'px</span>'),
        $oUpperDistanceLine = $('<div></div>', {
            'class': 'pglnr-ext-distanceline ' + sModifierClass,
            'style': sOrigin + ': ' + (parseInt($oPageLine.css(sOrigin)) + 1) + 'px; ' +
            sScaleOrigin + ': ' + (iClosestUpperDimension - 1) + 'px;' +
            iDimensionLineLeftPos
        }).html('<span>' + (iClosestUpperDimension + 1) + 'px</span>');

    $body.append($oLowerDistanceLine, $oUpperDistanceLine);
};

oPageLiner.bindKeyboardEvents = function (event) {
    switch (event.keyCode) {
        case 37:
        case 38:
        case 39:
        case 40:
            oPageLiner.moveSelectedHelpLineWithKeyboard(event);
            break;
        case 27:
            oPageLiner.discardSelectedHelpLine(event);
            break;
        case 46:
            oPageLiner.deleteSelectedHelpLine(event);
            break;
    }
};

oPageLiner.moveSelectedHelpLineWithKeyboard = function (event) {
    if ($.inArray(event.keyCode, [37, 38, 39, 40]) === -1) {
        return;
    }

    event.preventDefault();

    var $oPageLine = $('.pglnr-ext-helpline[data-pglnr-ext-helpline-index="' + event.data.iHelplineIndex + '"]'),
        blHorizontal = $oPageLine.hasClass('pglnr-ext-helpline-y');

    // Use data attribute instead of reading background-color (avoids issues with gradient backgrounds)
    var sColor = $oPageLine.attr('data-pglnr-color') || '#33ffff';

    if (blHorizontal) {
        if ($.inArray(event.keyCode, [38, 40]) === -1) {
            return;
        }

        var newPos = parseInt($oPageLine.css('top'));

        if (event.keyCode === 38) {
            newPos--;

            if (event.shiftKey) {
                newPos -= 9;
            }
        } else {
            newPos++;

            if (event.shiftKey) {
                newPos += 9;
            }
        }

        $oPageLine.css('top', newPos + 'px');
        $oPageLine.find('.pglnr-ext-helpline-tooltip')[0].setTooltipText(newPos);

        oPageLiner.addHelpLineToLocalStorage(0, newPos, sColor, event.data.iHelplineIndex)
    } else {
        if ($.inArray(event.keyCode, [37, 39]) === -1) {
            return;
        }

        var newPos = parseInt($oPageLine.css('left'));

        if (event.keyCode === 37) {
            newPos--;

            if (event.shiftKey) {
                newPos -= 9;
            }
        } else {
            newPos++;

            if (event.shiftKey) {
                newPos += 9;
            }
        }

        $oPageLine.css('left', newPos + 'px');
        $oPageLine.find('.pglnr-ext-helpline-tooltip')[0].setTooltipText(newPos);

        oPageLiner.addHelpLineToLocalStorage(newPos, 0, sColor, event.data.iHelplineIndex)
    }
};

oPageLiner.discardSelectedHelpLine = function() {
    $('.pglnr-ext-helpline').css('box-shadow', 'none');
    $('body').unbind('keydown', oPageLiner.bindKeyboardEvents);
};

oPageLiner.deleteSelectedHelpLine = function(event) {
    oPageLiner.deleteHelpline(event.data.iHelplineIndex);
};

/**
 * Finds the lower closest help line by a given position
 *
 * @param iPos int
 * @param blOnYAxis bool
 *
 * @return int
 */
oPageLiner.getLowerClosestHelpLine = function (iPos, blOnYAxis) {
    var aHelpLines = this.getAllHelpLines(),
        iClosestHelplinePos = 0;

    blOnYAxis = blOnYAxis || false;

    $.each(aHelpLines, function (iHelplineIndex, oHelpline) {
            if (blOnYAxis) {
                if (oHelpline.posY < iPos && oHelpline.posY > iClosestHelplinePos) {
                    iClosestHelplinePos = oHelpline.posY;
                }
            }
            else {
                if (oHelpline.posX < iPos && oHelpline.posX > iClosestHelplinePos) {
                    iClosestHelplinePos = oHelpline.posX;
                }
            }
        }
    );

    return iClosestHelplinePos;
};

/**
 * Finds the upper closest help line by a given position
 *
 * @param iPos int
 * @param blOnYAxis bool
 *
 * @return int
 */
oPageLiner.getUpperClosestHelpLine = function (iPos, blOnYAxis) {
    var aHelpLines = this.getAllHelpLines(),
        iClosestHelplinePos = blOnYAxis ? (window.innerHeight + window.pageYOffset) : window.innerWidth;

    blOnYAxis = blOnYAxis || false;

    $.each(aHelpLines, function (iHelplineIndex, oHelpline) {
            if (blOnYAxis) {
                if (oHelpline.posY > iPos && oHelpline.posY < iClosestHelplinePos) {
                    iClosestHelplinePos = oHelpline.posY;
                }
            }
            else {
                if (oHelpline.posX > iPos && oHelpline.posX < iClosestHelplinePos) {
                    iClosestHelplinePos = oHelpline.posX;
                }
            }
        }
    );

    return iClosestHelplinePos;
};

/**
 * Removes all distance lines from DOM.
 */
oPageLiner.removeDistanceLines = function (event) {
    if (!oPageLiner.blAltKeyReleased) {
        $('body > .pglnr-ext-distanceline').remove();
        oPageLiner.blAltKeyReleased = true;
    }
};

oPageLiner.updatePopUp = function () {
    debug('[PageLiner] Setting count badge...');
    chrome.runtime.sendMessage({sAction: 'updatePopUp', oAllHelpLines: this.getAllHelpLines()});
};

// Init PageLiner object
oPageLiner.init();
