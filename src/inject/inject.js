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
    }
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
                $('.pglnr-ext-grid-overlay').remove();
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
        sLabel:     opts.sLabel     !== undefined && opts.sLabel     !== null ? opts.sLabel     : (oExisting.sLabel     !== undefined ? oExisting.sLabel     : '')
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

oPageLiner.handleKeyboardShortcuts = function (e) {
    if (!e.altKey || e.ctrlKey || e.shiftKey) {
        return;
    }

    var $oHelpLine = null;

    // keyboard code `h`
    if (e.keyCode === 72) {
        debug('add horizontal helpline');
        $oHelpLine = $(oPageLiner.addHelpLine(0, oPageLiner.mousePosition.y, '#33ffff'));
    }
    // keyboard code `v`
    else if (e.keyCode === 86) {
        debug('add vertical helpline');
        $oHelpLine = $(oPageLiner.addHelpLine(oPageLiner.mousePosition.x, 0, '#33ffff'));
    }
    // keyboard code `a`
    else if (e.keyCode === 65) {
        debug('add horizontal and vertical helpline');
        $(oPageLiner.addHelpLine(0, oPageLiner.mousePosition.y, '#33ffff'));
        $(oPageLiner.addHelpLine(oPageLiner.mousePosition.x, 0, '#33ffff'));
    }
    // keyboard code `r`
    else if (e.keyCode === 82) {
        debug('toggle rulers');
        oPageLiner.toggleRulers();
    }
    // keyboard code `g`
    else if (e.keyCode === 71) {
        debug('toggle guidelines');
        oPageLiner.toggleHelplines();
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
    this.toggleRulers(false);
    this.toggleHelplines(false);
    localStorage.setItem('pglnr-ext-aHelpLines', "[]");
    this.sDefaultColor = '#33ffff';
    this.updatePopUp();
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

    // Left and right container borders
    this.addHelpLine(offset, 0, sLineColor);
    this.addHelpLine(offset + maxWidth, 0, sLineColor);

    // Column separators: two lines per gap (right edge of col, left edge of next col)
    for (var c = 1; c < cols; c++) {
        var rightEdgeOfCol = Math.round(offset + c * colWidth + (c - 1) * colGap);
        this.addHelpLine(rightEdgeOfCol, 0, sLineColor);
        if (colGap > 0) {
            var leftEdgeOfNextCol = Math.round(offset + c * colWidth + c * colGap);
            this.addHelpLine(leftEdgeOfNextCol, 0, sLineColor);
        }
    }

    // Optional horizontal row dividers
    if (rows > 1) {
        var rowHeight = Math.round(window.innerHeight / rows);
        for (var r = 1; r < rows; r++) {
            this.addHelpLine(0, r * rowHeight + window.pageYOffset, sLineColor);
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
