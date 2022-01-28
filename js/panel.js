if (chrome.devtools.panels.themeName == 'dark') {
  document.getElementsByTagName("body")[0].classList.add("dark-theme")
}

const globals = {
  authToken: null,
  userPsnID: null,
  latestPsnID: null,
  transactions: [],
  loading: false,
  currentDateISO: null
};

function infoShowBanner() {
  document.getElementById("loading2").classList.add("hidden");
  document.getElementById("total-info").classList.add("hidden");
  document.getElementById("navigate-banner").classList.remove("hidden");
  document.getElementById("total-info").innerHTML = '';
  globals.loading = false;
}

function infoShowLoader() {
  document.getElementById("loading2").classList.remove("hidden");
  document.getElementById("total-info").classList.add("hidden");
  document.getElementById("navigate-banner").classList.add("hidden");
  document.getElementById("total-info").innerHTML = '';
}

function infoShowData(count, total, CSV) {
  const html = `
  <div class="text">
    <div>Transactions: <span class="bold">${count}</span></div>
    <div>Total paid: <span class="bold">${total}</span></div>
    <button class="btn btn-primary bold" role="button" id="download-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 9l-5 5-5-5M12 12.8V2.5"></path>
      </svg>
      <span>Download transactions in CSV</span>
    </button>
    <div class="clear"></div>
  </div>`;
  document.getElementById("total-info").innerHTML = html;
  document.getElementById("loading2").classList.add("hidden");
  document.getElementById("total-info").classList.remove("hidden");
  document.getElementById("navigate-banner").classList.add("hidden");

  const btn = document.getElementById("download-btn");
  btn.addEventListener("click", function() {
    btn.setAttribute("disabled", "");
    downloadCSV('PSN-' + globals.userPsnID + '-transactions-' + globals.currentDateISO, CSV);
    setTimeout(() => {
      btn.removeAttribute("disabled");
    }, 5000)
  });
}

