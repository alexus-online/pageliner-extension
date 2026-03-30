/**
 * PageLiner
 *
 * @copyright   2018 Kai Neuwerth
 * @author      Kai Neuwerth
 * @link        https://pageliner.com
 * @modified    Modified distribution by Alexander Kaiser (Apache-2.0)
 */

/**
 * Sends a message to the active tab's content script.
 *
 * @param {string}   action
 * @param {object}   params
 * @param {function} callback
 */
function sendToActiveTab(action, params, callback) {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        if (!tabs[0]) {
            if (callback) callback(null);
            return;
        }
        chrome.tabs.sendMessage(
            tabs[0].id,
            Object.assign({sAction: action}, params || {}),
            function (response) {
                if (chrome.runtime.lastError) {
                    if (callback) callback(null);
                    return;
                }
                if (callback) callback(response);
            }
        );
    });
}

/**
 * Syncs the current action to all tabs if sync setting is enabled.
 *
 * @param {string} action
 * @param {object} params
 */
function syncToAllTabs(action, params) {
    chrome.storage.local.get('pglnr-syncAcrossTabs', function (data) {
        if (!data['pglnr-syncAcrossTabs']) return;
        chrome.runtime.sendMessage({
            sAction: 'broadcastToAllTabs',
            tabAction: action,
            tabParams: params || {}
        });
    });
}

