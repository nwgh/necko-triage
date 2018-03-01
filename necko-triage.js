var triage = null;

function GetNI(dataRow) {
    let lastNI = undefined;
    for (let flag of dataRow["flags"]) {
        // TODO
        if (flag["name"] == "needinfo") {
            lastNI = flag["modification_date"];
        }
    }

    if ($.type(lastNI) == "string") {
        let relativeLastNI = moment(lastNI).fromNow();
        let span = $("<span />", {title: lastNI, text: relativeLastNI});
        span.tooltip();
        lastNI = span;
    } else {
        lastNI = "unknown";
    }

    return lastNI;
}

AppSettings = function () {
    this.trigger = $("#settings-trigger");
    this.trigger.click($.proxy(this, "show"));
    let self = this;
    this.dialog = $("#settings-dialog").dialog({
        autoOpen: false,
        height: 400,
        width: 350,
        modal: true,
        buttons: {
            Close: function () {
                self.dialog.dialog("close");
            }
        },
        close: function () {
            for (let i in this.FIELDS) {
                this._settings[i] = $("#" + i).value();
            }
            self.close();
        }
    });

    this.load();
};
AppSettings.prototype.FIELDS = ["bz-apikey"];
AppSettings.prototype._settings = {};
AppSettings.prototype.load = function () {
    // TODO - read stuff from localStorage
    let strSettings = window.localStorage.getItem("settings");
    if (strSettings) {
        this._settings = JSON.parse(strSettings);
    }

    for (let i of this.FIELDS) {
        if (this._settings.hasOwnProperty(i)) {
            $("#" + i).val(this._settings[i]);
        }
    }
};
AppSettings.prototype.show = function () {
    this.dialog.dialog("open");
};
AppSettings.prototype.close = function () {
    for (let i of this.FIELDS) {
        this._settings[i] = $("#" + i).val();
    }
    window.localStorage.setItem("settings", JSON.stringify(this._settings));
};
AppSettings.prototype.get = function (key) {
    if (this._settings.hasOwnProperty(key)) {
        return this._settings[key];
    }

    return undefined;
};

NeckoTriage = function () { };
NeckoTriage.prototype.tables = {};
NeckoTriage.prototype.rootElement = "#necko-triage-root";
NeckoTriage.prototype.version = "0.0.2";
NeckoTriage.prototype.availableTables = {
    "untriaged-no-ni": {
        "title": "Untriaged bugs (without ni?)",
        "query": {
            "f0": "OP",
            "f1": "OP",
            "f2": "flagtypes.name",
            "f3": "CP",
            "f4": "CP",
            "status_whiteboard": "\\[necko-triaged\\]|\\[necko-active\\]|\\[necko-next\\]|\\[necko-backlog\\]|\\[necko-would-take\\]",
            "status_whiteboard_type": "notregexp",
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "j1": "OR",
            "product": "Core",
            "v2": "needinfo?",
            "n2": "1",
            "resolution": "---",
            "o2": "substring"
        },
        "extra_columns": {}
    },
    "untriaged-ni": {
        "title": "Untriaged bugs (awaiting ni?)",
        "query": {
            "status_whiteboard": "\\[necko-triaged\\]",
            "product": "Core",
            "query_format": "advanced",
            "status_whiteboard_type": "notregexp",
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "f1": "flagtypes.name",
            "v1": "needinfo?",
            "resolution": "---",
            "o1": "substring",
            "priority": "--"
        },
        "extra_columns": {"ni-date": {"title": "Last ni?", "data_selector": GetNI}}
    },
    "malformed": {
        "title": "Malformed bugs",
        "query": {
            "status_whiteboard_type": "regexp",
            "product": "Core",
            "query_format": "advanced",
            "status_whiteboard": "\\[necko-triaged\\]|\\[necko-backlog\\]|\\[necko-would-take\\]|\\[necko-active\\]|\\[necko-next\\]",
            "bug_status": [
                "UNCONFIRMED",
                "NEW",
                "ASSIGNED",
                "REOPENED"
            ],
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "priority": "--",
            "resolution": "---"
        },
        "extra_columns": {}
    },
    "p1-unassigned": {
        "title": "Unassigned P1 bugs",
        "query": {
            "f1": "assigned_to",
            "product": "Core",
            "query_format": "advanced",
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "priority": "P1",
            "resolution": "---",
            "o1": "isempty"
        },
        "extra_columns": {}
    }
};
NeckoTriage.prototype.init = function () {
    // Make sure we display the proper version info
    $("#necko-triage-version").text(this.version);

    // Give ourselves a handle to the element, not just its id
    this.rootElement = $(this.rootElement);

    this.settings = new AppSettings();
    $("#menu").menu();

    // Now load all the tables
    let self = this;
    $.each(this.availableTables, function (k, v) {
        self.tables[k] = new BugTable(k, v, self);
        self.tables[k].create();
    });
};
NeckoTriage.prototype.reloadAll = function () {
    $.each(this.tables, function (k, table) {
        table.load();
    });
};