(function() {
  let timer;
  function loadUserInfo() {
    if (globals.userPsnID && globals.userPsnID.length) {
      clearInterval(timer);
    }
    chrome.devtools.inspectedWindow.eval("document.getElementsByClassName('profile-text-main')[0].innerText",
      userId => {
        if (userId != globals.latestPsnID) {
          infoShowBanner()
        }
        globals.latestPsnID = userId;
        globals.userPsnID = userId;
      }
    );
    chrome.devtools.inspectedWindow.eval('document.querySelector("[data-components=\'kekka-user-information\']").innerHTML',
      html => {
        if (html && html.length) {
          document.getElementById("loading1").classList.add("hidden");
          document.getElementById("user-information").innerHTML = html.replace(/url\(\/\//g, 'url(https://');
          document.getElementById("total-info-col").classList.remove("hidden");
        }
      }
    )
  }

  chrome.tabs.onUpdated.addListener(function (tabId , info) {
    if (info.status === 'complete') {
      globals.userPsnID = null;
      document.getElementById("user-information").innerHTML = '';
      document.getElementById("loading1").classList.remove("hidden");
      document.getElementById("total-info-col").classList.add("hidden");
      timer = setInterval(loadUserInfo, 2000);
      loadUserInfo();
    }
  });

  timer = setInterval(loadUserInfo, 2000);
  loadUserInfo();
})();

function setXhrHeader(xhr, name, value) {
  if (name && name.indexOf(':') === -1 && ["host", "connection", "sec-ch-ua", "user-agent", "origin", "sec-fetch-site",
    "sec-fetch-mode", "sec-fetch-dest", "referer", "accept-encoding"].indexOf(name.toLowerCase()) === -1) {
    xhr && xhr.setRequestHeader(name, value);
  }
}

function convertToCSV(data, columns) {
  const delimiter = '\t';
  const nl = '\r\n';
  let multi = false;
  let multiIndex = -1;
  let total_val = 0;
  let total = 0;
  let currency = null;
  let total_index = null;
  let currency_index = null;

  function getChildren(obj) {
    if (obj === undefined) return null;
    const args = [].slice.call(arguments);
    args.shift();
    args.forEach(arg => {
      if (obj) {
        if (obj[arg] !== undefined) {
          obj = obj[arg];
        } else if (arg && (arg + '').indexOf('.') !== -1) {
          obj = getChildren.apply(null, [obj].concat((arg + '').split('.')));
        } else {
          obj = null;
        }
      }
    });
    return obj !== undefined ? obj : null;
  }

  function labels() {
    let txt = '';
    columns.forEach((col, i) => {
      if (col.multi) {
        multi = col.key;
        multiIndex = i;
        col.items.forEach(colChild => {
          txt += colChild.label + delimiter;
        });
      } else {
        txt += col.label + delimiter;
      }
    });
    return txt.slice(0, -1) + nl;
  }

  function row(rowData, cols) {
    let txt = '';
    cols.forEach((col, index) => {
      if (!col.multi) {
        let val = (getChildren(rowData, col.key) || '') + '';
        if (col.price) {
          total_val += (val || 0) * 1;
          total_index = index;
          total = col.format(total_val);
        }
        if (col.format) {
          val = col.format(val);
        }
        if (!currency && col.currency) {
          currency = val;
          currency_index = index;
        }
        txt += val.replace(/\t+/g, ' ') + delimiter;
      }
    });
    return txt.slice(0, -1) + nl;
  }

  let multiCols;

  function eachRows(rowData) {
    if (multi) {
      const multiData = rowData[multi];
      let insertRows = [];
      let createMultiCols;
      if (!multiCols) {
        createMultiCols = columns.slice();
      }
      columns[multiIndex].items.forEach((item, j) => {
        const keys = item.key.split('[*].');
        const new_key = multi + '>' + keys.join('>').replace(/\./g, '>');
        const children = getChildren(multiData[keys[0]]);
        if (!multiCols) {
          createMultiCols.splice(multiIndex + j + 1, 0, Object.assign({}, item, {key: new_key}))
        }
        if (children) {
          children.forEach((child, i) => {
            if (!insertRows[i]) {
              insertRows.push({});
            }
            insertRows[i][new_key] = getChildren(child, keys[1])
          });
        }
      });

      for (let j = 0, len = insertRows.length; j < len; j++) {
        Object.assign(insertRows[j], rowData);
      }

      if (createMultiCols) {
        multiCols = createMultiCols;
      }
      let rows = '';
      insertRows.forEach(rowData1 => {
        rows += row(rowData1, multiCols);
      })
      return rows;
    } else {
      return row(rowData, columns);
    }
  }

  let CSV = labels();

  data.forEach(rowData => {
    CSV += eachRows(rowData);
  });

  if (currency_index && total_index) {
    CSV += nl;
    let i;
    for (i = 0; i < total_index - 2; i++) {
      CSV += "\t";
    }
    CSV += "TOTAL:\t";
    CSV += total;
    for (; i < currency_index - 2; i++) {
      CSV += "\t";
    }
    CSV += currency + nl;
  }

  return [data.length, total, currency, CSV];
}

function downloadCSV(filename, txt) {
  const link = document.createElement("a");
  const blob = new Blob([txt], {type: 'text/csv'});
  const csvUrl = window.webkitURL.createObjectURL(blob);
  link.setAttribute('download', filename + '.csv');
  link.setAttribute('href', csvUrl);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateCSV(transactions) {
  if (transactions.length) {
    const columns = [
      {label: 'Date', key: 'transactionDetail.transactionDate', format: v => v.split('T')[0]},
      {label: 'Time', key: 'transactionDetail.transactionDate', format: v => v.split('T')[1].split('.')[0]},
      {label: 'Transaction ID', key: 'transactionDetail.transactionId'},
      {key: 'additionalInfo', multi: true, items: [
          {label: 'Product sku ID', key: 'orderItems[*].skuId'},
          {label: 'Product Name', key: 'orderItems[*].productName'},
          {label: 'Total Price', key: 'orderItems[*].totalPrice.value', price: true, format: v => {
              // new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(23234.2342).replace(/[^\-\d\.]/g, '');
              v = '000' + (v + '');
              return v.slice(0, -2).replace(/^0+/, '0').replace(/^0([^\.])/, '$1') + '.' + v.slice(-2)
            }},
        ]},
      {label: 'Currency Code', key: 'currencyCode', currency: true},
      {label: 'Billing Method', key: 'additionalInfo.chargePayments.0.paymentMethod'},
      {label: 'Billing Info', key: 'additionalInfo.chargePayments.0.billingInfo'},
      // {label: 'Invoice Type', key: 'invoiceType'},
      // {label: 'Transaction State', key: 'transactionDetail.transactionState'},
      {label: 'Platform ID', key: 'transactionDetail.platformId'},
      {label: 'IP Address', key: 'transactionDetail.ipAddress'},
    ];

    const [count, total, currency, CSV] = convertToCSV(transactions, columns);
    infoShowData(count, total + ' ' + currency, CSV);
  }
}

function loadTransactions(request) {
  if (globals.loading || globals.transactions.length || !globals.authToken) return;
  globals.loading = true;

  function getUrlParams(search) {
    let query = search.substr(1);
    let params = {};
    query.split("&").forEach(function(part) {
      let item = part.split("=");
      params[item[0]] = decodeURIComponent(item[1]);
    });
    return params;
  }

  function urlParamsToString(params) {
    const search = [];
    Object.keys(params).forEach(key => {
      search.push(key + "=" + encodeURIComponent(params[key]));
    });
    return search.join('&');
  }

  function dateTZ(date) {
    date = date.replace('Z', '000000').substring(0, 23) + 'Z';
    return date.replace('Z', '+0000')
  }

  function getTransactions(endDate) {
    const xhrUrl = new URL(request.url);
    const params = getUrlParams(xhrUrl.search);
    params.startDate = dateTZ('2016-01-01T00:00:00.000Z');
    params.endDate = dateTZ(endDate);
    params.limit = 200;
    xhrUrl.search = urlParamsToString(params);

    const xhr = new XMLHttpRequest();
    xhr.open("GET", xhrUrl.toString());

    for (const header in request.headers) {
      setXhrHeader(xhr, header.name, header.value);
    }
    setXhrHeader(xhr, 'authorization', globals.authToken)

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        const response = JSON.parse(xhr.response);
        if (response.transactions) {
          globals.transactions = [].concat(globals.transactions, response.transactions);
          if (response.hasMore && response.nextEndDate) {
            setTimeout(function () {
              getTransactions(response.nextEndDate);
            }, 100);
          } else {
            globals.loading = false;
            generateCSV(globals.transactions);
          }
        } else {
          globals.loading = false;
        }
        if (xhr.status === 401) {
          globals.authToken = null;
          globals.loading = false;
          globals.transactions = [];
          infoShowBanner();
        }
      }
    }
    xhr.send();
  }

  const currentDate = new Date();
  globals.currentDateISO = currentDate.toISOString()
  getTransactions(new Date(currentDate.getTime() + 86400000).toISOString());
}

chrome.devtools.network.onRequestFinished.addListener(function (netevent) {
  if (netevent && netevent.request && netevent.request.url.indexOf('/api/transactions/v2/history') !== -1) {
    if (globals.loading || globals.transactions.length) return;
    for (const header of netevent.request.headers) {
      if (header.name == "authorization") {
        globals.authToken = header.value;
      }
    }
    if (globals.authToken) {
      infoShowLoader();
      loadTransactions(netevent.request)
    }
  }
});