$(function () {
    var shortcutsViewVisible = false;
    var t = function (key, fallback) {
        var msg = chrome.i18n.getMessage(key);
        return msg && msg.length ? msg : (fallback || key);
    };

    /*
     * i18n translator
     */
    $('[data-i18n]').each(function () {
        var sIdent = this.getAttribute('data-i18n'),
            sTranslation = '';

        if (sIdent === 'VERSION') {
            sTranslation = chrome.runtime.getManifest().version;
        }
        else {
            sTranslation = chrome.i18n.getMessage(this.getAttribute('data-i18n'));
        }

        if (!sTranslation || !sTranslation.length) {
            return;
        }

        $(this).text(sTranslation);
    });

    $('*[title^="__MSG_"]').each(function () {
        var aI18nString = /__MSG_(.*)__/.exec(this.getAttribute('title'));

        if (aI18nString != null) {
            $(this).attr('title', chrome.i18n.getMessage(aI18nString[1]));
        }
    });

    $('[data-i18n-placeholder]').each(function () {
        var sIdent = this.getAttribute('data-i18n-placeholder'),
            sTranslation = chrome.i18n.getMessage(sIdent);

        if (sTranslation && sTranslation.length) {
            $(this).attr('placeholder', sTranslation);
        }
    });

    /*
     * GUI events
     */
    $('#toggle-view').click(function () {
        $('#shortcuts').toggle(!shortcutsViewVisible);
        $('#page-actions').toggle(shortcutsViewVisible);
        $('#toggle-view').text(chrome.i18n.getMessage(shortcutsViewVisible ? 'SHOW_SHORTCUTS' : 'SHOW_HOME'));
        shortcutsViewVisible = !shortcutsViewVisible;
    });

    $('#toggle-ruler').click(function () {
        toggleRulerButton();
        sendToActiveTab('toggleRulers');
        syncToAllTabs('toggleRulers');
    });

    $('#toggle-helpline').click(function () {
        toggleHelplineButton();
        sendToActiveTab('toggleHelplines');
        syncToAllTabs('toggleHelplines');
    });

    $('#add-helpline-x').click(function () {
        sendToActiveTab('addHelpLine', {posX: 100, posY: 0}, function () {
            toggleRulerButton(true);
            toggleHelplineButton(true);
            refreshHelpLineListing();
        });
    });

    $('#add-helpline-y').click(function () {
        sendToActiveTab('addHelpLineY', {}, function () {
            toggleRulerButton(true);
            toggleHelplineButton(true);
            refreshHelpLineListing();
        });
    });

    // Feature 2: Center Lines button
    $('#add-center-lines').click(function () {
        sendToActiveTab('addCenterLines', {}, function () {
            toggleRulerButton(true);
            toggleHelplineButton(true);
            refreshHelpLineListing();
        });
        syncToAllTabs('addCenterLines');
    });

    // Feature 12: Screenshot button
    $('#btn-screenshot').click(function () {
        chrome.runtime.sendMessage({sAction: 'captureScreenshot'}, function (response) {
            if (chrome.runtime.lastError || !response || !response.dataUrl) return;
            var a = document.createElement('a');
            a.href = response.dataUrl;
            a.download = 'pageliner-screenshot-' + Date.now() + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    });

    $('#remove-helplines').click(function () {
        sendToActiveTab('removeAllHelpLines', {}, function () {
            refreshHelpLineListing();
        });
        syncToAllTabs('removeAllHelpLines');
    });

    // Feature 6: Grid Generator
    $('#grid-toggle').click(function () {
        $(this).toggleClass('open');
        $('#grid-body').toggle();
    });

    // Built-in framework presets
    var aSystemGridPresets = [
        {name: 'Bootstrap 5',  cols: 12, colGap: 24},
        {name: 'Bootstrap 4',  cols: 12, colGap: 30},
        {name: 'Foundation 6', cols: 12, colGap: 20},
        {name: '960gs / 12',   cols: 12, colGap: 20, maxWidth: 960},
        {name: '960gs / 16',   cols: 16, colGap: 20, maxWidth: 960},
        {name: 'Material (L)', cols: 12, colGap: 24},
        {name: 'Tailwind',     cols: 12, colGap: 16},
        {name: '8-Spalten',    cols: 8,  colGap: 24}
    ];

    aSystemGridPresets.forEach(function (tpl) {
        var label = tpl.name + ' (' + tpl.cols + ' · ' + tpl.colGap + 'px)';
        var $btn  = $('<button type="button" class="btn btn-xs btn-default grid-sys-btn"></button>').text(tpl.name);
        $btn.attr('title', label);
        $btn.on('click', function () {
            if (tpl.maxWidth) {
                $('#grid-maxwidth').val(tpl.maxWidth);
                // Switch to px mode if a fixed width is defined
                sGridWidthUnit = 'px';
                $('#grid-unit-px').addClass('active');
                $('#grid-unit-pct').removeClass('active');
            }
            $('#grid-cols').val(tpl.cols);
            $('#grid-gap').val(tpl.colGap);
            updateGridCalcInfo();
        });
        $('#grid-system-presets').append($btn);
    });

    // px / % unit toggle
    var sGridWidthUnit = 'px';
    var blGridHasBeenGenerated = false;
    var iGridAutoRegenerateTimer = null;

    $('#grid-unit-px').on('click', function () {
        if (sGridWidthUnit === '%') {
            // Convert % → px isn't possible without viewport width; just clamp max
            $('#grid-maxwidth').attr('max', 10000);
        }
        sGridWidthUnit = 'px';
        $(this).addClass('active');
        $('#grid-unit-pct').removeClass('active');
        updateGridCalcInfo();
        scheduleAutoGridRegenerate();
    });

    $('#grid-unit-pct').on('click', function () {
        sGridWidthUnit = '%';
        $(this).addClass('active');
        $('#grid-unit-px').removeClass('active');
        $('#grid-maxwidth').attr('max', 100);
        if (parseInt($('#grid-maxwidth').val()) > 100) {
            $('#grid-maxwidth').val(100);
        }
        updateGridCalcInfo();
        scheduleAutoGridRegenerate();
    });

    function getGridParams() {
        return {
            maxWidth:       parseInt($('#grid-maxwidth').val())       || (sGridWidthUnit === '%' ? 100 : 1500),
            widthType:      sGridWidthUnit,
            cols:           parseInt($('#grid-cols').val())           || 12,
            colGap:         parseInt($('#grid-gap').val())            || 0,
            rows:           parseInt($('#grid-rows').val())           || 0,
            lineColor:      $('#grid-line-color').val()               || '#0055ff',
            overlayColor:   $('#grid-overlay-color').val()            || '#0055ff',
            overlayOpacity: parseInt($('#grid-overlay-opacity').val()) || 10,
            showOverlay:    $('#grid-show-cols').is(':checked')
        };
    }

    function generateGrid(p, blSync) {
        sendToActiveTab('addGrid', p, function () {
            toggleRulerButton(true);
            toggleHelplineButton(true);
            refreshHelpLineListing();
        });

        if (blSync) {
            syncToAllTabs('addGrid', p);
        }

        blGridHasBeenGenerated = true;
    }

    function updateGridCalcInfo() {
        var p = getGridParams();
        if (p.widthType === '%') {
            $('#grid-calc-info').text(
                p.maxWidth + '% ' + t('POPUP_GRID_CALC_PERCENT_VIEWPORT') + ' · ' +
                p.cols + ' ' + t('POPUP_GRID_CALC_PERCENT_COLUMNS') + ' · ' +
                p.colGap + 'px ' + t('POPUP_GRID_CALC_PERCENT_GAP')
            );
        } else {
            var totalGaps = p.colGap * (p.cols - 1);
            var colWidth  = (p.maxWidth - totalGaps) / p.cols;
            $('#grid-calc-info').text(
                t('POPUP_GRID_CALC_COL_WIDTH') + ': ' + Math.round(colWidth * 10) / 10 + 'px'
            );
        }
    }

    $('#grid-maxwidth, #grid-cols, #grid-gap').on('input change', updateGridCalcInfo);
    updateGridCalcInfo();

    $('#btn-generate-grid').click(function () {
        var p = getGridParams();
        generateGrid(p, true);
    });

    function scheduleAutoGridRegenerate() {
        if (!blGridHasBeenGenerated) return;

        if (iGridAutoRegenerateTimer) {
            clearTimeout(iGridAutoRegenerateTimer);
        }

        iGridAutoRegenerateTimer = setTimeout(function () {
            var p = getGridParams();
            generateGrid(p, true);
        }, 180);
    }

    $('#grid-maxwidth, #grid-cols, #grid-gap, #grid-rows, #grid-line-color, #grid-overlay-color, #grid-overlay-opacity, #grid-show-cols')
        .on('input change', scheduleAutoGridRegenerate);

    $('#btn-clear-overlays').click(function () {
        sendToActiveTab('clearGridOverlays');
        syncToAllTabs('clearGridOverlays');
    });

    // Grid templates: Save
    $('#btn-save-grid-template').click(function () {
        var sName = $('#grid-template-name').val().trim();
        if (!sName) return;
        var p = getGridParams();
        chrome.storage.local.get('pglnr-grid-templates', function (data) {
            var oTemplates = data['pglnr-grid-templates'] || {};
            oTemplates[sName] = p;
            chrome.storage.local.set({'pglnr-grid-templates': oTemplates}, function () {
                $('#grid-template-name').val('');
                refreshGridTemplateList();
            });
        });
    });

    function refreshGridTemplateList() {
        chrome.storage.local.get('pglnr-grid-templates', function (data) {
            var oTemplates = data['pglnr-grid-templates'] || {};
            var $oContainer = $('#grid-template-list');
            $oContainer.empty();

            Object.keys(oTemplates).forEach(function (sName) {
                var tpl = oTemplates[sName];
                var $oTag = $('<span class="preset-tag" title="' +
                    tpl.maxWidth + 'px · ' + tpl.cols + ' ' + t('POPUP_GRID_CALC_PERCENT_COLUMNS') + ' · ' +
                    tpl.colGap + 'px ' + t('POPUP_GRID_CALC_PERCENT_GAP') + '"></span>');
                $oTag.append(document.createTextNode(sName));

                var $oDel = $('<span class="preset-tag-del" title="' + t('POPUP_DELETE') + '">&times;</span>');
                $oTag.append($oDel);

                // Click tag → load template into form and generate
                $oTag.on('click', function (e) {
                    if ($(e.target).hasClass('preset-tag-del')) return;
                    $('#grid-maxwidth').val(tpl.maxWidth);
                    $('#grid-cols').val(tpl.cols);
                    $('#grid-gap').val(tpl.colGap);
                    $('#grid-rows').val(tpl.rows || 0);
                    updateGridCalcInfo();
                    generateGrid(tpl, true);
                });

                // Click × → delete template
                $oDel.on('click', function (e) {
                    e.stopPropagation();
                    chrome.storage.local.get('pglnr-grid-templates', function (data2) {
                        var oT = data2['pglnr-grid-templates'] || {};
                        delete oT[sName];
                        chrome.storage.local.set({'pglnr-grid-templates': oT}, refreshGridTemplateList);
                    });
                });

                $oContainer.append($oTag);
            });

            if (Object.keys(oTemplates).length === 0) {
                $oContainer.html('<em style="color:#999;font-size:10px">' + t('POPUP_GRID_NO_TEMPLATES') + '</em>');
            }
        });
    }

    refreshGridTemplateList();

    // Feature 8: Presets section
    $('#presets-toggle').click(function () {
        $(this).toggleClass('open');
        $('#presets-body').toggle();
    });

    $('#btn-save-preset').click(function () {
        var sName = $('#preset-name').val().trim();
        if (!sName) return;

        sendToActiveTab('getAllHelpLines', {}, function (aHelpLines) {
            if (!Array.isArray(aHelpLines)) return;

            chrome.storage.local.get('pglnr-presets', function (data) {
                var oPresets = data['pglnr-presets'] || {};
                oPresets[sName] = aHelpLines;
                chrome.storage.local.set({'pglnr-presets': oPresets}, function () {
                    $('#preset-name').val('');
                    refreshPresetList();
                });
            });
        });
    });

    // Feature 9: Export / Import
    $('#settings-toggle').click(function () {
        $(this).toggleClass('open');
        $('#settings-body').toggle();
    });

    $('#btn-export').click(function () {
        sendToActiveTab('getAllHelpLines', {}, function (aHelpLines) {
            if (!Array.isArray(aHelpLines)) return;
            var sJson = JSON.stringify(aHelpLines, null, 2);
            var oBlob = new Blob([sJson], {type: 'application/json'});
            var sUrl  = URL.createObjectURL(oBlob);
            var a = document.createElement('a');
            a.href = sUrl;
            a.download = 'pageliner-helplines-' + Date.now() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(sUrl);
        });
    });

    $('#btn-import').click(function () {
        $('#import-file-input').val('').trigger('click');
    });

    $('#import-file-input').on('change', function () {
        var oFile = this.files[0];
        if (!oFile) return;

        var oReader = new FileReader();
        oReader.onload = function (e) {
            try {
                var aHelpLines = JSON.parse(e.target.result);
                if (!Array.isArray(aHelpLines)) {
                    alert(t('POPUP_IMPORT_INVALID_JSON'));
                    return;
                }
                sendToActiveTab('importHelpLines', {aHelpLines: aHelpLines}, function () {
                    toggleRulerButton(true);
                    toggleHelplineButton(true);
                    refreshHelpLineListing();
                });
            } catch (err) {
                alert(t('POPUP_IMPORT_PARSE_ERROR_PREFIX') + ': ' + err.message);
            }
        };
        oReader.readAsText(oFile);
    });

    // Feature 10: Sync across tabs checkbox
    $('#sync-tabs').on('change', function () {
        chrome.storage.local.set({'pglnr-syncAcrossTabs': this.checked});
    });

    // Feature 4: Show labels checkbox
    $('#show-labels').on('change', function () {
        var blShow = this.checked;
        sendToActiveTab('setLabelVisibility', {blShow: blShow});
        syncToAllTabs('setLabelVisibility', {blShow: blShow});
    });

    // -------------------------------------------------------
    // Helper: toggle ruler/helpline eye icons
    // -------------------------------------------------------
    function toggleRulerButton(forceShow) {
        var $oIcon = $('#toggle-ruler').find('.glyphicon');
        forceShow = forceShow || false;

        if (!$oIcon.hasClass('glyphicon-eye-open') || forceShow) {
            $oIcon.removeClass('glyphicon-eye-close').addClass('glyphicon-eye-open');
        } else {
            $oIcon.removeClass('glyphicon-eye-open').addClass('glyphicon-eye-close');
        }
    }

    function toggleHelplineButton(forceShow) {
        var $oIcon = $('#toggle-helpline').find('.glyphicon');
        forceShow = forceShow || false;

        if (!$oIcon.hasClass('glyphicon-eye-open') || forceShow) {
            $oIcon.removeClass('glyphicon-eye-close').addClass('glyphicon-eye-open');
        } else {
            $oIcon.removeClass('glyphicon-eye-open').addClass('glyphicon-eye-close');
        }
    }

    // -------------------------------------------------------
    // Feature 8: Preset list renderer
    // -------------------------------------------------------
    function refreshPresetList() {
        chrome.storage.local.get('pglnr-presets', function (data) {
            var oPresets = data['pglnr-presets'] || {};
            var $oContainer = $('#preset-list');
            $oContainer.empty();

            Object.keys(oPresets).forEach(function (sName) {
                var $oTag = $('<span class="preset-tag"></span>');
                $oTag.append(document.createTextNode(sName));

                var $oDel = $('<span class="preset-tag-del" title="' + t('POPUP_DELETE') + '">&times;</span>');
                $oTag.append($oDel);

                // Click on tag name area → load preset
                $oTag.on('click', function (e) {
                    if ($(e.target).hasClass('preset-tag-del')) return;
                    sendToActiveTab('importHelpLines', {aHelpLines: oPresets[sName]}, function () {
                        toggleRulerButton(true);
                        toggleHelplineButton(true);
                        refreshHelpLineListing();
                    });
                    syncToAllTabs('importHelpLines', {aHelpLines: oPresets[sName]});
                });

                // Click on × → delete preset
                $oDel.on('click', function (e) {
                    e.stopPropagation();
                    chrome.storage.local.get('pglnr-presets', function (data2) {
                        var oP = data2['pglnr-presets'] || {};
                        delete oP[sName];
                        chrome.storage.local.set({'pglnr-presets': oP}, refreshPresetList);
                    });
                });

                $oContainer.append($oTag);
            });
        });
    }

    // -------------------------------------------------------
    // Helpline listing (rewritten for all new features)
    // -------------------------------------------------------
    function refreshHelpLineListing() {
        sendToActiveTab('getAllHelpLines', {}, function (oAllHelpLines) {
            var $oHelpLineActions        = $('#helpline-actions'),
                $oHelpLineActionsDivider = $('#helpline-actions-divider');

            if (Array.isArray(oAllHelpLines) && oAllHelpLines.length > 0) {
                var $oHelpLineListing = $oHelpLineActions.find('.listing');

                $oHelpLineActionsDivider.removeClass('hidden');
                $oHelpLineActions.removeClass('hidden');
                $oHelpLineListing.html('');

                $.each(oAllHelpLines, function (x, hl) {
                    // Defaults for backward compat
                    var sColor     = hl.sColor     || '#33ffff';
                    var iThickness = hl.iThickness !== undefined ? hl.iThickness : 1;
                    var iOpacity   = hl.iOpacity   !== undefined ? hl.iOpacity   : 100;
                    var sStyle     = hl.sStyle     || 'solid';
                    var sLabel     = hl.sLabel     || '';
                    var posVal     = hl.posX > 0 ? hl.posX : hl.posY;
                    var sAxis      = hl.posX > 0 ? 'X' : 'Y';

                    // Build item container
                    var $oItem = $('<div class="hl-item" data-id="' + x + '"></div>');

                    // --- Row 1: number · label · color · delete ---
                    var $oHeader = $('<div class="hl-header"></div>');

                    var $oNum = $('<span class="hl-num">#' + (x + 1) + '</span>');

                    var $oLabelInput = $('<input type="text" class="hl-label form-control input-sm" placeholder="' + t('POPUP_LABEL_PLACEHOLDER') + '" value="' + $('<div>').text(sLabel).html() + '">');
                    $oLabelInput.on('change', (function (idx) {
                        return function () {
                            var sVal = $(this).val();
                            sendToActiveTab('editHelpLine', {id: idx, sLabel: sVal});
                            syncToAllTabs('editHelpLine', {id: idx, sLabel: sVal});
                        };
                    }(x)));

                    var $oColorInput = $('<input type="text" class="hl-color form-control input-sm" value="' + sColor + '">');
                    $oColorInput.css('border-color', sColor);
                    $oColorInput.attr('data-id', x);

                    $(function () {
                        $oColorInput.ColorPicker({
                            color: sColor,
                            onChange: function (hsb, hex, rgb) {
                                $oColorInput.val('#' + hex);
                                $oColorInput.css('border-color', '#' + hex);
                                sendToActiveTab('editHelpLine', {id: parseInt($oColorInput.attr('data-id')), sColor: '#' + hex});
                                syncToAllTabs('editHelpLine', {id: parseInt($oColorInput.attr('data-id')), sColor: '#' + hex});
                            }
                        }).bind('keyup', function () {
                            $(this).ColorPickerSetColor(this.value);
                            if (this.value.substr(0, 1) !== '#') {
                                this.value = '#' + this.value;
                            }
                            this.style.borderColor = this.value;
                            sendToActiveTab('editHelpLine', {id: parseInt(this.getAttribute('data-id')), sColor: this.value});
                            syncToAllTabs('editHelpLine', {id: parseInt(this.getAttribute('data-id')), sColor: this.value});
                        });
                    });

                    var $oDelete = $('<span class="hl-delete" title="' + t('POPUP_DELETE') + '">&times;</span>');
                    $oDelete.attr('data-id', x);
                    $oDelete.on('click', (function (idx) {
                        return function () {
                            sendToActiveTab('deleteHelpline', {id: idx}, function () {
                                refreshHelpLineListing();
                            });
                            syncToAllTabs('deleteHelpline', {id: idx});
                        };
                    }(x)));

                    $oHeader.append($oNum, $oLabelInput, $oColorInput, $oDelete);

                    // --- Row 2: position · style · thickness · opacity ---
                    var $oControls = $('<div class="hl-controls"></div>');

                    // Feature 1: Exact position input
                    var $oPosInput = $('<input type="number" class="hl-pos" min="1" title="' + t('POPUP_POSITION_TITLE') + ' (' + sAxis + '-axis)" value="' + Math.round(posVal) + '">');
                    $oPosInput.append($('<span style="font-size:10px;color:#888;">' + sAxis + '</span>'));
                    $oPosInput.on('change', (function (idx, axis) {
                        return function () {
                            var iVal = parseInt($(this).val()) || 1;
                            var oParams = {id: idx};
                            if (axis === 'X') {
                                oParams.posX = iVal;
                            } else {
                                oParams.posY = iVal;
                            }
                            sendToActiveTab('editHelpLine', oParams);
                            syncToAllTabs('editHelpLine', oParams);
                        };
                    }(x, sAxis)));

                    // Axis label after position
                    var $oPosAxisLabel = $('<span style="font-size:10px;color:#888;min-width:10px;">' + sAxis + '</span>');

                    // Feature 11: Line style select
                    var $oStyleSelect = $('<select class="hl-style"></select>');
                    ['solid', 'dashed', 'dotted'].forEach(function (s) {
                        var $opt = $('<option value="' + s + '">' + t('POPUP_STYLE_' + s.toUpperCase()) + '</option>');
                        if (s === sStyle) $opt.prop('selected', true);
                        $oStyleSelect.append($opt);
                    });
                    $oStyleSelect.on('change', (function (idx) {
                        return function () {
                            var sVal = $(this).val();
                            sendToActiveTab('editHelpLine', {id: idx, sStyle: sVal});
                            syncToAllTabs('editHelpLine', {id: idx, sStyle: sVal});
                        };
                    }(x)));

                    // Feature 3: Thickness select
                    var $oThicknessSelect = $('<select class="hl-thickness"></select>');
                    for (var t = 1; t <= 5; t++) {
                        var $tOpt = $('<option value="' + t + '">' + t + 'px</option>');
                        if (t === iThickness) $tOpt.prop('selected', true);
                        $oThicknessSelect.append($tOpt);
                    }
                    $oThicknessSelect.on('change', (function (idx) {
                        return function () {
                            var iVal = parseInt($(this).val());
                            sendToActiveTab('editHelpLine', {id: idx, iThickness: iVal});
                            syncToAllTabs('editHelpLine', {id: idx, iThickness: iVal});
                        };
                    }(x)));

                    // Feature 5: Opacity input
                    var $oOpacityInput = $('<input type="number" class="hl-opacity" min="0" max="100" title="' + t('POPUP_OPACITY_TITLE') + ' (%)" value="' + iOpacity + '">');
                    var $oOpacityLabel = $('<span style="font-size:10px;color:#888;">%</span>');
                    $oOpacityInput.on('change', (function (idx) {
                        return function () {
                            var iVal = Math.min(100, Math.max(0, parseInt($(this).val()) || 100));
                            $(this).val(iVal);
                            sendToActiveTab('editHelpLine', {id: idx, iOpacity: iVal});
                            syncToAllTabs('editHelpLine', {id: idx, iOpacity: iVal});
                        };
                    }(x)));

                    $oControls.append($oPosInput, $oPosAxisLabel, $oStyleSelect, $oThicknessSelect, $oOpacityInput, $oOpacityLabel);

                    $oItem.append($oHeader, $oControls);
                    $oHelpLineListing.append($oItem);
                });
            }
            else {
                $oHelpLineActionsDivider.addClass('hidden');
                $oHelpLineActions.addClass('hidden');
            }
        });
    }

    function getGuiStatus() {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            if (!tabs[0]) return;

            chrome.tabs.sendMessage(tabs[0].id, {sAction: 'getGuiStatus'}, function (response) {
                if (chrome.runtime.lastError) return;

                if (typeof response !== 'undefined'
                    && response.localStorage
                    && response.localStorage['pglnr-ext-rulerIsActive']
                    && response.localStorage['pglnr-ext-helplineIsActive']
                ) {
                    if (response.localStorage['pglnr-ext-rulerIsActive'] === 'false') {
                        toggleRulerButton(false);
                    }

                    if (response.localStorage['pglnr-ext-helplineIsActive'] === 'false') {
                        toggleHelplineButton(false);
                    }
                }

                // Feature 4: restore labels checkbox
                if (response && response.localStorage) {
                    if (response.localStorage['pglnr-ext-blShowLabels'] === 'true') {
                        $('#show-labels').prop('checked', true);
                    }
                }
            });
        });
    }

    // Initialize
    refreshHelpLineListing();
    getGuiStatus();
    refreshPresetList();

    // Feature 10: restore sync checkbox
    chrome.storage.local.get('pglnr-syncAcrossTabs', function (data) {
        if (data['pglnr-syncAcrossTabs']) {
            $('#sync-tabs').prop('checked', true);
        }
    });
});
