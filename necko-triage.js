var triage = null;

function SortBySeverity(a, b) {
    const SeverityMap = [
        "blocker",
        "critical",
        "major",
        "normal",
        "minor",
        "trivial",
        "enhancement"
    ];
    let aSev = SeverityMap.indexOf(a["severity"]);
    let bSev = SeverityMap.indexOf(b["severity"]);

    return aSev - bSev;
}

function GetNIHelper(dataRow) {
    let lastNI = undefined;
    for (let flag of dataRow["flags"]) {
        if (flag["name"] == "needinfo") {
            lastNI = flag["modification_date"];
        }
    }

    return lastNI;
}

function SortByNI(a, b) {
    let aNI = GetNIHelper(a);
    let bNI = GetNIHelper(b);

    if (a === undefined || b === undefined) {
        // Use our default sort instead
        return SortBySeverity(a, b);
    }

    let aDate = new Date(aNI);
    let bDate = new Date(bNI);

    // We want the oldest ones first
    if (aDate < bDate) {
        return -1;
    }

    if (bDate < aDate) {
        return 1;
    }

    // Fall back to the default sort
    return SortBySeverity(a, b);
}

function GetNI(dataRow) {
    let lastNI = GetNIHelper(dataRow);

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
    let trigger = $("#settings-trigger");
    trigger.click($.proxy(this, "show"));
    let self = this;
    this.settingsDialog = $("#settings-dialog").dialog({
        autoOpen: false,
        width: 400,
        modal: true,
        buttons: {
            Close: function () {
                self.settingsDialog.dialog("close");
            }
        },
        close: function () {
            self.close();
        }
    });

    $("#custom-query-add-trigger").click($.proxy(this, "showCQAdd"));
    this.customQueryAddDialog = $("#custom-query-add").dialog({
        autoOpen: false,
        width: 375,
        modal: true,
        buttons: {
            Cancel: function () {
                self.closeCustomQueryAdd();
            },
            Save: function () {
                self.saveCustomQueryAdd();
            }
        }
    });

    let customQueriesHelp = $("#custom-queries-help-trigger");
    customQueriesHelp.click($.proxy(this, "showCQHelp"));
    this.customQueriesHelpDialog = $("#custom-queries-help").dialog({
        autoOpen: false,
        width: 350,
        modal: true,
        buttons: {
            Ok: function () {
                self.customQueriesHelpDialog.dialog("close");
            }
        }
    });

    this.load();
};
AppSettings.prototype.FIELDS = ["bz-apikey"];
AppSettings.prototype.CHECKBOXES = ["open-bugs-in-new-window"];
AppSettings.prototype._settings = {};
AppSettings.prototype.oldCustomQueries = null;
AppSettings.prototype.load = function () {
    let strSettings = window.localStorage.getItem("settings");
    if (strSettings) {
        this._settings = JSON.parse(strSettings);
    }

    for (let i of this.FIELDS) {
        if (this._settings.hasOwnProperty(i)) {
            $("#" + i).val(this._settings[i]);
        } else {
            this._settings[i] = "";
        }
    }

    for (let i of this.CHECKBOXES) {
        if (this._settings.hasOwnProperty(i)) {
            document.getElementById(i).checked = this._settings[i];
        } else {
            this._settings[i] = document.getElementById(i).checked;
        }
    }

    if (this._settings.hasOwnProperty("custom-queries")) {
        let self = this;
        $.each(this._settings["custom-queries"], function (i, query) {
            self.displayCustomQuery(i, query);
        });
    } else {
        this._settings["custom-queries"] = [];
    }
};
AppSettings.prototype.displayCustomQuery = function (i, query) {
    let rootElement = $("#custom-queries-wrapper");
    let div = $("<div />", {id: "custom-query-setting-" + i, text: query["title"], "class": "custom-query-setting"});
    let button = $("<button />", {title: "Remove Query", "class": "query-remove ui-button ui-widget ui-corner-all ui-button-icon-only"});
    button.click($.proxy(this, "removeQuery", i));
    let span = $("<span />", {"class": "ui-icon ui-icon-minus"});
    button.append(span);
    div.append(button);
    rootElement.append(div);
};
AppSettings.prototype.closeCustomQueryAdd = function () {
    // Clear out the input fields for next time
    $("#query-title").val("");
    $("#query-url").val("");

    this.customQueryAddDialog.dialog("close");
};
AppSettings.prototype.showError = function (message) {
    $("<div />", {title: "Error", text: message}).dialog({
        modal: true,
        width: 325
    });
};
AppSettings.prototype.saveCustomQueryAdd = function () {
    let queryTitle = $.trim($("#query-title").val());
    if (queryTitle == "") {
        this.showError("Title can't be empty!");
        return;
    }
    for (let query of this._settings["custom-queries"]) {
        if (queryTitle == query["title"]) {
            this.showError("Query '" + queryTitle + "' already exists!");
            return;
        }
    }

    let queryURL = $.trim($("#query-url").val());
    if (queryURL == "") {
        this.showError("URL can't be empty!");
        return;
    }

    let parsedURL = URI(queryURL);
    if (parsedURL.origin() != "https://bugzilla.mozilla.org") {
        this.showError("URL is not from BMO!");
        return;
    }
    if (parsedURL.path() != "/buglist.cgi" &&
        parsedURL.path() != "/query.cgi") {
        this.showError("URL does not appear to be search results!");
        return;
    }

    let query = parsedURL.query(true);
    if (query.hasOwnProperty("list_id")) {
        delete query.list_id;
    }
    if (query.hasOwnProperty("query_format")) {
        delete query.query_format;
    }

    if (!this.oldCustomQueries) {
        this.oldCustomQueries = Array.from(this._settings["custom-queries"]);
    }
    let newQuery = {"title": queryTitle, "query": query};
    let i = this._settings["custom-queries"].length;
    this._settings["custom-queries"].push(newQuery);
    this.displayCustomQuery(i, newQuery);

    this.closeCustomQueryAdd();
};
AppSettings.prototype.removeQuery = function (index) {
    let currentLength = this._settings["custom-queries"].length;
    if (index >= currentLength) {
        console.log("removeQuery: index too big?!");
        return;
    }
    if (index < 0) {
        console.log("removeQuery: index too small?!");
        return;
    }

    if (!this.oldCustomQueries) {
        this.oldCustomQueries = Array.from(this._settings["custom-queries"]);
    }

    this._settings["custom-queries"].splice(index, 1);
    $("#custom-query-setting-" + index).remove();

    if (index != (currentLength - 1)) {
        // Need to adjust the indices, because we removed from somewhere in
        // the middle of the list.
        let queries = document.getElementsByClassName("custom-query-setting");
        for (let i = 0; i < queries.length; i++) {
            queries[i].id = "custom-query-setting-" + i;
            let button = $(queries[i]).children("button");
            button.off("click");
            button.click($.proxy(this, "removeQuery", i));
        }
    }
};
AppSettings.prototype.show = function () {
    this.settingsDialog.dialog("open");
};
AppSettings.prototype.showCQHelp = function () {
    this.customQueriesHelpDialog.dialog("open");
};
AppSettings.prototype.showCQAdd = function () {
    this.customQueryAddDialog.dialog("open");
};
AppSettings.prototype.close = function () {
    let anySettingChanged = false;

    for (let i of this.FIELDS) {
        let newVal = $("#" + i).val();
        if (newVal != this._settings[i]) {
            anySettingChanged = true;
        }
        this._settings[i] = newVal;
    }

    for (let i of this.CHECKBOXES) {
        let newVal = document.getElementById(i).checked;
        if (newVal != this._settings[i]) {
            anySettingChanged = true;
        }
        this._settings[i] = newVal;
    }

    let resetUserTables = false;
    if (this.oldCustomQueries) {
        anySettingChanged = true;
        resetUserTables = true;
    }

    if (anySettingChanged) {
        window.localStorage.setItem("settings", JSON.stringify(this._settings));
        triage.reloadAll(resetUserTables);
    }
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
NeckoTriage.prototype.version = "0.0.4";
NeckoTriage.prototype.availableTables = {
    "untriaged-no-ni": {
        "is_user": false,
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
        "extra_columns": {},
        "row_sort": SortBySeverity
    },
    "untriaged-ni": {
        "is_user": false,
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
        "extra_columns": {"ni-date": {"title": "Last ni?", "data_selector": GetNI}},
        "row_sort": SortByNI
    },
    "malformed": {
        "is_user": false,
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
        "extra_columns": {},
        "row_sort": SortBySeverity
    },
    "p1-unassigned": {
        "is_user": false,
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
        "extra_columns": {},
        "row_sort": SortBySeverity
    }
};
NeckoTriage.prototype.init = function () {
    // Make sure we display the proper version info
    $("#necko-triage-version").text(this.version);

    // Give ourselves a handle to the element, not just its id
    this.rootElement = $(this.rootElement);

    this.settings = new AppSettings();
    $("#menu").menu();
    $("#reload-all").click($.proxy(this, "reloadAll", false));

    // Now load all the tables
    let self = this;
    $.each(this.availableTables, function (k, v) {
        self.tables[k] = new BugTable(k, v, self);
        self.tables[k].create();
    });

    this.createUserTables();
};
NeckoTriage.prototype.reloadAll = function (resetUserTables) {
    if (resetUserTables) {
        $(".user-table").remove();

        let newTables = {};
        $.each(this.tables, function (k, table) {
            if (!table.isUser) {
                newTables[k] = table;
            }
        });
        this.tables = newTables;
    }

    $.each(this.tables, function (k, table) {
        table.load();
    });

    if (resetUserTables) {
        this.createUserTables();
    }
};
NeckoTriage.prototype.createUserTables = function () {
    let customQueries = this.settings.get("custom-queries");
    let self = this;
    $.each(customQueries, function (i, customQuery) {
        self.createUserTable(i, customQuery);
    });
};
NeckoTriage.prototype.createUserTable = function (index, customQuery) {
    let queryConfig = $.extend({}, customQuery);
    queryConfig["extra_columns"] = [];
    queryConfig["row_sort"] = SortBySeverity;
    queryConfig["is_user"] = true;

    let tableID = "user-query-" + index;
    this.tables[tableID] = new BugTable(tableID, queryConfig, this);
    this.tables[tableID].create();
};

BugTable = function (id, config, triage) {
    this.id = id;
    this.title = config["title"];
    this.query = config["query"];
    this.extraColumns = config["extra_columns"]
    this.rowSort = config["row_sort"];
    this.isUser = config["is_user"];
    this.triage = triage;
};
BugTable.prototype.id = "";
BugTable.prototype.title = "";
BugTable.prototype.query = {};
BugTable.prototype.extraColumns = {};
BugTable.prototype.rowSort = null;
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

    let oldTable = this.table.children(".bug-table");
    if (oldTable) {
        oldTable.remove();
    }

    if (data["bugs"].length == 0) {
        let div = $("<div />", {id: this.id, text: "Zarro Boogs!", "class": "bug-table"});
        this.table.append(div);
        return;
    }

    let table = $("<table />", {id: this.id, "class": "bug-table"});
    let thead = $("<thead />", {id: "thead-" + this.id, "class": "bug-table-head"});
    let thr = $("<tr />", {id: "thead-tr-" + this.id, "class": "bug-table-row"});
    thr.append($("<th />", {text: "Bug ID", id: "thead-id-" + this.id, "class": "bug-id"}));
    thr.append($("<th />", {text: "Severity", id: "thead-severity-" + this.id, "class": "bug-severity"}));
    thr.append($("<th />", {text: "Summary", id: "thead-summary-" + this.id, "class": "bug-summary"}));
    let self = this;
    $.each(this.extraColumns, function (k, v) {
        thr.append($("<th />", {text: v["title"], id: "thead-" + k + "-" + self.id, "class": "bug-" + k}));
    });
    thead.append(thr);
    table.append(thead);

    if (this.rowSort) {
        data["bugs"].sort(this.rowSort);
    }

    let tbody = $("<tbody />", {id: "tbody-" + this.id, "class": "bug-table-body"});
    $.each(data["bugs"], function (i, rowData) {
        let idPrefix = "tr-" + i + "-";
        let tr = $("<tr />", {id: idPrefix + self.id, "class": "bug-table-row"});

        let icon = "ui-icon-blank";
        for (let group of rowData["groups"]) {
            // NWGH - there may be other groups here that should be called out
            // but for now, these are the only ones I know about.
            if (group == "network-core-security" ||
                group == "core-security") {
                icon = "ui-icon-locked";
            }
        }
        let idTd = $("<td />", {id: idPrefix + "id-" + self.id, "class": "bug-id"});
        let iconSpan = $("<span />", {"class": "ui-icon " + icon});
        idTd.append(iconSpan);
        let href = "https://bugzilla.mozilla.org/show_bug.cgi?id=" + rowData["id"];
        let link = $("<a />", {href: href, text: "" + rowData["id"], id: idPrefix + "a-" + self.id});
        if (self.triage.settings.get("open-bugs-in-new-window")) {
            link.attr("target", "_blank");
        }
        idTd.append(link);
        tr.append(idTd);

        let severityTd = $("<td />", {text: rowData["severity"], id: idPrefix + "severity-" + self.id, "class": "bug-severity"});
        tr.append(severityTd);

        let summaryTd = $("<td />", {text: rowData["summary"], id: idPrefix + "summary-" + self.id, "class": "bug-summary"});
        tr.append(summaryTd);

        $.each(self.extraColumns, function (k, v) {
            let td = $("<td />", {id: idPrefix + k + "-" + self.id, "class": "bug-" + k});
            if (v.hasOwnProperty("data_selector")) {
                let rowInfo = v["data_selector"](rowData);
                if ($.type(rowInfo) == "object") {
                    // Selector returned a created element, put it in our td.
                    td.append(rowInfo);
                } else {
                    // Selector returned some plain text
                    td.text(rowInfo);
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
BugTable.prototype.enableFunctionality = function () {
    this.table.removeClass("loading");
    this.table.off("click");

    this.reloadSpan.removeClass("loading");
    this.reloadSpan.click($.proxy(this, "load"));
};
BugTable.prototype.disableFunctionality = function () {
    this.reloadSpan.click(function (e) {e.preventDefault();});
    this.reloadSpan.addClass("loading");

    this.table.click(function (e) {e.preventDefault();});
    this.table.addClass("loading");
};
BugTable.prototype.load = function () {
    this.disableFunctionality();

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
             .always($.proxy(this, "enableFunctionality"));
};
BugTable.prototype.create = function () {
    // Build up our DOM objects, and stick them in the appropriate container
    let classString = "bug-container";
    if (this.isUser) {
        classString += " user-table";
    }
    let rootContainer = $("<div />", {"id": "bug-container-" + this.id, "class": classString});

    let titleWrapper = $("<div />");
    let title = $("<span />", {text: this.title, "class": "bug-table-title"});
    titleWrapper.append(title);

    this.reloadSpan = $("<span />", {"class": "reload-button ui-icon ui-icon-arrowrefresh-1-e", title: "Reload Table"});
    this.reloadSpan.click($.proxy(this, "load"));

    titleWrapper.append(this.reloadSpan);
    rootContainer.append(titleWrapper);

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
