/**
 * PageLiner
 *
 * @copyright   2018 Kai Neuwerth
 * @author      Kai Neuwerth
 * @link        https://pageliner.com
 * @modified    Modified distribution by Alexander Kaiser (Apache-2.0)
 */

chrome.action.setBadgeText({text: ''});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.sAction === 'updatePopUp') {
            chrome.tabs.query(
                {
                    active: true,
                    currentWindow: true
                },
                function (aTabs) {
                    if (!aTabs[0]) { sendResponse({}); return; }
                    var iTabId = aTabs[0].id;

                    if (request.oAllHelpLines) {
                        var iHelpLinesCount = request.oAllHelpLines.length;

                        chrome.action.setBadgeText(
                            {
                                text: iHelpLinesCount ? '' + iHelpLinesCount : '',
                                tabId: iTabId
                            }
                        );

                        chrome.action.setBadgeBackgroundColor(
                            {
                                color: '#3C4E55',
                                tabId: iTabId
                            }
                        );
                    }

                    sendResponse({});
                }
            );
            return true;
        }

        if (request.sAction === 'captureScreenshot') {
            chrome.tabs.query({active: true, currentWindow: true}, function (aTabs) {
                if (!aTabs[0]) { sendResponse({dataUrl: null}); return; }
                chrome.tabs.captureVisibleTab(null, {format: 'png'}, function (dataUrl) {
                    sendResponse({dataUrl: dataUrl || null});
                });
            });
            return true;
        }

        if (request.sAction === 'broadcastToAllTabs') {
            chrome.tabs.query({}, function (aTabs) {
                aTabs.forEach(function (tab) {
                    try {
                        chrome.tabs.sendMessage(
                            tab.id,
                            Object.assign({sAction: request.tabAction}, request.tabParams || {}),
                            function () {
                                // swallow errors for tabs that don't have the content script
                                void chrome.runtime.lastError;
                            }
                        );
                    } catch (e) {
                        // swallow
                    }
                });
            });
            sendResponse({});
            return true;
        }
    }
);

chrome.runtime.onInstalled.addListener(function (details) {
    if (typeof details.previousVersion === 'undefined') {
        setTimeout(function () {
            chrome.tabs.create({url: chrome.runtime.getURL('src/pages/ChromeFirstRun.html')});
        }, 200);
    }

    chrome.action.setBadgeText({text: 'NEW'});
    chrome.action.setBadgeBackgroundColor({color: '#e20700'});
});
