chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
  let url = tabs[0] ? tabs[0].url : '';

  if (url.indexOf('//id.sonyentertainmentnetwork.com/') !== -1 || url.indexOf('//metamorphz.d/') !== -1 || url.indexOf('//my.account.sony.com/') !== -1) {
    chrome.devtools.panels.create("PSN Transactions", "images/psn-icon-32.png", "panel.html", function(panel) {
      chrome.devtools.inspectedWindow.eval("window.__PSN_DEVTOOLS__ = '__PSN_DEVTOOLS__'");
    });
  }
});