BugTable = function (id, config, triage) {
    this.id = id;
    this.title = config["title"];
    this.query = config["query"];
    this.extraColumns = config["extra_columns"]
    this.triage = triage;
};
BugTable.prototype.id = "";
BugTable.prototype.title = "";
BugTable.prototype.query = {};
BugTable.prototype.extraColumns = {};
BugTable.prototype.triage = null;
BugTable.prototype.table = null;
BugTable.prototype.errorContainer = null;
BugTable.prototype.reloadSpan = null;
BugTable.prototype.showError = function () {
    this.errorContainer.text("Error loading bugs. Data may be stale.");
    this.errorContainer.show();
};
BugTable.prototype.xhrError = function (xhr, status, errorThrown) {
    console.log("Error: " + errorThrown);
    console.log("Status: " + status);
    console.log(xhr);
};
BugTable.prototype.displayError = function (error) {
    console.log("Bugzilla Error: " + error);
    this.showError();
};
BugTable.prototype.display = function (data) {
    this.errorContainer.hide();

    /* TODO - this doesn't work
    let oldTable = $(this.id);
    if (oldTable) {
        oldTable.remove();
    }
    */

    if (data["bugs"].length == 0) {
        let div = $("<div />", {id: this.id, text: "Zarro Boogs!"});
        this.table.append(div);
        return;
    }

    let table = $("<table />", {id: this.id, "class": "bug-table"});
    let thead = $("<thead />", {id: "thead-" + this.id, "class": "bug-table-head"});
    let thr = $("<tr />", {id: "thead-tr-" + this.id, "class": "bug-table-row"});
    thr.append($("<th />", {text: "Bug ID", id: "thead-id-" + this.id, "class": "bug-id"}));
    thr.append($("<th />", {text: "Summary", id: "thead-summary-" + this.id, "class": "bug-summary"}));
    let self = this;
    $.each(this.extraColumns, function (k, v) {
        thr.append($("<th />", {text: v["title"], id: "thead-" + k + "-" + self.id, "class": "bug-" + k}));
    });
    thead.append(thr);
    table.append(thead);

    let tbody = $("<tbody />", {id: "tbody-" + this.id, "class": "bug-table-body"});
    $.each(data["bugs"], function (i, rowData) {
        let idPrefix = "tr-" + i + "-";
        let tr = $("<tr />", {id: idPrefix + self.id, "class": "bug-table-row"});

        let idTd = $("<td />", {id: idPrefix + "id-" + self.id, "class": "bug-id"});
        let href = "https://bugzilla.mozilla.org/show_bug.cgi?id=" + rowData["id"];
        let link = $("<a />", {href: href, text: "" + rowData["id"], id: idPrefix + "a-" + self.id});
        idTd.append(link);
        tr.append(idTd);

        let summaryTd = $("<td />", {text: rowData["summary"], id: idPrefix + "summary-" + self.id, "class": "bug-summary"});
        tr.append(summaryTd);

        $.each(self.extraColumns, function (k, v) {
            let td = $("<td />", {id: idPrefix + k + "-" + self.id, "class": "bug-" + k});
            if (v.hasOwnProperty("data_selector")) {
                let data = v["data_selector"](rowData);
                if ($.type(data) == "object") {
                    // Selector returned a created element, put it in our td.
                    td.append(data);
                } else {
                    // Selector returned some plain text
                    td.text(data);
                }
            } else {
                td.text(rowData[k]);
            }

            tr.append(td);
        });

        tbody.append(tr);
    });

    table.append(tbody);

    this.table.append(table);
};
BugTable.prototype.enableReload = function () {
    // TODO
    //this.reloadSpan.enable();
};
BugTable.prototype.load = function () {
    //TODO
    //this.reloadSpan.disable();
    // disable table, as well
    // show spinner?
    let apiKey = this.triage.settings.get("bz-apikey");
    let query = $.extend({}, this.query);
    if (apiKey) {
        $.extend(query, {"api_key": apiKey});
    }
    $.getJSON({url: "https://bugzilla.mozilla.org/rest/bug",
               data: query,
               type: "GET",
               traditional: true})
             .done($.proxy(this, "display"))
             .fail($.proxy(this, "xhrError"))
             .always($.proxy(this, "enableReload"));
};
BugTable.prototype.create = function () {
    // Build up our DOM objects, and stick them in the appropriate container
    let rootContainer = $("<div />", {"id": "bug-container-" + this.id});

    let title = $("<h1 />", {text: this.title, "class": "bug-table-title"});
    rootContainer.append(title);

    /* TODO - this doesn't work
    this.reloadSpan = $("<span>Reload</span>");
    this.reloadSpan.click($.proxy(this, "load"));
    rootContainer.append(this.reloadSpan);
    */

    this.errorContainer = $("<div />", {"class": "bug-error"});
    rootContainer.append(this.errorContainer);

    this.table = $("<div />", {"id": this.id});
    rootContainer.append(this.table);

    this.triage.rootElement.append(rootContainer);

    this.load();
};

$(function () {
    triage = new NeckoTriage();
    triage.init();
});
